import { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, MessageSquare, X, Phone, User, Clock, AlertTriangle, Filter, Download, Eye, Star, Truck } from 'lucide-react';
import * as api from '../api';
import type { StaffChat, StaffChatMessage } from '../types';

export default function AdminStaffChatsPage() {
  const [chats, setChats] = useState<StaffChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedChat, setSelectedChat] = useState<StaffChat | null>(null);
  const [messages, setMessages] = useState<StaffChatMessage[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
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
      const all = await api.getStaffChats({ status: statusFilter === 'all' ? undefined : statusFilter, search: search || undefined });
      setChats(all);
    } catch { setChats([]); } finally { setLoading(false); }
  }

  async function openChat(chat: StaffChat) {
    setSelectedChat(chat);
    setShowModal(true);
    setMessagesLoading(true);
    try {
      const msgs = await api.getStaffChatMessages(chat.id);
      setMessages(msgs);
    } catch { setMessages([]); } finally { setMessagesLoading(false); }
  }

  async function handleExport(chat: StaffChat) {
    try {
      const msgs = await api.getStaffChatMessages(chat.id);
      const lines = [
        `Диалог курьер-официант #${chat.id}`,
        `Заказ #${chat.orderNumber || chat.orderId}`,
        `Курьер: ${chat.courierName || '-'}`,
        `Официант: ${chat.waiterName || '-'}`,
        `Статус: ${chat.status === 'open' ? 'Открыт' : 'Закрыт'}`,
        `Создан: ${chat.createdAt}`,
        `Закрыт: ${chat.closedAt || '-'}`,
        '',
        '=== СООБЩЕНИЯ ===', '',
      ];
      msgs.forEach((m: StaffChatMessage) => {
        const sender = m.senderType === 'courier' ? 'Курьер' : 'Официант';
        const time = new Date(m.createdAt).toLocaleString('ru-RU');
        lines.push(`[${time}] ${sender} ${m.senderName}: ${m.message}${m.fileUrl ? ` (файл: ${m.fileUrl})` : ''}`);
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staff_chat_${chat.id}_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Чаты курьер-официант</h1>
        <div className="text-sm text-zinc-500">{chats.length} диалогов</div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadChats()}
            placeholder="Поиск по курьеру, официанту, заказу..." className="w-full pl-9 pr-4 h-9 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase">ID</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase">Заказ</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase">Курьер</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase">Официант</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase">Последнее сообщение</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase">Статус</th>
                <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-400">Загрузка...</td></tr>
              ) : chats.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-400">Нет диалогов</td></tr>
              ) : chats.map(chat => (
                <tr key={chat.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition cursor-pointer" onClick={() => openChat(chat)}>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">#{chat.id}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">#{chat.orderNumber || chat.orderId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500"><Truck size={14} /></div>
                      <span className="text-zinc-900 dark:text-white">{chat.courierName || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500"><User size={14} /></div>
                      <span className="text-zinc-900 dark:text-white">{chat.waiterName || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="truncate text-zinc-600 dark:text-zinc-400">{chat.lastMessage || 'Нет сообщений'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
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
                      <button onClick={() => openChat(chat)} className="p-1.5 text-zinc-400 hover:text-blue-500 transition" title="Просмотр"><Eye size={15} /></button>
                      <button onClick={() => handleExport(chat)} className="p-1.5 text-zinc-400 hover:text-green-500 transition" title="Экспорт"><Download size={15} /></button>
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
                  Диалог #{selectedChat.id}
                  {selectedChat.isImportant && <AlertTriangle size={14} className="text-red-400" />}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Заказ #{selectedChat.orderNumber || selectedChat.orderId}
                  {selectedChat.courierName ? ` · Курьер: ${selectedChat.courierName}` : ''}
                  {selectedChat.waiterName ? ` · Официант: ${selectedChat.waiterName}` : ''}
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
              <span>Официант: {selectedChat.waiterName || 'не назначен'}</span>
              <span>Создан: {selectedChat.createdAt ? new Date(selectedChat.createdAt).toLocaleString('ru-RU') : '-'}</span>
              {selectedChat.closedAt && <span>Закрыт: {new Date(selectedChat.closedAt).toLocaleString('ru-RU')}</span>}
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">Загрузка сообщений...</div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">Нет сообщений</div>
              ) : messages.map(m => (
                <div key={m.id} className={`flex ${m.senderType === 'waiter' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    m.senderType === 'waiter'
                      ? 'bg-orange-500 text-white rounded-br-md'
                      : 'bg-green-500 text-white rounded-bl-md'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] opacity-70 font-medium">
                        {m.senderType === 'waiter' ? 'Официант' : 'Курьер'}
                      </span>
                      {m.senderName && <span className="text-[10px] opacity-50">({m.senderName})</span>}
                    </div>
                    {m.fileUrl && <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-40 object-cover cursor-pointer" onClick={() => window.open(m.fileUrl, '_blank')} />}
                    {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                    <p className="text-[10px] opacity-50 mt-1">
                      {new Date(m.createdAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-center">
              <p className="text-xs text-zinc-400 flex items-center justify-center gap-1">
                <Eye size={12} /> Просмотр только для чтения. Администраторы не могут отвечать в чатах.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
