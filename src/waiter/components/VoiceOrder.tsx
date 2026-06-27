import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, CheckCircle, AlertTriangle, X, RefreshCw, Loader2, Volume2, Trash2, DollarSign, Ban, Undo2, HelpCircle, Plus, ClipboardList, VolumeX, Ear } from 'lucide-react';
import * as api from '../../api';

interface VoiceItem {
  name: string;
  quantity: number;
  modifiers: string[];
  exclude: string[];
  menu_match: { id: number; name: string; price: number } | null;
  found: boolean;
}

interface ParsedResult {
  command: 'order' | 'confirm' | 'pay' | 'close' | 'cancel' | 'refund' | 'help' | 'unknown';
  waiter_nick: string | null;
  table_number: number | null;
  check_id: number | null;
  items: VoiceItem[];
  unrecognized: string[];
}

interface Draft {
  id: string;
  waiterId: number;
  tableId: number | null;
  tableName: string;
  items: VoiceItem[];
  created_at: string;
  updated_at: string;
}

interface Props {
  user: any;
  tables: any[];
  dishes: any[];
  onOrderCreated: () => void;
  onClose: () => void;
}

// ─── Wake word phrases ─────────────────────────────────
const WAKE_PHRASES = ['принять заказ', 'прими заказ', 'алиса прими заказ', 'алиса принять заказ', 'алиса'];
const STOP_PHRASES = ['стоп', 'хватит', 'остановись', 'закончили'];
const CONFIRM_WORDS = ['да', 'подтверждаю', 'верно', 'давай', 'отправляй'];
const REJECT_WORDS = ['нет', 'неверно', 'отмена', 'заново', 'повтори'];
const NON_ORDER_WORDS = ['привет', 'здравствуйте', 'спасибо', 'благодарю', 'пожалуйста', 'добрый день', 'добрый вечер', 'до свидания', 'пока', 'окей', 'хорошо', 'ладно', 'понял', 'поняла', 'извините', 'простите'];

// ─── Help text ─────────────────────────────────────────
const HELP_TEXT = [
  '🔑 Скажите «Принять заказ» для активации',
  '🎤 После триггера говорите: «Стол 5, паста Карбонара»',
  '📝 «Оформляй заказ» — отправить на кухню',
  '💰 «Оплата чека 128» — оплатить',
];

interface MenuLookup {
  [key: string]: { id: number; name: string; price: number };
}

export default function VoiceOrder({ user, tables, dishes, onOrderCreated, onClose }: Props) {
  // ─── Core state ──────────────────────────────────────
  const [phase, setPhase] = useState<'dormant' | 'waking' | 'listening' | 'confirming' | 'processing' | 'idle'>('dormant');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResult, setLastResult] = useState<ParsedResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info');
  const [showHelp, setShowHelp] = useState(false);
  const [listenedChunks, setListenedChunks] = useState<string[]>([]);

  // ─── Refs ────────────────────────────────────────────
  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const wakeTimerRef = useRef<any>(null);
  const draftIdRef = useRef<string | null>(null);
  const lastSpeechRef = useRef(0);
  const confirmTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // ─── Build menu lookup ───────────────────────────────
  const menuMap = useRef<MenuLookup>({});
  useEffect(() => {
    const map: MenuLookup = {};
    for (const d of dishes) {
      map[d.name.toLowerCase()] = { id: d.id, name: d.name, price: d.price };
    }
    menuMap.current = map;
  }, [dishes]);

  // ─── TTS ─────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU'; u.rate = 0.85;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  const showMsg = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(text);
    setMsgType(type);
    setTimeout(() => setMessage(''), 5000);
  }, []);

  // ─── Test noise level ───────────────────────────────
  const isTooNoisy = useCallback((analyser: AnalyserNode): boolean => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return avg > 80;
  }, []);

  // ─── Check if text contains menu items ──────────────
  const hasMenuItems = useCallback((text: string): boolean => {
    const lower = text.toLowerCase();
    const menuNames = Object.keys(menuMap.current);
    return menuNames.some(name => lower.includes(name));
  }, []);

  // ─── Check for wake word ────────────────────────────
  const isWakeWord = useCallback((text: string): boolean => {
    const lower = text.toLowerCase().trim();
    return WAKE_PHRASES.some(p => lower.includes(p));
  }, []);

  // ─── Check for stop command ─────────────────────────
  const isStopCommand = useCallback((text: string): boolean => {
    const lower = text.toLowerCase().trim();
    return STOP_PHRASES.some(p => lower.includes(p));
  }, []);

  // ─── Filter non-order words ─────────────────────────
  const filterNoise = useCallback((text: string): string => {
    let result = text.toLowerCase();
    for (const word of NON_ORDER_WORDS) {
      result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    }
    return result.trim();
  }, []);

  // ─── Start audio stream with noise suppression ──────
  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
      });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      return { stream, analyser };
    } catch {
      return null;
    }
  }, []);

  // ─── Start recognition ──────────────────────────────
  const startRecognition = useCallback((continuous: boolean, interim: boolean) => {
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return null;
      const r = new SR();
      r.lang = 'ru-RU';
      r.continuous = continuous;
      r.interimResults = interim;
      r.maxAlternatives = 1;
      return r;
    } catch { return null; }
  }, []);

  // ─── Full system start ──────────────────────────────
  const startSystem = useCallback(async () => {
    const audio = await startAudio();
    if (!audio) {
      setErrorMsg('Нет доступа к микрофону');
      speak('Нет доступа к микрофону');
      return;
    }
    const { analyser } = audio;

    // Dormant: listen for wake word only
    setPhase('dormant');
    activeRef.current = true;
    speak('Скажите «Принять заказ» для начала');

    const dormantRec = startRecognition(true, true);
    if (!dormantRec) { setErrorMsg('Распознавание не поддерживается'); return; }

    dormantRec.onresult = (event: any) => {
      if (!activeRef.current) return;
      const noizy = isTooNoisy(analyser);
      if (noizy) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (!text) continue;

          if (isWakeWord(text)) {
            dormantRec.stop();
            activateListening(analyser);
            return;
          }
          if (isStopCommand(text)) {
            shutdown();
            return;
          }
        }
      }
    };
    dormantRec.onend = () => { if (activeRef.current) dormantRec.start(); };
    dormantRec.start();
    recognitionRef.current = dormantRec;
  }, [startAudio, startRecognition, isWakeWord, isStopCommand, isTooNoisy, speak]);

  // ─── Activate listening (after wake word) ────────────
  const activateListening = useCallback((analyser: AnalyserNode) => {
    setPhase('listening');
    lastSpeechRef.current = Date.now();
    speak('Слушаю. Говорите заказ.');

    // Create draft
    api.voiceDraftCreate(user.id).then(r => {
      draftIdRef.current = r.draftId;
      setDraft(r.draft);
    }).catch(() => {});

    const listeningRec = startRecognition(true, true);
    if (!listeningRec) return;

    let pendingBuffer = '';
    let lastEcho = '';

    listeningRec.onresult = (event: any) => {
      if (!activeRef.current) return;
      const noizy = isTooNoisy(analyser);
      if (noizy) {
        if (Date.now() - lastSpeechRef.current > 3000) {
          speak('Слишком шумно. Повторите.');
          lastSpeechRef.current = Date.now();
        }
        return;
      }

      lastSpeechRef.current = Date.now();

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim();
        if (!text) continue;

        if (event.results[i].isFinal) {
          const filtered = filterNoise(text);
          if (!filtered) continue;

          // Check for commands first
          const lower = filtered.toLowerCase();
          if (isStopCommand(lower)) { shutdown(); return; }
          if (lower.includes('подтверди') || lower.includes('да') && listenedChunks.length > 0) {
            handleConfirmNow();
            return;
          }
          if (lower.includes('нет') || lower.includes('заново') || lower.includes('повтори')) {
            clearDraft();
            speak('Начните заново.');
            return;
          }
          if (lower.includes('оформляй') || lower.includes('отправь')) {
            handleConfirmNow();
            return;
          }

          // Check if contains menu items before processing
          if (!hasMenuItems(filtered) && !lower.includes('стол') && !lower.includes('чек') && !lower.includes('оплата') && !lower.includes('закрыть') && !lower.includes('возврат')) {
            // Might be noise / non-order speech - ignore silently
            return;
          }

          // Add to listened chunks and process
          setListenedChunks(prev => [...prev, filtered]);
          pendingBuffer = filtered;
          processChunk(filtered);

          // Reset confirm timer on each speech
          clearTimeout(confirmTimerRef.current);
          confirmTimerRef.current = setTimeout(() => {
            // After 3s silence, ask for confirmation
            if (draft && draft.items.length > 0) {
              const names = draft.items.map(i => `${i.name} ×${i.quantity}`).join(', ');
              speak(`В черновике: ${names}. Скажите «Подтверждаю» или «Заново».`);
              setPhase('confirming');
            }
          }, 3000);

          lastEcho = filtered;
        } else {
          // Interim result - show on UI but don't process
          setLastTranscript(text);
        }
      }
    };

    listeningRec.onend = () => { if (activeRef.current) listeningRec.start(); };
    listeningRec.start();
    recognitionRef.current = listeningRec;
  }, [user.id, speak, filterNoise, isStopCommand, hasMenuItems, listenedChunks, draft]);

  // ─── Process a speech chunk ──────────────────────────
  const processChunk = useCallback(async (text: string) => {
    setPhase('processing');
    try {
      const result = await api.request('/api/mobile/voice-order', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });

      if (!result.success) return;
      const parsed: ParsedResult = result.parsed;
      setLastResult(parsed);

      const draftId = draftIdRef.current;
      if (!draftId) return;

      switch (parsed.command) {
        case 'order': {
          const items = (parsed.items || []).map(item => ({
            ...item,
            menu_match: item.menu_match || menuMap.current[item.name.toLowerCase()] || null,
            found: item.found || !!menuMap.current[item.name.toLowerCase()],
          }));

          // Only add items that have menu matches or were found by AI
          const validItems = items.filter(i => i.found);
          const missing = items.filter(i => !i.found);

          if (validItems.length === 0 && missing.length > 0) {
            speak('Блюдо не найдено. Повторите.');
            showMsg(`Не найдено: ${missing.map(i => i.name).join(', ')}`, 'error');
            setPhase('listening');
            return;
          }

          await api.voiceDraftAddItems(draftId, validItems, parsed.table_number || undefined);
          const updated = await api.voiceDraftGet(draftId);
          setDraft(updated.draft);

          const names = validItems.map(i => i.name).join(', ');
          const tableStr = parsed.table_number ? ` на стол ${parsed.table_number}` : '';
          speak(`Принято${tableStr}: ${names}`);
          showMsg(`✅ ${names}`, 'success');

          if (missing.length > 0) {
            speak(`Не найдено: ${missing.map(i => i.name).join(', ')}`);
          }
          break;
        }
        case 'confirm':
          await handleConfirmNow();
          break;
        case 'pay':
          await handlePayNow(parsed);
          break;
        case 'close':
          await handleCloseNow(parsed);
          break;
        case 'cancel':
          await clearDraft();
          break;
        case 'refund':
          await handleRefundNow(parsed);
          break;
        case 'help':
          setShowHelp(true);
          speak('Скажите «Принять заказ», затем называйте блюда');
          break;
        default:
          if (parsed.items && parsed.items.length > 0) {
            // AI parsed something even without 'order' command - add it
            const items = parsed.items.map(item => ({
              ...item,
              menu_match: menuMap.current[item.name.toLowerCase()] || null,
              found: !!menuMap.current[item.name.toLowerCase()],
            }));
            const valid = items.filter(i => i.found);
            if (valid.length > 0) {
              await api.voiceDraftAddItems(draftId, valid, parsed.table_number || undefined);
              const updated = await api.voiceDraftGet(draftId);
              setDraft(updated.draft);
            }
          }
      }
    } catch {}
    setPhase('listening');
  }, [speak, showMsg]);

  // ─── Confirm order ──────────────────────────────────
  const handleConfirmNow = useCallback(async () => {
    const draftId = draftIdRef.current;
    if (!draftId) { speak('Нет заказа для оформления'); return; }
    try {
      const d = await api.voiceDraftGet(draftId);
      if (!d.draft.items.length) { speak('Заказ пуст'); return; }
      const result = await api.voiceConfirm(draftId, user.id, `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username);
      draftIdRef.current = null;
      setDraft(null);
      setListenedChunks([]);
      speak(`Заказ №${result.orderId} отправлен на кухню`);
      showMsg(`✅ Заказ №${result.orderId} на кухне`, 'success');
      onOrderCreated();
      // New draft
      const r = await api.voiceDraftCreate(user.id);
      draftIdRef.current = r.draftId;
      setDraft(r.draft);
    } catch { speak('Ошибка отправки'); }
  }, [user.id, speak, showMsg, onOrderCreated]);

  // ─── Pay ────────────────────────────────────────────
  const handlePayNow = useCallback(async (parsed: ParsedResult) => {
    const cn = parsed.check_id || parsed.table_number;
    if (!cn) { speak('Укажите номер чека'); return; }
    try {
      await api.voicePay(cn);
      speak(`Чек ${cn} оплачен`);
      showMsg(`💰 Чек №${cn} оплачен`, 'success');
      onOrderCreated();
    } catch { speak(`Чек ${cn} не найден`); }
  }, [speak, showMsg, onOrderCreated]);

  // ─── Close ──────────────────────────────────────────
  const handleCloseNow = useCallback(async (parsed: ParsedResult) => {
    const cn = parsed.check_id || parsed.table_number;
    if (!cn) { speak('Укажите номер чека'); return; }
    try {
      await api.voiceClose(cn);
      speak(`Чек ${cn} закрыт`);
      showMsg(`🔒 Чек №${cn} закрыт`, 'success');
      onOrderCreated();
    } catch { speak(`Чек ${cn} не найден`); }
  }, [speak, showMsg, onOrderCreated]);

  // ─── Refund ─────────────────────────────────────────
  const handleRefundNow = useCallback(async (parsed: ParsedResult) => {
    const cn = parsed.check_id || parsed.table_number;
    if (!cn) { speak('Укажите номер чека'); return; }
    try {
      await api.voiceRefund(cn, 'Возврат голосом');
      speak(`Возврат по чеку ${cn} выполнен`);
      showMsg(`↩️ Возврат по чеку №${cn}`, 'success');
      onOrderCreated();
    } catch { speak(`Чек ${cn} не найден`); }
  }, [speak, showMsg, onOrderCreated]);

  // ─── Clear draft ────────────────────────────────────
  const clearDraft = useCallback(async () => {
    const id = draftIdRef.current;
    if (id) { try { await api.voiceDraftDelete(id); } catch {} }
    draftIdRef.current = null;
    setDraft(null);
    setListenedChunks([]);
    speak('Черновик очищен');
    const r = await api.voiceDraftCreate(user.id);
    draftIdRef.current = r.draftId;
    setDraft(r.draft);
  }, [user.id, speak]);

  // ─── Shutdown everything ────────────────────────────
  const shutdown = useCallback(() => {
    activeRef.current = false;
    clearTimeout(wakeTimerRef.current);
    clearTimeout(confirmTimerRef.current);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); }
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch {} }
    setPhase('dormant');
    setListenedChunks([]);
    speak('Голосовой режим выключен');
  }, [speak]);

  // ─── Cleanup ────────────────────────────────────────
  useEffect(() => { return () => shutdown(); }, [shutdown]);

  // ─── Table name helper ──────────────────────────────
  const getTableName = (id: number | null) => {
    if (!id) return '';
    const t = tables.find(t => t.id === id || t.name === String(id));
    return t?.name || String(id);
  };

  const draftTotal = draft?.items.reduce((s, i) => s + (i.menu_match?.price || 0) * i.quantity, 0) || 0;

  // ─── Phase indicators ───────────────────────────────
  const phaseIcon = () => {
    switch (phase) {
      case 'dormant': return <Mic size={18} className="text-zinc-500" />;
      case 'listening': return <><span className="animate-ping absolute w-3 h-3 rounded-full bg-green-400 opacity-75" /><span className="w-3 h-3 rounded-full bg-green-500" /></>;
      case 'confirming': return <Volume2 size={18} className="text-yellow-400" />;
      case 'processing': return <Loader2 size={18} className="text-orange-500 animate-spin" />;
      default: return <Mic size={18} className="text-orange-500" />;
    }
  };

  const phaseLabel = () => {
    switch (phase) {
      case 'dormant': return 'Ожидание «Принять заказ»';
      case 'listening': return 'Слушаю';
      case 'confirming': return 'Подтверждение';
      case 'processing': return 'Обработка';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-zinc-900 rounded-3xl w-full max-w-lg max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* ─── Header ───────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="relative flex w-5 h-5 items-center justify-center">{phaseIcon()}</span>
            <h2 className="text-base font-extrabold text-white">AI-официант</h2>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              phase === 'dormant' ? 'bg-zinc-800 text-zinc-500' :
              phase === 'listening' ? 'bg-green-900/30 text-green-400' :
              phase === 'confirming' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-orange-900/30 text-orange-400'
            }`}>{phaseLabel()}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHelp(!showHelp)} className="p-2 rounded-xl hover:bg-zinc-800"><HelpCircle size={16} className="text-zinc-500" /></button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800"><X size={16} className="text-zinc-500" /></button>
          </div>
        </div>

        {/* ─── Toast ───────────────────────────────── */}
        {message && (
          <div className={`mx-5 mt-3 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0 ${
            msgType === 'success' ? 'bg-green-900/30 text-green-400' :
            msgType === 'error' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'
          }`}>{message}</div>
        )}

        {/* ─── Content ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {showHelp && (
            <div className="bg-zinc-800/50 rounded-2xl p-4 space-y-1.5">
              <p className="text-xs font-semibold text-zinc-400 mb-2">Как работать:</p>
              {HELP_TEXT.map((h, i) => <p key={i} className="text-sm text-zinc-300">{h}</p>)}
              <p className="text-[10px] text-zinc-600 mt-3">Система реагирует только после «Принять заказ». Работает 15 секунд. Игнорирует шум и посторонние разговоры.</p>
            </div>
          )}

          {/* ─── Status indicator ──────────────────── */}
          {phase === 'dormant' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <Ear size={36} className="text-zinc-500" />
              </div>
              <p className="text-zinc-400 text-sm mb-1">Система в режиме ожидания</p>
              <p className="text-xs text-zinc-600">Скажите <strong>«Принять заказ»</strong> для активации</p>
            </div>
          )}

          {phase === 'listening' && (
            <div className="text-center py-4">
              <div className="flex justify-center gap-1.5 mb-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-xs text-zinc-500">Говорите блюда и команды</p>
              {lastTranscript && <p className="text-sm text-zinc-400 mt-2 italic">«{lastTranscript}»</p>}
            </div>
          )}

          {phase === 'confirming' && (
            <div className="bg-yellow-900/20 rounded-2xl p-4 text-center ring-1 ring-yellow-500/20">
              <Volume2 size={24} className="mx-auto text-yellow-400 mb-2" />
              <p className="text-sm text-yellow-300 font-semibold">Подтвердите заказ</p>
              <p className="text-xs text-yellow-500 mt-1">Скажите «Подтверждаю» или «Заново»</p>
            </div>
          )}

          {/* ─── Draft ─────────────────────────────── */}
          {draft && draft.items.length > 0 && (
            <div className="bg-zinc-800/30 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ClipboardList size={14} className="text-orange-400" />
                  Заказ
                </h3>
                <span className="text-xs text-zinc-500">{draft.items.length} поз. / {draftTotal}₽</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {draft.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {item.found ? <CheckCircle size={12} className="text-green-500 shrink-0" /> : <AlertTriangle size={12} className="text-yellow-500 shrink-0" />}
                      <span className="text-sm text-white truncate">{item.name}</span>
                    </div>
                    <span className="text-sm text-zinc-400 ml-2">×{item.quantity}</span>
                  </div>
                ))}
              </div>
              {draft.tableId && <p className="text-xs text-zinc-600 mt-2">📍 Стол {getTableName(draft.tableId)}</p>}
            </div>
          )}

          {errorMsg && <div className="bg-red-900/20 rounded-2xl p-3 text-sm text-red-400 text-center">{errorMsg}</div>}

          {/* ─── Listening history ─────────────────── */}
          {listenedChunks.length > 0 && (
            <div className="text-xs text-zinc-600 space-y-0.5">
              <p className="text-[10px] text-zinc-700 font-semibold">История:</p>
              {listenedChunks.map((c, i) => <p key={i} className="truncate">• {c}</p>)}
            </div>
          )}
        </div>

        {/* ─── Controls ─────────────────────────────— */}
        <div className="shrink-0 border-t border-zinc-800 p-4 space-y-2">
          {phase === 'dormant' ? (
            <button onClick={startSystem}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-3.5 rounded-2xl text-base active:scale-[0.98] flex items-center justify-center gap-2">
              🎤 Запустить
            </button>
          ) : (
            <div className="flex gap-2">
              {phase === 'listening' && (
                <>
                  <button onClick={handleConfirmNow} disabled={!draft?.items.length}
                    className="flex-1 bg-green-600 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-40">
                    <Send size={16} /> Оформить
                  </button>
                  <button onClick={clearDraft}
                    className="flex-1 bg-red-600/20 text-red-400 font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5">
                    <Trash2 size={16} /> Очистить
                  </button>
                </>
              )}
              {phase === 'confirming' && (
                <button onClick={handleConfirmNow}
                  className="w-full bg-green-600 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5">
                  <CheckCircle size={16} /> Подтвердить
                </button>
              )}
              <button onClick={shutdown}
                className="px-4 py-3 bg-zinc-800 text-zinc-400 rounded-2xl text-sm flex items-center justify-center">
                <MicOff size={16} />
              </button>
            </div>
          )}
          <p className="text-[10px] text-zinc-600 text-center">
            🔊 Шумоподавление включено. Ключевая фраза: «Принять заказ»
          </p>
        </div>
      </div>
    </div>
  );
}
