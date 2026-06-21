import { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, MessageSquare, X, Phone, User, Clock, AlertTriangle, Filter, Download, Eye, Star, Truck, MapPin, Navigation } from 'lucide-react';
import * as api from '../api';

export default function AdminCourierGuestChatsPage() {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [togglingImportant, setTogglingImportant] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadChats(); }, []);

  useEffect(() => {
    if (showModal && chatRef.current) {
      setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 100);
    }
  }, [showModal, messages]);

  async function loadChats() {
    setLoading(true);
    try {
      const all = await api.getCourierGuestChats({ status: statusFilter === 'all' ? undefined : statusFilter, search: search || undefined });
      setChats(all);
    } catch { setChats([]); } finally { setLoading(false); }
  }

  async function openChat(chat: any) {
    setSelectedChat(chat);
    setShowModal(true);
    setMessagesLoading(true);
    try {
      const msgs = await api.getCourierGuestChatMessages(chat.id);
      setMessages(msgs);
    } catch { setMessages([]); } finally { setMessagesLoading(false); }
  }

  async function handleCloseChat(chatId: number) {
    setClosing(true);
    try {
      await api.closeCourierGuestChat(chatId);
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, status: 'closed' } : c));
      if (selectedChat?.id === chatId) {
        setSelectedChat((prev: any) => prev ? { ...prev, status: 'closed' } : null);
      }
    } catch { alert('Ошибка при закрытии чата'); } finally { setClosing(false); }
  }

  async function handleToggleImportant(chatId: number, isImportant: boolean) {
    setTogglingImportant(chatId);
    try {
      await api.toggleImportantCourierGuestChat(chatId, isImportant);
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, isImportant } : c));
      if (selectedChat?.id === chatId) {
        setSelectedChat((prev: any) => prev ? { ...prev, isImportant } : null);
      }
    } catch { alert('Ошибка при изменении важности'); } finally { setTogglingImportant(null); }
  }

  async function handleExport(chat: any) {
    try {
      const msgs = await api.getCourierGuestChatMessages(chat.id);
      const lines = [
        `Чат курьер-гость #${chat.id}`,
        `Заказ #${chat.orderNumber || chat.orderId}`,
        `Курьер: ${chat.courierName || '-'}`,
        `Гость: ${chat.guestName || '-'}`,
        `Телефон: ${chat.guestPhone || '-'}`,
        `Статус: ${chat.status === 'open' ? 'Открыт' : 'Закрыт'}`,
        `Создан: ${chat.createdAt}`,
        `Закрыт: ${chat.closedAt || '-'}`,
        '',
        '=== СООБЩЕНИЯ ===', '',
      ];
      msgs.forEach((m: any) => {
        const sender = m.senderType === 'courier' ? 'Курьер' : 'Гость';
        const time = new Date(m.createdAt).toLocaleString('ru-RU');
        lines.push(`[${time}] ${sender} ${m.senderName}: ${m.message || ''}${m.fileUrl ? ` (файл: ${m.fileUrl})` : ''}${m.messageType === 'location' && m.locationData ? ` (location: ${m.locationData.lat},${m.locationData.lng})` : ''}`);
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `courier_guest_chat_${chat.id}_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Чаты курьер-гость</h1>
        <div className="text-sm text-zinc-500">{chats.length} диалогов</div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadChats()}
            placeholder="Поиск по заказу, курьеру, гостю, телефону..." className="w-full pl-9 pr-4 h-9 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={loadChats} className="flex items-center gap-2 px-3 h-9 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
          <RefreshCw size={15} /> Обновить
        </button>
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
          {(['all', 'open', 'closed'] as const).map(f => (
            <button key={f} onClick={() => { setStatusFilter(f); setTimeout(loadChats, 0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${statusFilter === f ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}>
              {f === 'all' ? 'Все' : f === 'open' ? 'Активные' : 'Закрытые'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">№</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Заказ</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Курьер</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Гость / Телефон</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Последнее сообщение</th>
                <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Статус</th>
                <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-400">Загрузка...</td></tr>
              ) : chats.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-400">Нет диалогов</td></tr>
              ) : chats.map((chat, idx) => (
                <tr key={chat.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition cursor-pointer" onClick={() => openChat(chat)}>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">#{chat.orderNumber || chat.orderId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500"><Truck size={14} /></div>
                      <span className="text-zinc-900 dark:text-white">{chat.courierName || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-400"><Phone size={14} /></div>
                      <div>
                        <span className="text-zinc-900 dark:text-white">{chat.guestName || '—'}</span>
                        {chat.guestPhone && <span className="text-xs text-zinc-400 block">{chat.guestPhone}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="truncate text-zinc-600 dark:text-zinc-400">{chat.lastMessage || 'Нет сообщений'}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        chat.status === 'open'
                          ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {chat.status === 'open' ? 'Открыт' : 'Закрыт'}
                      </span>
                      {chat.isImportant && <AlertTriangle size={12} className="text-red-400" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openChat(chat)} className="p-1.5 text-zinc-400 hover:text-blue-500 transition" title="Открыть"><Eye size={15} /></button>
                      <button onClick={() => handleExport(chat)} className="p-1.5 text-zinc-400 hover:text-green-500 transition" title="Экспорт"><Download size={15} /></button>
                      <button onClick={() => handleToggleImportant(chat.id, !chat.isImportant)} disabled={togglingImportant === chat.id}
                        className={`p-1.5 transition ${chat.isImportant ? 'text-red-400 hover:text-red-500' : 'text-zinc-400 hover:text-yellow-500'}`} title={chat.isImportant ? 'Убрать важность' : 'Отметить важным'}>
                        <Star size={15} className={chat.isImportant ? 'fill-red-400' : ''} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setShowModal(false); }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <MessageSquare size={18} className="text-blue-500" />
                  Чат #{selectedChat.id}
                  {selectedChat.isImportant && <AlertTriangle size={14} className="text-red-400" />}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Заказ #{selectedChat.orderNumber || selectedChat.orderId}
                  {selectedChat.courierName ? ` · Курьер: ${selectedChat.courierName}` : ''}
                  {selectedChat.guestName ? ` · Гость: ${selectedChat.guestName}` : ''}
                  {selectedChat.guestPhone ? ` · ${selectedChat.guestPhone}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${selectedChat.status === 'open' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                  {selectedChat.status === 'open' ? 'Открыт' : 'Закрыт'}
                </span>
                <button onClick={() => setShowModal(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"><X size={20} /></button>
              </div>
            </div>

            <div className="flex items-center gap-4 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
              <span>Курьер: {selectedChat.courierName || 'не назначен'}</span>
              <span>Гость: {selectedChat.guestName || 'неизвестен'}</span>
              <span>Создан: {selectedChat.createdAt ? new Date(selectedChat.createdAt).toLocaleString('ru-RU') : '-'}</span>
              {selectedChat.closedAt && <span>Закрыт: {new Date(selectedChat.closedAt).toLocaleString('ru-RU')}</span>}
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">Загрузка сообщений...</div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">Нет сообщений</div>
              ) : messages.map(m => (
                <div key={m.id} className={`flex ${m.senderType === 'courier' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    m.senderType === 'courier'
                      ? 'bg-blue-500 text-white rounded-br-md'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-bl-md'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] opacity-70 font-medium">
                        {m.senderType === 'courier' ? 'Курьер' : 'Гость'}
                      </span>
                      {m.senderName && <span className="text-[10px] opacity-50">({m.senderName})</span>}
                    </div>
                    {m.fileUrl && (
                      <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-40 object-cover cursor-pointer"
                        onClick={() => window.open(m.fileUrl, '_blank')} />
                    )}
                    {m.messageType === 'location' && m.locationData ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1"><MapPin size={16} /><span className="text-sm font-medium">Местоположение</span></div>
                        <p className="text-xs opacity-80">{m.locationData.lat?.toFixed(6)}, {m.locationData.lng?.toFixed(6)}</p>
                        <a href={`https://yandex.ru/maps/?rtext=~${m.locationData.lat},${m.locationData.lng}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline opacity-90"><Navigation size={14} /> Построить маршрут</a>
                      </div>
                    ) : m.message ? <p className="text-sm whitespace-pre-wrap">{m.message}</p> : null}
                    <div className={`flex items-center gap-1 mt-1 ${m.senderType === 'courier' ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] opacity-50">
                        {new Date(m.createdAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => handleExport(selectedChat)} className="flex items-center gap-1.5 px-3 h-9 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                  <Download size={15} /> Экспорт
                </button>
                {selectedChat.status === 'open' && (
                  <button onClick={() => handleCloseChat(selectedChat.id)} disabled={closing}
                    className="flex items-center gap-1.5 px-3 h-9 text-sm rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition disabled:opacity-50">
                    {closing ? '...' : <X size={15} />} Закрыть чат
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <Eye size={12} /> Только чтение
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
