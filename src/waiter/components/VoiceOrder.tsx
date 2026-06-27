import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, CheckCircle, AlertTriangle, X, RefreshCw, Loader2, Volume2 } from 'lucide-react';
import * as api from '../../api';

interface VoiceOrderItem {
  name: string;
  quantity: number;
  modifiers: string[];
  exclude: string[];
  menu_match: { id: number; name: string; price: number } | null;
  found: boolean;
}

interface ParsedOrder {
  waiter_nick: string | null;
  table_number: number | null;
  items: VoiceOrderItem[];
  unrecognized: string[];
}

interface Props {
  user: any;
  onOrderCreated: () => void;
  onClose: () => void;
}

export default function VoiceOrder({ user, onOrderCreated, onClose }: Props) {
  const [state, setState] = useState<'idle' | 'listening' | 'processing' | 'confirm' | 'sending' | 'done' | 'error'>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsedOrder, setParsedOrder] = useState<ParsedOrder | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [editableItems, setEditableItems] = useState<VoiceOrderItem[]>([]);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const recognitionRef = useRef<any>(null);

  const speak = useCallback((text: string) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    } catch {}
  }, []);

  // Load tables for table selection
  useEffect(() => {
    api.getTables().then(setTables).catch(() => {});
  }, []);

  // Start voice recognition
  const startListening = useCallback(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setErrorMsg('Голосовое распознавание не поддерживается в этом браузере');
        setState('error');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setState('listening');
        setErrorMsg('');
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setState('processing');
        processVoice(text);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          setErrorMsg('Речь не обнаружена. Попробуйте ещё раз.');
          setState('error');
          speak('Речь не обнаружена. Попробуйте ещё раз.');
        } else if (event.error === 'aborted') {
          setState('idle');
        } else {
          setErrorMsg(`Ошибка распознавания: ${event.error}`);
          setState('error');
        }
      };

      recognition.onend = () => {
        if (state === 'listening') {
          // If still in listening state, recognition ended without result
          setErrorMsg('Распознавание не удалось. Повторите.');
          setState('error');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      setErrorMsg('Ошибка запуска микрофона: ' + e.message);
      setState('error');
    }
  }, []);

  // Process voice text via AI
  const processVoice = async (text: string) => {
    try {
      const result = await api.request('/api/mobile/voice-order', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });

      if (!result.success) {
        setErrorMsg(result.error || 'Не удалось распознать заказ');
        setState('error');
        speak('Не удалось распознать заказ. Повторите, пожалуйста.');
        return;
      }

      const order = result.parsed;
      setParsedOrder(order);
      setEditableItems(order.items || []);
      setTableNumber(order.table_number);

      // Try to match table
      if (order.table_number && tables.length > 0) {
        const matched = tables.find(
          t => t.name === String(order.table_number) || t.id === order.table_number
        );
        if (matched) setSelectedTableId(matched.id);
      }

      setState('confirm');

      // Voice confirmation
      const itemCount = (order.items || []).length;
      const tableStr = order.table_number ? `, стол ${order.table_number}` : '';
      speak(`Распознано ${itemCount} позиций${tableStr}. Проверьте заказ.`);
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка связи с сервером');
      setState('error');
      speak('Ошибка связи. Повторите, пожалуйста.');
    }
  };

  // Send order to kitchen
  const sendOrder = async () => {
    if (!editableItems.length) return;
    setState('sending');

    try {
      const orderItems = editableItems.map(item => ({
        dishId: item.menu_match?.id || 0,
        name: item.name,
        price: item.menu_match?.price || 0,
        quantity: item.quantity,
        options: [...item.modifiers, ...item.exclude.map(e => `без ${e}`)],
        comment: '',
        itemStatus: 'pending' as const,
      }));

      await api.createDineInOrder({
        tableId: selectedTableId || 0,
        waiterId: user.id,
        waiterName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        guestCount: 2,
        items: orderItems,
        comment: `Голосовой заказ от ${parsedOrder?.waiter_nick || user.username}`,
      });

      setState('done');
      speak('Заказ отправлен на кухню.');
      setTimeout(() => {
        onOrderCreated();
        onClose();
      }, 2000);
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка отправки заказа');
      setState('confirm');
    }
  };

  // Toggle item found status for manual matching
  const toggleItemFound = (idx: number) => {
    setEditableItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, found: !item.found } : item
    ));
  };

  const updateItemQuantity = (idx: number, delta: number) => {
    setEditableItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  };

  const removeItem = (idx: number) => {
    setEditableItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Retry
  const handleRetry = () => {
    setState('idle');
    setTranscript('');
    setParsedOrder(null);
    setErrorMsg('');
    setEditableItems([]);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-zinc-900 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Mic size={20} className="text-orange-500" /> Голосовой заказ
          </h2>
          <button onClick={onClose} className="p-1.5 bg-zinc-800 rounded-xl text-zinc-500"><X size={18} /></button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* ===== IDLE / LISTENING ===== */}
          {(state === 'idle' || state === 'listening') && (
            <div className="text-center py-8">
              <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 transition-all ${state === 'listening' ? 'bg-red-500 scale-110 animate-pulse shadow-lg shadow-red-500/50' : 'bg-orange-500'}`}>
                {state === 'listening' ? <MicOff size={40} className="text-white" /> : <Mic size={40} className="text-white" />}
              </div>
              <p className="text-zinc-400 text-sm mb-2">
                {state === 'idle'
                  ? 'Нажмите "Начать" и продиктуйте заказ'
                  : 'Слушаю... Говорите чётко'}
              </p>
              {state === 'listening' && (
                <div className="flex justify-center gap-1 mt-2">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
              <p className="text-xs text-zinc-600 mt-4 max-w-xs mx-auto leading-relaxed">
                Пример: «Ник Алексей, стол 12, паста Карбонара, добавить бекон, без пармезана, кола 0.5, без льда»
              </p>
              {state === 'idle' && (
                <button onClick={startListening}
                  className="mt-6 bg-orange-500 text-white font-bold py-3.5 px-8 rounded-xl text-base active:scale-95">
                  🎤 Начать приём
                </button>
              )}
              {state === 'listening' && (
                <button onClick={() => { recognitionRef.current?.stop(); }}
                  className="mt-6 bg-red-500 text-white font-bold py-3.5 px-8 rounded-xl text-base active:scale-95">
                  ⏹ Остановить
                </button>
              )}
            </div>
          )}

          {/* ===== PROCESSING ===== */}
          {state === 'processing' && (
            <div className="text-center py-8">
              <Loader2 size={48} className="mx-auto text-orange-500 animate-spin mb-4" />
              <p className="text-zinc-400">Распознаю заказ через AI...</p>
              {transcript && (
                <p className="text-sm text-zinc-600 mt-3 italic max-w-xs mx-auto truncate">«{transcript}»</p>
              )}
            </div>
          )}

          {/* ===== CONFIRM ===== */}
          {state === 'confirm' && parsedOrder && (
            <div className="space-y-4">
              {/* Transcript */}
              <div className="bg-zinc-800/50 rounded-xl p-3 text-sm text-zinc-400 italic">
                <Volume2 size={14} className="inline mr-1 text-orange-500" />
                «{transcript}»
              </div>

              {/* Table selection */}
              <div>
                <p className="text-sm font-semibold text-zinc-400 mb-2">📍 Стол</p>
                <div className="flex gap-2 flex-wrap">
                  {[null, ...tables.map(t => t.id)].slice(0, 20).map(t => (
                    <button key={t || 0} onClick={() => { setSelectedTableId(t); setTableNumber(t); }}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedTableId === t ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                      {t ? `Стол ${tables.find(tbl => tbl.id === t)?.name || t}` : '—'}
                    </button>
                  ))}
                </div>
                {parsedOrder.table_number && (
                  <p className="text-xs text-zinc-600 mt-1">Распознано: стол {parsedOrder.table_number}</p>
                )}
              </div>

              {/* Items */}
              <div>
                <p className="text-sm font-semibold text-zinc-400 mb-2">🍽 Позиции ({editableItems.length})</p>
                <div className="space-y-2">
                  {editableItems.map((item, idx) => (
                    <div key={idx} className={`rounded-xl p-3 ${item.found ? 'bg-zinc-800/50' : 'bg-red-900/20 ring-1 ring-red-500/30'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button onClick={() => toggleItemFound(idx)} className="flex-shrink-0">
                            {item.found
                              ? <CheckCircle size={18} className="text-green-500" />
                              : <AlertTriangle size={18} className="text-red-400" />
                            }
                          </button>
                          <div>
                            <span className="text-sm font-semibold text-white truncate block">{item.name}</span>
                            {item.menu_match && <span className="text-[10px] text-zinc-500">{item.menu_match.price}₽</span>}
                            {!item.found && <span className="text-[10px] text-red-400 block">Не найдено в меню</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateItemQuantity(idx, -1)} className="w-7 h-7 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">−</button>
                          <span className="text-sm font-bold text-white w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateItemQuantity(idx, 1)} className="w-7 h-7 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">+</button>
                          <button onClick={() => removeItem(idx)} className="ml-1 w-7 h-7 bg-zinc-800 rounded-lg flex items-center justify-center text-red-400"><X size={14} /></button>
                        </div>
                      </div>
                      {item.modifiers.length > 0 && (
                        <div className="flex gap-1 mt-1.5 ml-7">
                          {item.modifiers.map(m => <span key={m} className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">+{m}</span>)}
                        </div>
                      )}
                      {item.exclude.length > 0 && (
                        <div className="flex gap-1 mt-1 ml-7">
                          {item.exclude.map(e => <span key={e} className="text-[10px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full">без {e}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Unrecognized */}
              {parsedOrder.unrecognized?.length > 0 && (
                <div className="bg-yellow-900/20 rounded-xl p-3 ring-1 ring-yellow-500/20">
                  <p className="text-xs font-semibold text-yellow-400 mb-1">⚠ Не распознано:</p>
                  {parsedOrder.unrecognized.map((u, i) => (
                    <p key={i} className="text-xs text-yellow-500">— {u}</p>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleRetry}
                  className="flex-1 bg-zinc-800 text-zinc-400 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1">
                  <RefreshCw size={16} /> Повторить
                </button>
                <button onClick={sendOrder}
                  disabled={!editableItems.length}
                  className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-1 disabled:opacity-50">
                  <Send size={16} /> Отправить
                </button>
              </div>
            </div>
          )}

          {/* ===== SENDING ===== */}
          {state === 'sending' && (
            <div className="text-center py-8">
              <Loader2 size={48} className="mx-auto text-orange-500 animate-spin mb-4" />
              <p className="text-zinc-400">Отправка заказа на кухню...</p>
            </div>
          )}

          {/* ===== DONE ===== */}
          {state === 'done' && (
            <div className="text-center py-8">
              <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
              <p className="text-white font-bold text-lg">Заказ отправлен!</p>
              <p className="text-zinc-500 text-sm mt-1">Заказ передан на кухню</p>
            </div>
          )}

          {/* ===== ERROR ===== */}
          {state === 'error' && (
            <div className="text-center py-8">
              <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
              <p className="text-red-400 font-semibold">Ошибка</p>
              <p className="text-zinc-400 text-sm mt-1">{errorMsg}</p>
              <div className="flex gap-3 justify-center mt-6">
                <button onClick={handleRetry}
                  className="bg-orange-500 text-white font-bold py-3 px-6 rounded-xl text-sm flex items-center gap-1">
                  <RefreshCw size={16} /> Повторить
                </button>
                <button onClick={onClose}
                  className="bg-zinc-800 text-zinc-400 font-semibold py-3 px-6 rounded-xl text-sm">
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
