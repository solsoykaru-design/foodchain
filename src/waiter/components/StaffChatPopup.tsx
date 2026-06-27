import { useState, useEffect, useRef } from 'react';
import { Send, X, Image as ImageIcon, Loader, MapPin, MessageSquare, AlertTriangle, Star, Navigation } from 'lucide-react';
import * as api from '../../api';
import type { StaffChat, StaffChatMessage } from '../../types';

function getWsUrl(): string {
  const stored = localStorage.getItem('foodchain_api_url');
  if (stored && stored.trim()) return stored.replace(/^http/, 'ws');
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${window.location.host}`;
}

const QUICK_REPLIES = [
  { label: 'Передан', key: 'transferred' },
  { label: 'Клиент ждёт', key: 'client_waiting' },
  { label: 'Адрес уточнён', key: 'address_confirmed' },
  { label: 'Проблема', key: 'problem' },
];

interface Props {
  orderId: number;
  orderNumber?: number;
  courierId?: number;
  courierName?: string;
  waiterId: number;
  waiterName: string;
  onClose: () => void;
}

export default function StaffChatPopup({ orderId, orderNumber, courierId, courierName, waiterId, waiterName, onClose }: Props) {
  const [chat, setChat] = useState<StaffChat | null>(null);
  const [messages, setMessages] = useState<StaffChatMessage[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courierTyping, setCourierTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef<number | null>(null);

  useEffect(() => {
    initChat();
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe:waiter', waiterId }));
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const currentId = chatIdRef.current;
        if (data.type === 'staff-chat:message' && data.chatId === currentId) {
          setMessages(prev => {
            if (prev.some(x => x.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          loadChat();
        }
        if (data.type === 'staff-chat:typing' && data.chatId === currentId && data.senderType === 'courier') {
          setCourierTyping(true);
          clearTimeout((window as any).__staffTypingTimer);
          (window as any).__staffTypingTimer = setTimeout(() => setCourierTyping(false), 3000);
        }
        if ((data.type === 'staff-chat:closed' || data.type === 'staff-chat:deleted') && data.data?.id === currentId) {
          loadChat();
        }
      } catch {}
    };
    return () => { ws.close(); clearTimeout((window as any).__staffTypingTimer); };
  }, [orderId]);

  useEffect(() => { chatIdRef.current = chat?.id || null; }, [chat]);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages, courierTyping]);

  const initChat = async () => {
    setLoading(true);
    try {
      let chats = await api.getStaffChats({ order_id: orderId });
      let staffChat = chats.find(c => c.status === 'open');
      if (!staffChat) {
        staffChat = await api.createStaffChat({
          order_id: orderId,
          waiter_id: waiterId,
          waiter_name: waiterName,
          courier_id: courierId || 0,
          courier_name: courierName || '',
        });
      }
      setChat(staffChat);
      const msgs = await api.getStaffChatMessages(staffChat.id);
      setMessages(msgs);
    } catch {} finally { setLoading(false); }
  };

  const loadChat = async () => {
    try {
      const chats = await api.getStaffChats({ order_id: orderId });
      const found = chats[0];
      if (found) setChat(found);
    } catch {}
  };

  const sendMessage = async (msgText: string) => {
    if (!msgText.trim() && !file) return;
    setSending(true);
    const textToSend = msgText;
    setText('');
    const currentFile = file;
    setFile(null);
    setShowQuickReplies(false);
    try {
      let fileUrl = '';
      if (currentFile) {
        const upload = await api.uploadStaffChatFile(currentFile);
        fileUrl = upload.url;
      }
      if (!chat) await initChat();
      if (!chat) return;
      const saved = await api.sendStaffChatMessage(chat.id, {
        sender_id: waiterId,
        sender_type: 'waiter',
        sender_name: waiterName,
        message: textToSend,
        file_url: fileUrl,
      });
      setMessages(prev => prev.some(x => x.id === saved.id) ? prev : [...prev, saved]);
      loadChat();
    } catch {} finally { setSending(false); }
  };

  const handleQuickReply = (text: string) => {
    sendMessage(text);
  };

  const handleSendLocation = () => {
    if (!navigator.geolocation || !chat) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        setSending(true);
        try {
          const locationData = { lat, lng };
          const saved = await api.sendStaffChatMessage(chat.id, {
            sender_id: waiterId, sender_type: 'waiter', sender_name: waiterName,
            message: '', file_url: '', message_type: 'location', location_data: locationData,
          });
          setMessages(prev => prev.some(x => x.id === saved.id) ? prev : [...prev, saved]);
          loadChat();
        } catch {} finally { setSending(false); }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pickFile = () => fileRef.current?.click();

  const isClosed = chat?.status === 'closed';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 w-full sm:max-w-md sm:rounded-2xl sm:mx-4 max-h-[90vh] flex flex-col border border-zinc-800" style={{ height: '85vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-zinc-800 shrink-0">
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white"><X size={20} /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white truncate">Чат с курьером</h3>
              {chat?.isImportant && <AlertTriangle size={14} className="text-red-400 shrink-0" />}
            </div>
            <p className="text-[10px] text-zinc-500 truncate">Заказ #{orderNumber || orderId}</p>
          </div>
          {chat && !isClosed && (
            <button onClick={() => api.toggleImportantStaffChat(chat.id, !chat.isImportant).then(loadChat)} className={`p-1.5 rounded-lg ${chat.isImportant ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Star size={16} />
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">Загрузка...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">Начните диалог с курьером</div>
          ) : messages.map(m => (
            <div key={m.id} className={`flex ${m.senderType === 'waiter' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.senderType === 'waiter' ? 'bg-orange-500 text-white rounded-br-md' : 'bg-zinc-800 text-zinc-300 rounded-bl-md'}`}>
                {m.fileUrl && (
                  <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-40 object-cover cursor-pointer" onClick={() => window.open(m.fileUrl, '_blank')} />
                )}
                {m.messageType === 'location' && m.locationData ? (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin size={16} />
                      <span className="text-sm font-medium">Местоположение</span>
                    </div>
                    <p className="text-xs opacity-80">{m.locationData.lat.toFixed(6)}, {m.locationData.lng.toFixed(6)}</p>
                    <a href={`https://yandex.ru/maps/?rtext=~${m.locationData.lat},${m.locationData.lng}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline opacity-90 hover:opacity-100">
                      <Navigation size={14} /> Построить маршрут
                    </a>
                  </div>
                ) : m.message ? <p className="text-sm whitespace-pre-wrap">{m.message}</p> : null}
                <div className={`flex items-center gap-1.5 mt-1 ${m.senderType === 'waiter' ? 'justify-end' : 'justify-start'}`}>
                  <span className={`text-[10px] ${m.senderType === 'waiter' ? 'text-white/50' : 'text-zinc-500'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {courierTyping && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 text-zinc-400 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm italic">Курьер набирает текст...</div>
            </div>
          )}
          {isClosed && (
            <div className="text-center py-4 text-zinc-500 text-xs">Чат закрыт. Заказ завершён.</div>
          )}
        </div>

        {/* Quick Replies */}
        {showQuickReplies && !isClosed && (
          <div className="p-2 border-t border-zinc-800 flex gap-2 overflow-x-auto shrink-0">
            {QUICK_REPLIES.map(qr => (
              <button key={qr.key} onClick={() => handleQuickReply(qr.label)} className="shrink-0 px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-medium hover:bg-zinc-700 hover:text-white transition whitespace-nowrap">
                {qr.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        {!isClosed && (
          <div className="p-3 border-t border-zinc-800 shrink-0">
            {file && (
              <div className="mb-2 bg-zinc-800 rounded-xl p-2 flex items-center gap-2">
                <span className="text-xs text-zinc-400 truncate flex-1">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-zinc-500 hover:text-white shrink-0"><X size={14} /></button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={pickFile} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 text-zinc-400 hover:text-white">
                <ImageIcon size={18} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              <button onClick={handleSendLocation} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 text-zinc-400 hover:text-white" title="Отправить геолокацию">
                <MapPin size={18} />
              </button>
              <button onClick={() => setShowQuickReplies(!showQuickReplies)} className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${showQuickReplies ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                <MessageSquare size={18} />
              </button>
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !sending && sendMessage(text)} placeholder="Напишите сообщение..." className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none ring-1 ring-zinc-700 focus:ring-orange-500 placeholder-zinc-600" disabled={sending} />
              <button onClick={() => sendMessage(text)} disabled={sending || (!text.trim() && !file)} className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50">
                {sending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
