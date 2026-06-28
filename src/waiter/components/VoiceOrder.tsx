import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, CheckCircle, AlertTriangle, X, Loader2, Volume2, Trash2, HelpCircle, ClipboardList, Ear, User } from 'lucide-react';
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

// ─── Activation phrases — only these trigger listening ──
const WAKE_PHRASES = ['принять заказ', 'прими заказ', 'алиса прими заказ', 'алиса принять заказ'];

const STOP_PHRASES = ['стоп', 'хватит', 'остановись', 'закончили'];

const CONFIRM_WORDS = ['да', 'подтверждаю', 'верно', 'давай', 'отправляй', 'оформляй', 'отправь'];

const REJECT_WORDS = ['нет', 'неверно', 'отмена', 'заново', 'повтори'];

const GOODBYE_WORDS = ['привет', 'здравствуйте', 'спасибо', 'благодарю', 'пожалуйста', 'добрый день', 'добрый вечер', 'до свидания', 'пока', 'окей', 'хорошо', 'ладно', 'понял', 'поняла', 'извините', 'простите', 'будьте добры', 'можно'];

// ─── Listening timeout (ms) after wake word ────────────
const LISTEN_TIMEOUT_MS = 15000;

// ─── Silence pause before auto-confirm prompt (ms) ─────
const SILENCE_CONFIRM_MS = 3000;

// ─── Noise threshold (0-255, lower = quieter) ─────────
const NOISE_THRESHOLD = 70;

// ─── Max high-noise pauses before re-prompt ────────────
const MAX_NOISE_BURSTS = 3;

// ─── Help text ─────────────────────────────────────────
const HELP_TEXT = [
  '🔑 Скажите «Алиса, прими заказ» для активации',
  '🎤 После триггера называйте: «Стол 5, паста Карбонара, кола»',
  '📝 «Подтверди» — отправить на кухню',
  '💰 «Оплатить чек 128» — приём оплаты',
  '❌ «Стоп» или «Отмена» — сбросить и выключить',
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
  const [waiterName, setWaiterName] = useState(user?.firstName || user?.username || 'Официант');
  const [queue, setQueue] = useState<any[]>([]);
  const [showWaiterSwitch, setShowWaiterSwitch] = useState(false);

  // ─── Refs ────────────────────────────────────────────
  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const wakeTimerRef = useRef<any>(null);
  const draftIdRef = useRef<string | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const lastSpeechRef = useRef(0);
  const confirmTimerRef = useRef<any>(null);
  const listenTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  // Callback refs to break dependency cycles between useCallbacks
  const handleConfirmNowRef = useRef<() => void>(() => {});
  const clearDraftRef = useRef<() => void>(() => {});
  const shutdownRef = useRef<() => void>(() => {});
  const activateListeningRef = useRef<(analyser: AnalyserNode) => void>(() => {});
  const customNameRef = useRef<HTMLInputElement>(null);
  const restartTimerRef = useRef<any>(null);
  const waiterNameRef = useRef(user?.firstName || user?.username || 'Официант');

  // ─── Sync waiterNameRef ────────────────────────────
  useEffect(() => { waiterNameRef.current = waiterName; }, [waiterName]);

  // ─── Poll queue ────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try { const r = await api.voiceQueue(user?.id); setQueue(r.queue || []); } catch {}
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [user?.id]);

  // ─── Build menu lookup with fuzzy matching ──────────
  const menuMap = useRef<MenuLookup>({});
  const menuNamesList = useRef<string[]>([]);

  useEffect(() => {
    const map: MenuLookup = {};
    const names: string[] = [];
    for (const d of dishes) {
      const key = d.name.toLowerCase().trim();
      map[key] = { id: d.id, name: d.name, price: d.price };
      names.push(key);
    }
    // Sort longest first — longer name matches take priority over substrings
    names.sort((a, b) => b.length - a.length);
    menuMap.current = map;
    menuNamesList.current = names;
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

  // ─── Test noise level (average frequency amplitude) ─
  const isTooNoisy = useCallback((analyser: AnalyserNode): boolean => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return avg > NOISE_THRESHOLD;
  }, []);

  // ─── Extract menu items from raw text (longest match priority) ──
  const extractMenuItems = useCallback((text: string): string[] => {
    const lower = text.toLowerCase();
    const found: string[] = [];
    const used = new Set<number>();
    for (const name of menuNamesList.current) {
      const idx = lower.indexOf(name);
      if (idx !== -1 && !used.has(idx)) {
        found.push(name);
        used.add(idx);
      }
    }
    // Return matches in order of appearance
    return found.sort((a, b) => lower.indexOf(a) - lower.indexOf(b));
  }, []);

  // ─── Check if text contains any menu item ───────────
  const hasMenuItems = useCallback((text: string): boolean => {
    return extractMenuItems(text).length > 0;
  }, [extractMenuItems]);

  // ─── Check for wake word (strict — requires full key phrase) ──
  const isWakeWord = useCallback((text: string): boolean => {
    const lower = text.toLowerCase().trim();
    // Must match a full key phrase, not just "алиса" alone
    if (WAKE_PHRASES.some(p => lower.includes(p))) return true;
    // If text starts with alias but no full phrase — ignore
    return false;
  }, []);

  // ─── Check for stop/confirm/reject commands ─────────
  const isStopCommand = useCallback((text: string): boolean => {
    const lower = text.toLowerCase().trim();
    return STOP_PHRASES.some(p => lower.includes(p));
  }, []);

  const isConfirmCommand = useCallback((text: string): boolean => {
    const lower = text.toLowerCase().trim();
    return CONFIRM_WORDS.some(p => lower.includes(p));
  }, []);

  const isRejectCommand = useCallback((text: string): boolean => {
    const lower = text.toLowerCase().trim();
    return REJECT_WORDS.some(p => lower.includes(p));
  }, []);

  // ─── Filter non-order words (greetings, polite words) ──
  const filterNoise = useCallback((text: string): string => {
    let result = text.toLowerCase();
    for (const word of GOODBYE_WORDS) {
      result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    }
    return result.replace(/\s+/g, ' ').trim();
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

  // ─── Create SpeechRecognition instance ──────────────
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

  // ─── Start system — begin listening immediately (no wake word) ──
  const startSystem = useCallback(async () => {
    if (activeRef.current) return;
    try {
      setErrorMsg('');
      setPhase('processing');
      const audio = await startAudio();
      if (!audio) {
        setPhase('dormant');
        setErrorMsg('Нет доступа к микрофону. Разрешите доступ в настройках браузера.');
        speak('Нет доступа к микрофону');
        return;
      }
      activeRef.current = true;
      activateListeningRef.current(audio.analyser);
    } catch (e: any) {
      setPhase('dormant');
      setErrorMsg('Ошибка запуска микрофона: ' + (e?.message || ''));
    }
  }, [startAudio, speak]);

  // ─── Activate listening (after wake word) ────────────
  const activateListening = useCallback((analyser: AnalyserNode) => {
    setPhase('listening');
    lastSpeechRef.current = Date.now();

    // Auto-timeout — return to dormant after LISTEN_TIMEOUT_MS of silence
    const scheduleTimeout = () => {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = setTimeout(() => {
        const d = draftRef.current;
        if (d && d.items.length > 0) {
          setPhase('confirming');
          const names = d.items.map(i => `${i.name} ×${i.quantity}`).join(', ');
          speak(`Ваш заказ: ${names}. Подтвердить?`);
        } else {
          speak('Время вышло. Скажите «Принять заказ» для нового заказа.');
          shutdownRef.current();
        }
      }, LISTEN_TIMEOUT_MS);
    };

    speak('Слушаю. Говорите заказ.');

    // Create draft
    api.voiceDraftCreate(user.id, waiterNameRef.current).then(r => {
      draftIdRef.current = r.draftId;
      draftRef.current = r.draft;
      setDraft(r.draft);
    }).catch(() => {});

    const listeningRec = startRecognition(true, true);
    if (!listeningRec) {
      setPhase('dormant');
      setErrorMsg('Голосовой ввод не поддерживается этим браузером. Используйте Chrome/Android.');
      speak('Голосовой ввод не поддерживается');
      return;
    }

    listeningRec.onresult = (event: any) => {
      if (!activeRef.current) return;

      lastSpeechRef.current = Date.now();
      scheduleTimeout();

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim();
        if (!text) continue;

        // Interim result — show on UI only
        if (!event.results[i].isFinal) {
          setLastTranscript(text);
          continue;
        }

        // Final transcript — process
        const filtered = filterNoise(text);
        if (!filtered) continue;

        const lower = filtered.toLowerCase();
        const d = draftRef.current;

        // ── Priority: commands ────────────────────
        if (isStopCommand(lower)) { shutdownRef.current(); return; }
        if (isRejectCommand(lower) && d && d.items.length > 0) {
          clearDraftRef.current();
          speak('Заказ сброшен. Начните заново.');
          return;
        }
        if (isConfirmCommand(lower) && d && d.items.length > 0) {
          handleConfirmNowRef.current();
          setPhase('listening');
          return;
        }

        // ── Check for menu items or table/check ref ──
        const foundItems = extractMenuItems(filtered);
        const hasTableRef = lower.includes('стол');
        const hasCheckRef = lower.includes('чек') || lower.includes('оплата') || lower.includes('закрыть') || lower.includes('возврат');

        if (foundItems.length === 0 && !hasTableRef && !hasCheckRef) {
          // No menu items — ask to repeat
          speak('Блюдо не найдено. Повторите.');
          continue;
        }

        // ── Process valid speech chunk ────────────
        setListenedChunks(prev => [...prev, filtered]);
        processChunk(filtered);

        // Schedule auto-confirm prompt after silence
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = setTimeout(() => {
          const d2 = draftRef.current;
          if (d2 && d2.items.length > 0) {
            const names = d2.items.map(i => `${i.name} ×${i.quantity}`).join(', ');
            speak(`В черновике: ${names}. Скажите «Подтверждаю» или «Заново».`);
            setPhase('confirming');
          }
        }, SILENCE_CONFIRM_MS);

        scheduleTimeout();
      }
    };

    listeningRec.onerror = (event: any) => {
      console.log('[VoiceOrder] recognition error', event.error);
      // no-speech is normal when user pauses; restart handles it
      if (event.error === 'not-allowed') {
        setErrorMsg('Микрофон заблокирован браузером');
        activeRef.current = false;
        return;
      }
      if (event.error === 'audio-capture') {
        setErrorMsg('Не удалось получить звук с микрофона');
      }
    };

    listeningRec.onend = () => {
      if (!activeRef.current) return;
      // Small delay before restart to avoid tight loops / browser throttling
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (activeRef.current && listeningRec) {
          try { listeningRec.start(); } catch {}
        }
      }, 400);
    };

    try {
      listeningRec.start();
    } catch {
      setErrorMsg('Ошибка старта распознавания');
      return;
    }
    recognitionRef.current = listeningRec;
  }, [user.id, speak, filterNoise, isStopCommand, isConfirmCommand, isRejectCommand, extractMenuItems]);
  activateListeningRef.current = activateListening;

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
          draftRef.current = updated.draft;
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
          handleConfirmNowRef.current();
          break;
        case 'pay':
          await handlePayNow(parsed);
          break;
        case 'close':
          await handleCloseNow(parsed);
          break;
        case 'cancel':
          clearDraftRef.current();
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
              draftRef.current = updated.draft;
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
      draftRef.current = null;
      setDraft(null);
      setListenedChunks([]);
      speak(`Заказ №${result.orderId} отправлен на кухню`);
      showMsg(`✅ Заказ №${result.orderId} на кухне`, 'success');
      onOrderCreated();
      // New draft
      const r = await api.voiceDraftCreate(user.id, waiterNameRef.current);
      draftIdRef.current = r.draftId;
      draftRef.current = r.draft;
      setDraft(r.draft);
    } catch { speak('Ошибка отправки'); }
  }, [user.id, speak, showMsg, onOrderCreated]);
  handleConfirmNowRef.current = handleConfirmNow;
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
    draftRef.current = null;
    setDraft(null);
    setListenedChunks([]);
    speak('Черновик очищен');
    const r = await api.voiceDraftCreate(user.id, waiterNameRef.current);
    draftIdRef.current = r.draftId;
    draftRef.current = r.draft;
    setDraft(r.draft);
  }, [user.id, speak]);
  clearDraftRef.current = clearDraft;

  // ─── Shutdown everything ────────────────────────────
  const shutdown = useCallback(() => {
    activeRef.current = false;
    clearTimeout(wakeTimerRef.current);
    clearTimeout(confirmTimerRef.current);
    clearTimeout(listenTimerRef.current);
    clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.onerror = null; recognitionRef.current.stop(); } catch {}
    }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); }
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch {} }
    draftIdRef.current = null;
    draftRef.current = null;
    setDraft(null);
    setPhase('dormant');
    setListenedChunks([]);
    speak('Голосовой режим выключен');
  }, [speak]);
  shutdownRef.current = shutdown;

  // ─── Auto-start listening when modal opens ──────────────────
  useEffect(() => {
    const t = setTimeout(() => startSystem(), 300);
    return () => {
      clearTimeout(t);
      shutdown();
    };
  }, [startSystem, shutdown]);

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
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex w-5 h-5 items-center justify-center shrink-0">{phaseIcon()}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">AI-официант</h2>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  phase === 'dormant' ? 'bg-zinc-800 text-zinc-500' :
                  phase === 'listening' ? 'bg-green-900/30 text-green-400' :
                  phase === 'confirming' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-orange-900/30 text-orange-400'
                }`}>{phaseLabel()}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <span>👤 {waiterName}</span>
                {(() => {
                  const myQueue = queue.filter(d => d.waiterId === user?.id);
                  const allWaiting = queue.length;
                  return allWaiting > 0 ? <span>📋 {myQueue.length}/{allWaiting}</span> : null;
                })()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShowWaiterSwitch(!showWaiterSwitch)} className="p-2 rounded-xl hover:bg-zinc-800" title="Сменить официанта"><User size={14} className="text-zinc-500" /></button>
            <button onClick={() => setShowHelp(!showHelp)} className="p-2 rounded-xl hover:bg-zinc-800"><HelpCircle size={14} className="text-zinc-500" /></button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800"><X size={14} className="text-zinc-500" /></button>
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
          {showWaiterSwitch && (
            <div className="bg-zinc-800/50 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-400">Сменить официанта</p>
              <p className="text-xs text-zinc-500">Текущий: <strong className="text-zinc-300">{waiterName}</strong></p>
              {tables.length > 4 && (
                <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
                  {tables.filter(t => t.assignee || t.waiterId).map(t => (
                    <button key={t.id} onClick={() => { setWaiterName(t.assignee || `Стол ${t.name}`); setShowWaiterSwitch(false); }}
                      className="bg-zinc-700/40 hover:bg-zinc-700 rounded-xl px-2 py-2 text-xs text-zinc-300 truncate">
                      {t.assignee || t.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input ref={customNameRef} placeholder="Имя официанта" maxLength={30}
                  className="flex-1 bg-zinc-800 rounded-xl px-3 py-2 text-sm text-white border border-zinc-700 outline-none focus:border-orange-500" />
                <button onClick={() => { const v = customNameRef.current?.value?.trim(); if (v) { setWaiterName(v); setShowWaiterSwitch(false); } }}
                  className="bg-orange-600 text-white rounded-xl px-3 py-2 text-xs font-semibold">OK</button>
              </div>
              <button onClick={() => setShowWaiterSwitch(false)} className="text-[10px] text-zinc-600 underline">Закрыть</button>
            </div>
          )}

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
            <div className="text-center py-3">
              <div className="flex justify-center gap-1.5 mb-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-xs text-zinc-500">Говорите блюда и команды</p>
              {lastTranscript && (
                <div className="mt-2 inline-block bg-zinc-800/60 rounded-xl px-3 py-1.5 max-w-full">
                  <p className="text-sm text-zinc-300 truncate">«{lastTranscript}»</p>
                </div>
              )}
              {listenedChunks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 justify-center max-h-20 overflow-y-auto">
                  {listenedChunks.map((c, i) => {
                    const matched = extractMenuItems(c).length > 0;
                    return <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full truncate max-w-[140px] ${matched ? 'bg-green-900/30 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>{matched ? '✓' : '?'} {c}</span>;
                  })}
                </div>
              )}
            </div>
          )}

          {phase === 'confirming' && (
            <div className="bg-yellow-900/20 rounded-2xl p-4 text-center ring-1 ring-yellow-500/30">
              <Volume2 size={24} className="mx-auto text-yellow-400 mb-2" />
              <p className="text-sm text-yellow-300 font-semibold">Подтвердите заказ</p>
              <p className="text-xs text-yellow-500 mt-1">Скажите «Подтверждаю» или «Заново»</p>
              {lastResult && lastResult.unrecognized?.length > 0 && (
                <div className="mt-3 bg-zinc-800/50 rounded-xl px-3 py-2">
                  <p className="text-[10px] text-zinc-500">Нераспознано:</p>
                  <p className="text-xs text-zinc-400">{lastResult.unrecognized.join(', ')}</p>
                </div>
              )}
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
                {draft.items.map((item, idx) => {
                  const mods = item.modifiers?.length ? item.modifiers.join(', ') : '';
                  const excs = item.exclude?.length ? `без ${item.exclude.join(', без ')}` : '';
                  const opts = [mods, excs].filter(Boolean).join('; ');
                  return <div key={idx} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {item.found ? <CheckCircle size={12} className="text-green-500 shrink-0" /> : <AlertTriangle size={12} className="text-yellow-500 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-white truncate block">{item.name}</span>
                        {opts && <span className="text-[10px] text-zinc-500 truncate block">{opts}</span>}
                      </div>
                    </div>
                    <span className="text-sm text-zinc-400 ml-2 shrink-0">×{item.quantity}</span>
                  </div>;
                })}
              </div>
              {draft.tableId && <p className="text-xs text-zinc-600 mt-2">📍 Стол {getTableName(draft.tableId)}</p>}
            </div>
          )}

          {errorMsg && <div className="bg-red-900/20 rounded-2xl p-3 text-sm text-red-400 text-center">{errorMsg}</div>}

          {/* ─── Last parsed result ───────────────── */}
          {lastResult && phase !== 'confirming' && (
            <div className="bg-zinc-800/20 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-zinc-600 font-semibold">AI: {lastResult.command}</span>
                {lastResult.table_number && <span className="text-[10px] text-zinc-600">Стол {lastResult.table_number}</span>}
              </div>
              {lastResult.unrecognized?.length > 0 && (
                <p className="text-[10px] text-zinc-600">? {lastResult.unrecognized.join(', ')}</p>
              )}
            </div>
          )}

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
