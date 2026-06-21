import { useState, useEffect } from 'react';
import { Search, RefreshCw, Inbox, Send } from 'lucide-react';

interface Message {
  id: number;
  direction: 'incoming' | 'outgoing';
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  sentAt: string;
  isRead: boolean;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMessages(); }, []);

  async function loadMessages() {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?tenant_id=1&direction=${filter}&search=${search}`);
      const data = await res.json();
      setMessages(data);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = messages.filter(m => {
    if (filter === 'incoming') return m.direction === 'incoming';
    if (filter === 'outgoing') return m.direction === 'outgoing';
    return true;
  }).filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.subject.toLowerCase().includes(q) || m.sender.toLowerCase().includes(q) || m.recipient.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Сообщения</h1>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск сообщений..." className="w-full pl-9 pr-4 h-9 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={loadMessages} className="flex items-center gap-2 px-3 h-9 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
          <RefreshCw size={15} /> Обновить
        </button>
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
          {(['all', 'incoming', 'outgoing'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filter === f ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}>
              {f === 'all' ? 'Все' : f === 'incoming' ? 'Входящие' : 'Исходящие'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Направление</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Отправитель</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Получатель</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Тема</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Дата</th>
                <th className="text-center px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Статус</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">Нет сообщений</td></tr>
              ) : filtered.map(m => (
                <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${m.direction === 'incoming' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}>
                      {m.direction === 'incoming' ? <Inbox size={12} /> : <Send size={12} />}
                      {m.direction === 'incoming' ? 'Входящее' : 'Исходящее'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{m.sender}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{m.recipient}</td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-white font-medium">{m.subject}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{new Date(m.sentAt).toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs ${m.isRead ? 'text-green-500' : 'text-zinc-400'}`}>{m.isRead ? '✓✓' : '✓'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
