import { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, MessageSquare, X, Trash2, Phone, User, Clock, CheckCircle, AlertTriangle, Filter, Download, Eye } from 'lucide-react';
import * as api from '../api';
import type { ChatInfo, ChatMessage } from '../types';

export default function AdminChatsPage() {
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedChat, setSelectedChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadChats(); }, []);

  useEffect(() => {
    if (showModal && chatRef.current) {
      setTimeout(() => {
        chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
      }, 100);
    }
  }, [showModal, messages]);

  async function loadChats() {
    setLoading(true);
    try {
      const all = await api.getChats({ status: statusFilter === 'all' ? undefined : statusFilter, search: search || undefined });
      setChats(all);
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }

  async function openChat(chat: ChatInfo) {
    setSelectedChat(chat);
    setShowModal(true);
    setMessagesLoading(true);
    try {
      const msgs = await api.getChatMessages(chat.id);
      setMessages(msgs);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function handleDelete(chatId: number) {
    setDeleting(chatId);
    try {
      await api.deleteChat(chatId);
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (selectedChat?.id === chatId) {
        setShowModal(false);
        setSelectedChat(null);
        setMessages([]);
      }
    } catch {
      alert('Ошибка при удалении чата');
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  async function handleExport(chat: ChatInfo) {
    try {
      const msgs = await api.getChatMessages(chat.id);
      const lines = [
        `Чат #${chat.id}`,
        `Гость: ${chat.guestName || 'неизвестен'}`,
        `Телефон: ${chat.guestPhone || '-'}`,
        `Стол: ${chat.tableId || '-'}`,
        `Заказ: ${chat.orderId || '-'}`,
        `Официант: ${chat.assignedWaiterName || '-'}`,
        `Статус: ${chat.status}`,
        `Создан: ${chat.createdAt}`,
        `Закрыт: ${chat.closedAt || '-'}`,
        '',
        '=== СООБЩЕНИЯ ===',
        '',
      ];
      msgs.forEach((m: ChatMessage) => {
        const sender = m.senderType === 'guest' ? 'Гость' : m.senderType === 'waiter' ? 'Официант' : 'Админ';
        const time = new Date(m.createdAt).toLocaleString('ru-RU');
        lines.push(`[${time}] ${sender} ${m.senderName}: ${m.message}${m.fileUrl ? ` (файл: ${m.fileUrl})` : ''}`);
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_${chat.id}_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  const filtered = chats;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Чаты поддержки</h1>
        <div className="text-sm text-zinc-500">{chats.length} чатов</div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadChats()}
            placeholder="Поиск по имени, телефону, сообщению..." className="w-full pl-9 pr-4 h-9 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={loadChats} className="flex items-center gap-2 px-3 h-9 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
          <RefreshCw size={15} /> Обновить
        </button>
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
          {(['all', 'open', 'closed'] as const).map(f => (
            <button key={f} onClick={() => { setStatusFilter(f); setTimeout(loadChats, 0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${statusFilter === f ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}>
              {f === 'all' ? 'Все' : f === 'open' ? 'Открытые' : 'Закрытые'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">ID</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Гость</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Телефон</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Стол / Заказ</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Официант</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Последнее сообщение</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Создан</th>
                <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Статус</th>
                <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-400 text-sm">Загрузка...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-400 text-sm">Нет чатов</td></tr>
              ) : filtered.map(chat => (
                <tr key={chat.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition cursor-pointer" onClick={() => openChat(chat)}>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 font-mono text-xs">#{chat.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${chat.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'}`}>
                        <User size={14} />
                      </div>
                      <span className="text-zinc-900 dark:text-white font-medium">{chat.guestName || 'Гость'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{chat.guestPhone || '-'}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs">
                    {chat.tableId ? `Стол ${chat.tableId}` : ''}
                    {chat.tableId && chat.orderId ? ' / ' : ''}
                    {chat.orderId ? `#${chat.orderId}` : ''}
                    {!chat.tableId && !chat.orderId ? '-' : ''}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{chat.assignedWaiterName || '-'}</td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="truncate text-zinc-600 dark:text-zinc-400">{chat.lastMessage || 'Нет сообщений'}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                    {chat.createdAt ? new Date(chat.createdAt).toLocaleString('ru-RU') : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      chat.status === 'open'
                        ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {chat.status === 'open' ? 'Открыт' : 'Закрыт'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openChat(chat)} className="p-1.5 text-zinc-400 hover:text-blue-500 transition" title="Просмотр">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handleExport(chat)} className="p-1.5 text-zinc-400 hover:text-green-500 transition" title="Экспорт">
                        <Download size={15} />
                      </button>
                      {confirmDelete === chat.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(chat.id)} disabled={deleting === chat.id}
                            className="px-2 py-1 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50">
                            {deleting === chat.id ? '...' : 'Удалить'}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-md hover:bg-zinc-300">
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(chat.id)} className="p-1.5 text-zinc-400 hover:text-red-500 transition" title="Удалить чат">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chat Detail Modal */}
      {showModal && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setShowModal(false); setConfirmDelete(null); }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <MessageSquare size={18} className="text-blue-500" />
                  Чат #{selectedChat.id}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {selectedChat.guestName || 'Гость'}
                  {selectedChat.guestPhone ? ` · ${selectedChat.guestPhone}` : ''}
                  {selectedChat.tableId ? ` · Стол ${selectedChat.tableId}` : ''}
                  {selectedChat.orderId ? ` · Заказ #${selectedChat.orderId}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  selectedChat.status === 'open'
                    ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {selectedChat.status === 'open' ? 'Открыт' : 'Закрыт'}
                </span>
                <button onClick={() => setShowModal(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Chat Info Bar */}
            <div className="flex items-center gap-4 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
              <span>Официант: {selectedChat.assignedWaiterName || 'не назначен'}</span>
              <span>Создан: {selectedChat.createdAt ? new Date(selectedChat.createdAt).toLocaleString('ru-RU') : '-'}</span>
              {selectedChat.closedAt && <span>Закрыт: {new Date(selectedChat.closedAt).toLocaleString('ru-RU')}</span>}
            </div>

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">Загрузка сообщений...</div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">Нет сообщений</div>
              ) : messages.map(m => (
                <div key={m.id} className={`flex ${m.senderType === 'guest' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    m.senderType === 'guest'
                      ? 'bg-orange-500 text-white rounded-br-md'
                      : m.senderType === 'waiter'
                        ? 'bg-blue-500 text-white rounded-bl-md'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-bl-md'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] opacity-70 font-medium">
                        {m.senderType === 'guest' ? 'Гость' : m.senderType === 'waiter' ? 'Официант' : 'Система'}
                      </span>
                      {m.senderName && <span className="text-[10px] opacity-50">({m.senderName})</span>}
                    </div>
                    {m.fileUrl && (
                      <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-40 object-cover cursor-pointer"
                        onClick={() => window.open(m.fileUrl, '_blank')} />
                    )}
                    {m.message && <p className="text-sm">{m.message}</p>}
                    <div className={`flex items-center gap-1 mt-1 ${m.senderType === 'guest' ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] opacity-50">
                        {new Date(m.createdAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {m.senderType === 'guest' && (
                        <span className="text-[10px] opacity-50">{m.isRead ? '✓✓' : '✓'}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer - admin read-only notice */}
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
