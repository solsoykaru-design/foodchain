import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, CheckCircle, AlertTriangle, X, RefreshCw, Loader2, Volume2, Trash2, DollarSign, Ban, Undo2, HelpCircle, Plus, ClipboardList } from 'lucide-react';
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
  onOrderCreated: () => void;
  onClose: () => void;
}

// ─── Help text ────────────────────────────────────────────
const HELP_TEXT = [
  '🎤 Добавить в заказ: «Стол 5, паста Карбонара, кола 0.5»',
  '📝 Оформить: «Оформляй заказ»',
  '💰 Оплатить: «Оплата заказа 128»',
  '🔒 Закрыть: «Закрыть заказ 128»',
  '🗑 Отменить черновик: «Отмена заказа»',
  '↩️ Возврат: «Возврат по заказу 128»',
  '❓ Помощь: «Что ты умеешь?»',
];

export default function VoiceOrder({ user, tables, onOrderCreated, onClose }: Props) {
  const [mode, setMode] = useState<'idle' | 'listening' | 'processing' | 'confirm'>('idle');
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResult, setLastResult] = useState<ParsedResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const draftIdRef = useRef<string | null>(null);

  // ─── Text-to-Speech ─────────────────────────────────────
  const speak = useCallback((text: string) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }, []);

  // ─── Toast ─────────────────────────────────────────────
  const showStatus = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage(msg);
    setStatusType(type);
    setTimeout(() => setStatusMessage(''), 4000);
  }, []);

  // ─── Restart recognition in continuous mode ─────────────
  const restartRecognition = useCallback(() => {
    if (!isListeningRef.current) return;
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setMode('listening');
      };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript;
            handleVoiceText(text);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          setTimeout(restartRecognition, 500);
          return;
        }
        setErrorMsg(`Ошибка микрофона: ${event.error}. Перезапустите.`);
        setMode('idle');
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        if (isListeningRef.current) setTimeout(restartRecognition, 300);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {}
  }, []);

  // ─── Start listening ────────────────────────────────────
  const startListening = useCallback(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setErrorMsg('Голосовое распознавание не поддерживается в этом браузере');
        speak('Голосовое распознавание не поддерживается');
        return;
      }
      isListeningRef.current = true;
      showStatus('🎤 Слушаю в фоне. Говорите команды...', 'info');
      speak('Голосовой режим активирован. Говорите заказы или команды.');
      // Create draft
      api.voiceDraftCreate(user.id).then(r => {
        draftIdRef.current = r.draftId;
        setDraft(r.draft);
      }).catch(() => {});
      restartRecognition();
    } catch (e: any) {
      setErrorMsg('Ошибка микрофона: ' + e.message);
    }
  }, [user.id, restartRecognition, showStatus, speak]);

  // ─── Stop listening ─────────────────────────────────────
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setMode('idle');
  }, []);

  // ─── Process voice text via AI ──────────────────────────
  const handleVoiceText = async (text: string) => {
    setLastTranscript(text);
    setMode('processing');
    try {
      const result = await api.request('/api/mobile/voice-order', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });

      if (!result.success) {
        speak('Не удалось распознать. Повторите.');
        setMode('listening');
        return;
      }

      const parsed: ParsedResult = result.parsed;
      setLastResult(parsed);

      switch (parsed.command) {
        case 'order':
          await handleOrderCommand(parsed);
          break;
        case 'confirm':
          await handleConfirmCommand();
          break;
        case 'pay':
          await handlePayCommand(parsed);
          break;
        case 'close':
          await handleCloseCommand(parsed);
          break;
        case 'cancel':
          await handleCancelCommand();
          break;
        case 'refund':
          await handleRefundCommand(parsed);
          break;
        case 'help':
          setShowHelp(true);
          speak(HELP_TEXT.slice(0, 3).join('. '));
          break;
        default:
          speak('Команда не распознана. Повторите.');
          showStatus('❓ Команда не распознана', 'error');
      }
    } catch (e: any) {
      speak('Ошибка связи. Повторите.');
      showStatus('Ошибка: ' + e.message, 'error');
    }
    setMode('listening');
  };

  // ─── Handle order content ───────────────────────────────
  const handleOrderCommand = async (parsed: ParsedResult) => {
    const draftId = draftIdRef.current;
    if (!draftId) {
      const r = await api.voiceDraftCreate(user.id);
      draftIdRef.current = r.draftId;
      setDraft(r.draft);
    }
    const items = (parsed.items || []).map(item => ({
      ...item,
      menu_match: findDishMatch(item.name),
      found: !!findDishMatch(item.name),
    }));

    await api.voiceDraftAddItems(draftIdRef.current!, items, parsed.table_number || undefined);
    const updated = await api.voiceDraftGet(draftIdRef.current!);
    setDraft(updated.draft);

    const itemCount = items.length;
    const tableStr = parsed.table_number ? ` на стол ${parsed.table_number}` : '';
    const names = items.map(i => i.name).join(', ');
    speak(`Принято${tableStr}: ${names}`);
    showStatus(`✅ Добавлено: ${names}`, 'success');
  };

  // ─── Handle confirm ─────────────────────────────────────
  const handleConfirmCommand = async () => {
    const draftId = draftIdRef.current;
    if (!draftId) {
      speak('Нет черновика для оформления');
      showStatus('Нет черновика', 'error');
      return;
    }
    const draftData = await api.voiceDraftGet(draftId);
    if (!draftData.draft.items.length) {
      speak('Черновик пуст. Добавьте блюда.');
      showStatus('Черновик пуст', 'error');
      return;
    }
    const result = await api.voiceConfirm(draftId, user.id, `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username);
    draftIdRef.current = null;
    setDraft(null);
    speak(`Заказ №${result.orderId} отправлен на кухню`);
    showStatus(`✅ Заказ №${result.orderId} отправлен на кухню`, 'success');
    onOrderCreated();
    // Create new draft for continued work
    const r = await api.voiceDraftCreate(user.id);
    draftIdRef.current = r.draftId;
    setDraft(r.draft);
  };

  // ─── Handle pay ─────────────────────────────────────────
  const handlePayCommand = async (parsed: ParsedResult) => {
    const checkNum = parsed.check_id || parsed.table_number;
    if (!checkNum) {
      speak('Укажите номер чека. Например: оплата чека 128');
      showStatus('Укажите номер чека', 'error');
      return;
    }
    try {
      const result = await api.voicePay(checkNum);
      speak(`Чек ${checkNum} оплачен`);
      showStatus(`💰 Чек №${checkNum} оплачен`, 'success');
      onOrderCreated();
    } catch (e: any) {
      speak(`Чек ${checkNum} не найден`);
      showStatus(`Чек №${checkNum} не найден`, 'error');
    }
  };

  // ─── Handle close ───────────────────────────────────────
  const handleCloseCommand = async (parsed: ParsedResult) => {
    const checkNum = parsed.check_id || parsed.table_number;
    if (!checkNum) {
      speak('Укажите номер чека. Например: закрыть чек 128');
      showStatus('Укажите номер чека', 'error');
      return;
    }
    try {
      const result = await api.voiceClose(checkNum);
      speak(`Чек ${checkNum} закрыт`);
      showStatus(`🔒 Чек №${checkNum} закрыт`, 'success');
      onOrderCreated();
    } catch (e: any) {
      speak(`Чек ${checkNum} не найден`);
      showStatus(`Чек №${checkNum} не найден`, 'error');
    }
  };

  // ─── Handle cancel ──────────────────────────────────────
  const handleCancelCommand = async () => {
    const draftId = draftIdRef.current;
    if (!draftId) {
      speak('Нет активного черновика для отмены');
      showStatus('Нет черновика', 'error');
      return;
    }
    await api.voiceCancel(undefined, draftId);
    draftIdRef.current = null;
    setDraft(null);
    speak('Черновик отменён');
    showStatus('🗑 Черновик удалён', 'success');
    // Create new draft
    const r = await api.voiceDraftCreate(user.id);
    draftIdRef.current = r.draftId;
    setDraft(r.draft);
  };

  // ─── Handle refund ──────────────────────────────────────
  const handleRefundCommand = async (parsed: ParsedResult) => {
    const checkNum = parsed.check_id || parsed.table_number;
    if (!checkNum) {
      speak('Укажите номер чека. Например: возврат по чеку 128');
      showStatus('Укажите номер чека', 'error');
      return;
    }
    try {
      const result = await api.voiceRefund(checkNum, 'Возврат голосом');
      speak(`Возврат по чеку ${checkNum} выполнен`);
      showStatus(`↩️ Возврат по чеку №${checkNum} выполнен`, 'success');
      onOrderCreated();
    } catch (e: any) {
      speak(`Чек ${checkNum} не найден`);
      showStatus(`Чек №${checkNum} не найден`, 'error');
    }
  };

  // ─── Match dish name against menu ───────────────────────
  const findDishMatch = (name: string): { id: number; name: string; price: number } | null => {
    const lower = name.toLowerCase();
    const menuDishes = tables.length > 0 ? [] : [];
    // We don't have dishes here directly, we'll rely on the backend match
    return null;
  };

  // ─── Cleanup on unmount ────────────────────────────────
  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  // ─── Get table name by id ──────────────────────────────
  const getTableName = (id: number | null) => {
    if (!id) return '';
    const t = tables.find(t => t.id === id || t.name === String(id));
    return t?.name || String(id);
  };

  // ─── Calculate draft total ─────────────────────────────
  const draftTotal = draft?.items.reduce((s, i) => s + (i.menu_match?.price || 0) * i.quantity, 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-zinc-900 rounded-3xl w-full max-w-lg max-h-[95vh] flex flex-col">
        {/* ─── Header ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            {mode === 'listening' ? (
              <span className="relative flex w-3 h-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
            ) : <Mic size={18} className="text-orange-500" />}
            AI-официант
            {mode === 'listening' && <span className="text-[10px] text-green-400 font-normal">в фоне</span>}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHelp(!showHelp)} className="p-2 rounded-xl hover:bg-zinc-800">
              <HelpCircle size={16} className="text-zinc-500" />
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800">
              <X size={16} className="text-zinc-500" />
            </button>
          </div>
        </div>

        {/* ─── Toast ──────────────────────────────────── */}
        {statusMessage && (
          <div className={`mx-5 mt-3 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0 ${
            statusType === 'success' ? 'bg-green-900/30 text-green-400' :
            statusType === 'error' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'
          }`}>
            {statusMessage}
          </div>
        )}

        {/* ─── Scrollable content ─────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ─── Help panel ───────────────────────────── */}
          {showHelp && (
            <div className="bg-zinc-800/50 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-400 mb-2">Голосовые команды:</p>
              {HELP_TEXT.map((h, i) => (
                <p key={i} className="text-sm text-zinc-300">{h}</p>
              ))}
              <p className="text-[10px] text-zinc-600 mt-3">
                Микрофон работает в фоне — говорите команды последовательно, без повторного нажатия кнопки.
              </p>
              <p className="text-[10px] text-zinc-600">
                Bluetooth-гарнитура: подключите наушники с микрофоном, приложение будет слышать через них.
              </p>
            </div>
          )}

          {/* ─── Draft display ────────────────────────── */}
          {draft && draft.items.length > 0 && (
            <div className="bg-zinc-800/30 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ClipboardList size={14} className="text-orange-400" />
                  Черновик
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  {draft.tableId && (
                    <span className="text-zinc-400">📍 Стол {getTableName(draft.tableId)}</span>
                  )}
                  <span className="text-zinc-500">{draft.items.length} поз. / {draftTotal}₽</span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {draft.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {item.found
                        ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                        : <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
                      }
                      <span className="text-sm text-white truncate">{item.name}</span>
                    </div>
                    <span className="text-sm text-zinc-400 ml-2">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Last transcript ──────────────────────── */}
          {lastTranscript && (
            <div className="bg-zinc-800/30 rounded-2xl p-3">
              <p className="text-[10px] text-zinc-600 mb-1">Распознано:</p>
              <p className="text-sm text-zinc-300 italic">«{lastTranscript}»</p>
            </div>
          )}

          {/* ─── Error ────────────────────────────────── */}
          {errorMsg && (
            <div className="bg-red-900/20 rounded-2xl p-4 text-sm text-red-400 text-center">
              {errorMsg}
            </div>
          )}

          {/* ─── Idle / not started ─────────────────────── */}
          {mode === 'idle' && !isListeningRef.current && (
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
                <Mic size={36} className="text-orange-500" />
              </div>
              <p className="text-zinc-400 text-sm mb-1">Нажмите «Начать» для активации</p>
              <p className="text-xs text-zinc-600">Микрофон будет работать в фоновом режиме</p>
              <p className="text-xs text-zinc-600 mt-2">Говорите заказы, затем «Оформляй заказ»</p>
            </div>
          )}

          {/* ─── Listening ──────────────────────────────── */}
          {mode === 'listening' && (
            <div className="text-center py-4">
              <div className="flex justify-center gap-1.5 mb-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-xs text-zinc-500">Слушаю... Говорите заказ или команду</p>
            </div>
          )}

          {/* ─── Processing ──────────────────────────────── */}
          {mode === 'processing' && (
            <div className="text-center py-4">
              <Loader2 size={24} className="mx-auto text-orange-500 animate-spin mb-2" />
              <p className="text-xs text-zinc-500">Обработка...</p>
            </div>
          )}

          {/* ─── Quick commands (when listening) ─────────── */}
          {mode === 'listening' && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleVoiceText('Оформляй заказ')}
                className="bg-green-600/20 hover:bg-green-600/30 text-green-400 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                <Send size={14} /> Оформить
              </button>
              <button onClick={() => handleVoiceText('Отмена заказа')}
                className="bg-red-600/20 hover:bg-red-600/30 text-red-400 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                <Trash2 size={14} /> Отмена
              </button>
            </div>
          )}

          {/* ─── Quick status info ──────────────────────── */}
          {draft && draft.items.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-1">
              <span className="text-[10px] text-zinc-600">В черновике {draft.items.length} позиций на {draftTotal}₽</span>
            </div>
          )}
        </div>

        {/* ─── Bottom controls ─────────────────────────── */}
        <div className="shrink-0 border-t border-zinc-800 p-4">
          {!isListeningRef.current ? (
            <button onClick={startListening}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-3.5 rounded-2xl text-base active:scale-[0.98] flex items-center justify-center gap-2">
              <Mic size={20} /> 🎤 Начать
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={stopListening}
                className="flex-1 bg-zinc-800 text-zinc-400 font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5">
                <MicOff size={16} /> Выкл
              </button>
              <button onClick={async () => {
                await handleConfirmCommand();
              }} disabled={!draft?.items.length}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-40">
                <Send size={16} /> Оформить
              </button>
            </div>
          )}
          <p className="text-[10px] text-zinc-600 text-center mt-2">
            {isListeningRef.current
              ? '🎤 Микрофон активен. Bluetooth-гарнитура: подключите и говорите'
              : 'Рекомендуется Bluetooth-гарнитура для работы в зале'}
          </p>
        </div>
      </div>
    </div>
  );
}
