import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Image as ImageIcon, Phone, Loader, Truck, User, MapPin, AlertTriangle, Star, Navigation } from 'lucide-react';
import * as api from '../../api';

interface ChatInfo {
  id: number; guestName: string; guestPhone: string; orderId: number;
  tableId: number; status: string; assignedWaiterId: number;
  assignedWaiterName: string; lastMessage: string; lastMessageAt: string; createdAt: string;
}

interface ChatMsg {
  id: number; senderType: string; senderName: string;
  message: string; fileUrl: string; isRead: boolean; createdAt: string;
}

interface StaffChatItem {
  id: number; orderId: number; orderNumber?: number;
  courierId: number; courierName: string; waiterName: string;
  status: string; isImportant: boolean; lastMessage: string;
  lastMessageAt: string; createdAt: string;
}

interface StaffMsg {
  id: number; chatId: number; senderId: number;
  senderType: 'courier' | 'waiter'; senderName: string;
  message: string; fileUrl: string; isRead: boolean; createdAt: string;
  messageType?: 'text' | 'location'; locationData?: { lat: number; lng: number; address?: string };
}

function getWsUrl(): string {
  const stored = localStorage.getItem('foodchain_api_url');
  if (stored && stored.trim()) return stored.replace(/^http/, 'ws');
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${window.location.host}`;
}

const QUICK_REPLIES = [
  { label: 'Заказ готов', key: 'ready' },
  { label: 'Клиент ждёт', key: 'client_waiting' },
  { label: 'Проблема', key: 'problem' },
  { label: 'Адрес уточнён', key: 'address_confirmed' },
];

export default function WaiterChat({ user, onUnreadChange }: { user: any; onUnreadChange?: (n: number) => void }) {
  const [tab, setTab] = useState<'guests' | 'couriers'>('guests');

  // Guest chat state
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [guestTyping, setGuestTyping] = useState(false);

  // Staff chat (courier) state
  const [staffChats, setStaffChats] = useState<StaffChatItem[]>([]);
  const [activeStaffChat, setActiveStaffChat] = useState<StaffChatItem | null>(null);
  const [staffMessages, setStaffMessages] = useState<StaffMsg[]>([]);
  const [staffText, setStaffText] = useState('');
  const [staffFile, setStaffFile] = useState<File | null>(null);
  const [staffSending, setStaffSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [courierTyping, setCourierTyping] = useState(false);

  const [newChatSound] = useState(() => new Audio('/sounds/notification.mp3'));
  const chatRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const staffFileRef = useRef<HTMLInputElement>(null);
  const activeChatRef = useRef<number | null>(null);
  const activeStaffChatRef = useRef<number | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  useEffect(() => { activeStaffChatRef.current = activeStaffChat?.id || null; }, [activeStaffChat]);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages, guestTyping, staffMessages, courierTyping]);

  const connectWs = () => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe:waiter', waiterId: user.id }));
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const guestId = activeChatRef.current;
        const staffId = activeStaffChatRef.current;

        // Guest chat events
        if (data.type === 'chat:message') {
          loadChats();
          if (guestId === data.chatId) {
            setMessages(prev => {
              if (prev.some(x => x.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
            if (data.message.senderType === 'guest') newChatSound.play().catch(() => {});
          } else if (data.message.senderType === 'guest') {
            setUnreadCount(prev => { const n = prev + 1; onUnreadChange?.(n); return n; });
            newChatSound.play().catch(() => {});
          }
        }
        if (data.type === 'chat:typing' && data.chatId === guestId && data.senderType === 'guest') {
          setGuestTyping(true);
          clearTimeout((window as any).__guestTypingTimer);
          (window as any).__guestTypingTimer = setTimeout(() => setGuestTyping(false), 3000);
        }
        if (data.type === 'chat:closed' || data.type === 'chat:deleted') {
          if (data.type === 'chat:closed' && guestId === data.data?.id) {
            setMessages(prev => [...prev, { id: Date.now(), senderType: 'waiter', senderName: '', message: 'Чат закрыт', fileUrl: '', isRead: true, createdAt: new Date().toISOString() }]);
          }
          loadChats();
        }

        // Staff chat events
        if (data.type === 'staff-chat:message') {
          loadStaffChats();
          if (staffId === data.chatId) {
            setStaffMessages(prev => {
              if (prev.some(x => x.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
            if (data.message.senderType === 'courier') newChatSound.play().catch(() => {});
          } else if (data.message.senderType === 'courier') {
            if (tab === 'couriers') loadStaffChats();
            newChatSound.play().catch(() => {});
          }
        }
        if (data.type === 'staff-chat:typing' && data.chatId === staffId && data.senderType === 'courier') {
          setCourierTyping(true);
          clearTimeout((window as any).__staffTypingTimer);
          (window as any).__staffTypingTimer = setTimeout(() => setCourierTyping(false), 3000);
        }
        if (data.type === 'staff-chat:closed' || data.type === 'staff-chat:deleted') {
          if (data.type === 'staff-chat:closed' && staffId === data.data?.id) {
            setStaffMessages(prev => [...prev, { id: Date.now(), chatId: staffId || 0, senderId: user?.id || 0, senderType: 'waiter', senderName: '', message: 'Чат закрыт', fileUrl: '', isRead: true, createdAt: new Date().toISOString() }]);
          }
          loadStaffChats();
        }
        if (data.type === 'staff-chat:important') {
          loadStaffChats();
        }
      } catch {}
    };
    ws.onclose = () => { reconnectTimer.current = setTimeout(() => connectWs(), 3000); };
    ws.onerror = () => { ws.close(); };
  };

  useEffect(() => {
    loadChats();
    loadStaffChats();
    connectWs();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      clearTimeout((window as any).__guestTypingTimer);
      clearTimeout((window as any).__staffTypingTimer);
    };
  }, []);

  const loadChats = async () => {
    try { setChats(await api.getChats({ status: 'all' })); } catch {}
  };

  const loadStaffChats = async () => {
    try { setStaffChats(await api.getStaffChats()); } catch {}
  };

  // Guest chat handlers
  const openChat = async (chatId: number) => {
    setActiveChat(chatId);
    setUnreadCount(prev => { const n = Math.max(0, prev - 1); onUnreadChange?.(n); return n; });
    setGuestTyping(false);
    try {
      const msgs = await api.getChatMessages(chatId);
      setMessages(msgs);
      if (chats.find(c => c.id === chatId)?.assignedWaiterId !== user.id) {
        await api.assignChat(chatId, user.id, user.firstName || user.username);
        loadChats();
      }
    } catch {}
  };

  const send = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    const msgText = text; setText(''); const currentFile = file; setFile(null);
    try {
      let fileUrl = '';
      if (currentFile) { const upload = await api.uploadChatFile(currentFile); fileUrl = upload.url; }
      const saved = await api.sendChatMessage(activeChat!, { sender_type: 'waiter', sender_id: user.id, sender_name: user.firstName || user.username, message: msgText, file_url: fileUrl });
      setMessages(prev => prev.some(x => x.id === saved.id) ? prev : [...prev, saved]); loadChats();
    } catch { setMessages(prev => [...prev, { id: Date.now(), senderType: 'waiter', senderName: '', message: msgText, fileUrl: '', isRead: false, createdAt: new Date().toISOString() }]); }
    finally { setSending(false); }
  };

  const closeChat = async () => {
    if (!activeChat || !confirm('Закрыть чат?')) return;
    await api.closeChat(activeChat);
    setMessages(prev => [...prev, { id: Date.now(), senderType: 'waiter', senderName: '', message: 'Чат закрыт', fileUrl: '', isRead: true, createdAt: new Date().toISOString() }]);
    setTimeout(() => { setActiveChat(null); setMessages([]); loadChats(); }, 500);
  };

  // Staff chat handlers
  const openStaffChat = async (chat: StaffChatItem) => {
    setActiveStaffChat(chat);
    setCourierTyping(false);
    try {
      const msgs = await api.getStaffChatMessages(chat.id);
      setStaffMessages(msgs);
    } catch {}
  };

  const sendStaffMsg = async () => {
    if (!staffText.trim() && !staffFile) return;
    setStaffSending(true);
    const msgText = staffText; setStaffText(''); const currentFile = staffFile; setStaffFile(null); setShowQuickReplies(false);
    try {
      let fileUrl = '';
      if (currentFile) { const upload = await api.uploadStaffChatFile(currentFile); fileUrl = upload.url; }
      if (!activeStaffChat) return;
      const saved = await api.sendStaffChatMessage(activeStaffChat.id, { sender_id: user.id, sender_type: 'waiter', sender_name: user.firstName || user.username, message: msgText, file_url: fileUrl });
      setStaffMessages(prev => prev.some(x => x.id === saved.id) ? prev : [...prev, saved]); loadStaffChats();
    } catch {}
    finally { setStaffSending(false); }
  };

  const closeStaffChat = async () => {
    if (!activeStaffChat || !confirm('Закрыть чат?')) return;
    await api.closeStaffChat(activeStaffChat.id);
    setStaffMessages(prev => [...prev, { id: Date.now(), chatId: activeStaffChat?.id || 0, senderId: user?.id || 0, senderType: 'waiter', senderName: '', message: 'Чат закрыт', fileUrl: '', isRead: true, createdAt: new Date().toISOString() }]);
    setTimeout(() => { setActiveStaffChat(null); setStaffMessages([]); loadStaffChats(); }, 500);
  };

  const toggleImportant = async () => {
    if (!activeStaffChat) return;
    await api.toggleImportantStaffChat(activeStaffChat.id, !activeStaffChat.isImportant);
    setActiveStaffChat({ ...activeStaffChat, isImportant: !activeStaffChat.isImportant });
    loadStaffChats();
  };

  const handleQuickReply = (label: string) => {
    setStaffText(label);
  };

  const handleSendLocation = () => {
    if (!navigator.geolocation || !activeStaffChat) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        setStaffSending(true);
        try {
          const locationData = { lat, lng };
          const saved = await api.sendStaffChatMessage(activeStaffChat.id, {
            sender_id: user.id, sender_type: 'waiter', sender_name: user.firstName || user.username,
            message: '', file_url: '', message_type: 'location', location_data: locationData,
          });
          setStaffMessages(prev => prev.some(x => x.id === saved.id) ? prev : [...prev, saved]);
          loadStaffChats();
        } catch {} finally { setStaffSending(false); }
      },
      () => {}, { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pickFile = () => fileRef.current?.click();

  const sortedGuest = [...chats].sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
  const activeGuest = chats.find(c => c.id === activeChat);
  const activeOpenCount = chats.filter(c => c.status === 'open').length;

  const sortedStaff = [...staffChats].sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());

  // ─────────────────── ACTIVE CHAT VIEW ───────────────────
  if (activeChat && activeGuest && tab === 'guests') {
    return (
      <div className="pb-20">
        <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 p-3 flex items-center gap-2">
          <button onClick={() => { setActiveChat(null); setMessages([]); setGuestTyping(false); }} className="text-zinc-400 hover:text-white"><X size={20} /></button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{activeGuest.guestName || 'Гость'}</p>
            <p className="text-xs text-zinc-500 truncate">{activeGuest.guestPhone}{activeGuest.orderId ? ` · Заказ #${activeGuest.orderId}` : ''}{activeGuest.tableId ? ` · Стол ${activeGuest.tableId}` : ''}</p>
          </div>
          <button onClick={closeChat} className="text-xs bg-green-600/20 text-green-400 px-3 py-1.5 rounded-lg font-medium">Закрыть</button>
        </div>
        <div ref={chatRef} className="max-w-lg mx-auto px-4 pt-4 space-y-3" style={{ height: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.senderType === 'waiter' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.senderType === 'waiter' ? 'bg-orange-500 text-white rounded-br-md' : 'bg-zinc-800 text-zinc-300 rounded-bl-md'}`}>
                {m.fileUrl && <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-40 object-cover cursor-pointer" onClick={() => window.open(m.fileUrl, '_blank')} />}
                {m.message && <p className="text-sm">{m.message}</p>}
                <div className={`flex items-center gap-1 mt-1 ${m.senderType === 'waiter' ? 'justify-end' : 'justify-start'}`}>
                  <span className={`text-[10px] ${m.senderType === 'waiter' ? 'text-white/50' : 'text-zinc-500'}`}>{new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  {m.senderType === 'waiter' && <span className="text-[10px] text-white/50">{m.isRead ? '✓✓' : '✓'}</span>}
                </div>
              </div>
            </div>
          ))}
          {guestTyping && <div className="flex justify-start"><div className="bg-zinc-800 text-zinc-400 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm italic">Гость набирает текст...</div></div>}
        </div>
        <div className="fixed bottom-16 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl p-3 border-t border-zinc-800">
          <div className="flex gap-2 max-w-lg mx-auto relative">
            {file && <div className="absolute bottom-full mb-2 left-0 right-0 bg-zinc-800 rounded-xl p-2 flex items-center gap-2"><span className="text-xs text-zinc-400 truncate flex-1">{file.name}</span><button onClick={() => setFile(null)} className="text-zinc-500 hover:text-white"><X size={14} /></button></div>}
            <button onClick={pickFile} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 text-zinc-400 hover:text-white"><ImageIcon size={18} /></button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !sending && send()} placeholder="Ответить..." className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none ring-1 ring-zinc-700 focus:ring-orange-500 placeholder-zinc-600" />
            <button onClick={send} disabled={sending || (!text.trim() && !file)} className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center disabled:opacity-50">{sending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}</button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────── ACTIVE STAFF CHAT VIEW ───────────────────
  if (activeStaffChat && tab === 'couriers') {
    const isClosed = activeStaffChat.status === 'closed';
    return (
      <div className="pb-20">
        <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 p-3 flex items-center gap-2">
          <button onClick={() => { setActiveStaffChat(null); setStaffMessages([]); setCourierTyping(false); }} className="text-zinc-400 hover:text-white"><X size={20} /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white truncate">Курьер {activeStaffChat.courierName}</p>
              {activeStaffChat.isImportant && <AlertTriangle size={14} className="text-red-400 shrink-0" />}
            </div>
            <p className="text-xs text-zinc-500 truncate">Заказ #{activeStaffChat.orderNumber || activeStaffChat.orderId}</p>
          </div>
          <button onClick={toggleImportant} className={`p-1.5 rounded-lg ${activeStaffChat.isImportant ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}><Star size={16} /></button>
          {!isClosed && <button onClick={closeStaffChat} className="text-xs bg-green-600/20 text-green-400 px-3 py-1.5 rounded-lg font-medium">Закрыть</button>}
        </div>
        <div ref={chatRef} className="max-w-lg mx-auto px-4 pt-4 space-y-3" style={{ height: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          {staffMessages.length === 0 && <div className="text-center py-10 text-zinc-500 text-sm">Начните диалог с курьером</div>}
          {staffMessages.map(m => (
            <div key={m.id} className={`flex ${m.senderType === 'waiter' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.senderType === 'waiter' ? 'bg-orange-500 text-white rounded-br-md' : 'bg-zinc-800 text-zinc-300 rounded-bl-md'}`}>
                {m.fileUrl && <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-40 object-cover cursor-pointer" onClick={() => window.open(m.fileUrl, '_blank')} />}
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
                <p className={`text-[10px] mt-1 ${m.senderType === 'waiter' ? 'text-white/50' : 'text-zinc-500'}`}>{new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {courierTyping && <div className="flex justify-start"><div className="bg-zinc-800 text-zinc-400 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm italic">Курьер набирает текст...</div></div>}
          {isClosed && <div className="text-center py-4 text-zinc-500 text-xs">Чат закрыт</div>}
        </div>
        {!isClosed && (
          <>
            {showQuickReplies && (
              <div className="px-3 py-2 border-t border-zinc-800 flex gap-2 overflow-x-auto">
                {QUICK_REPLIES.map(qr => (
                  <button key={qr.key} onClick={() => handleQuickReply(qr.label)} className="shrink-0 px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-medium hover:bg-zinc-700 whitespace-nowrap">{qr.label}</button>
                ))}
              </div>
            )}
            <div className="fixed bottom-16 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl p-3 border-t border-zinc-800">
              <div className="flex gap-2 max-w-lg mx-auto relative">
                {staffFile && <div className="absolute bottom-full mb-2 left-0 right-0 bg-zinc-800 rounded-xl p-2 flex items-center gap-2"><span className="text-xs text-zinc-400 truncate flex-1">{staffFile.name}</span><button onClick={() => setStaffFile(null)} className="text-zinc-500 hover:text-white"><X size={14} /></button></div>}
                <button onClick={() => staffFileRef.current?.click()} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 text-zinc-400 hover:text-white"><ImageIcon size={18} /></button>
                <input ref={staffFileRef} type="file" accept="image/*" className="hidden" onChange={e => setStaffFile(e.target.files?.[0] || null)} />
                <button onClick={handleSendLocation} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 text-zinc-400 hover:text-white" title="Геолокация"><MapPin size={18} /></button>
                <button onClick={() => setShowQuickReplies(!showQuickReplies)} className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${showQuickReplies ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}><MessageSquare size={18} /></button>
                <input value={staffText} onChange={e => setStaffText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !staffSending && sendStaffMsg()} placeholder="Напишите сообщение..." className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none ring-1 ring-zinc-700 focus:ring-orange-500 placeholder-zinc-600" />
                <button onClick={sendStaffMsg} disabled={staffSending || (!staffText.trim() && !staffFile)} className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center disabled:opacity-50">{staffSending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}</button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─────────────────── CATEGORY TABS + LIST VIEW ───────────────────
  return (
    <div className="pb-20">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-lg font-bold text-white">Чаты</h2>
      </div>

      <div className="flex border-b border-zinc-800 bg-zinc-900">
        <button onClick={() => setTab('guests')} className={`flex-1 py-3 text-sm font-medium ${tab === 'guests' ? 'border-b-2 border-orange-500 text-orange-500' : 'text-zinc-500'}`}>
          Гости {activeOpenCount > 0 && <span className="ml-1 text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">{activeOpenCount}</span>}
        </button>
        <button onClick={() => { setTab('couriers'); loadStaffChats(); }} className={`flex-1 py-3 text-sm font-medium ${tab === 'couriers' ? 'border-b-2 border-orange-500 text-orange-500' : 'text-zinc-500'}`}>
          Курьеры {sortedStaff.filter(c => c.status === 'open').length > 0 && <span className="ml-1 text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">{sortedStaff.filter(c => c.status === 'open').length}</span>}
        </button>
      </div>

      {tab === 'guests' && (
        <div className="divide-y divide-zinc-800">
          {sortedGuest.length === 0 && <div className="py-12 text-center text-zinc-500 text-sm">Нет чатов с гостями</div>}
          {sortedGuest.map(chat => (
            <button key={chat.id} onClick={() => openChat(chat.id)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-900 transition text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${chat.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}><MessageSquare size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{chat.guestName || 'Гость'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${chat.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>{chat.status === 'open' ? 'Открыт' : 'Закрыт'}</span>
                </div>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{chat.lastMessage || 'Нет сообщений'}</p>
                <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-0.5">
                  {chat.guestPhone && <span><Phone size={10} className="inline" /> {chat.guestPhone}</span>}
                  {chat.tableId ? <span>Стол {chat.tableId}</span> : null}
                  {chat.orderId ? <span>Заказ #{chat.orderId}</span> : null}
                </div>
              </div>
              <p className="text-[10px] text-zinc-600 shrink-0">{chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
            </button>
          ))}
        </div>
      )}

      {tab === 'couriers' && (
        <div className="divide-y divide-zinc-800">
          {sortedStaff.length === 0 && <div className="py-12 text-center text-zinc-500 text-sm">Нет чатов с курьерами</div>}
          {sortedStaff.map(chat => (
            <button key={chat.id} onClick={() => openStaffChat(chat)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-900 transition text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${chat.isImportant ? 'bg-red-500/10 text-red-400' : chat.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                {chat.isImportant ? <AlertTriangle size={18} /> : <Truck size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{chat.courierName || 'Курьер'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${chat.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>{chat.status === 'open' ? 'Открыт' : 'Закрыт'}</span>
                  {chat.isImportant && <AlertTriangle size={10} className="text-red-400" />}
                </div>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{chat.lastMessage || 'Нет сообщений'}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Заказ #{chat.orderNumber || chat.orderId}</p>
              </div>
              <p className="text-[10px] text-zinc-600 shrink-0">{chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
