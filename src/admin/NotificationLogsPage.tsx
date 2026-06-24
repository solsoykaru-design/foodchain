import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, MessageCircle } from 'lucide-react';

const CHANNEL_ICONS: Record<string, any> = { email: Mail, push: Smartphone, telegram: MessageCircle };

interface LogEntry {
  id: number;
  channel: string;
  recipient: string;
  title: string;
  status: string;
  error: string | null;
  message_id: string | null;
  created_at: string;
}

export default function NotificationLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');

  useEffect(() => { loadLogs(); loadStats(); }, [channelFilter]);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenant_id: '1', limit: '100' });
      if (channelFilter) params.set('channel', channelFilter);
      const res = await fetch(`/api/notification-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch { setLogs([]); } finally { setLoading(false); }
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/notification-logs/stats?tenant_id=1');
      const data = await res.json();
      setStats(data);
    } catch {}
  }

  const CHANNELS = ['', 'email', 'push', 'telegram'];
  const CHANNEL_LABELS: Record<string, string> = { '': 'Все каналы', email: 'E-mail', push: 'Push', telegram: 'Telegram' };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Логи уведомлений</h1>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Всего" value={stats.total} color="blue" />
          <StatCard label="Отправлено" value={stats.sent} color="green" />
          <StatCard label="Ошибок" value={stats.failed} color="red" />
          {stats.byChannel?.map((c: any) => (
            <StatCard key={c.channel} label={CHANNEL_LABELS[c.channel] || c.channel} value={c.c} color="indigo" />
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {CHANNELS.map(ch => (
          <button key={ch} onClick={() => setChannelFilter(ch)}
            className={`px-3 h-8 text-xs font-medium rounded-lg border transition ${channelFilter === ch ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
            {CHANNEL_LABELS[ch]}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Канал</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Название</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Получатель</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Статус</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Ошибка</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Дата</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-400">Загрузка...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-400">Логов нет</td></tr>
              ) : logs.map(log => {
                const Icon = CHANNEL_ICONS[log.channel] || Bell;
                return (
                  <tr key={log.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        <Icon size={14} /> {CHANNEL_LABELS[log.channel] || log.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white max-w-xs truncate">{log.title}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">{log.recipient || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${log.status === 'sent' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                        {log.status === 'sent' ? 'Отправлено' : 'Ошибка'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-red-500 max-w-[200px] truncate">{log.error || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{new Date(log.created_at).toLocaleString('ru-RU')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
