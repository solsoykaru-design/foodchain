import { useState, useEffect } from 'react';
import { Send, Users, UserCheck } from 'lucide-react';
import { addToast } from '../ToastContext';

interface PushNotif {
  id: number;
  title: string;
  body: string;
  audience: string;
  audienceLabel: string;
  sentAt: string;
  status: string;
}

const GROUPS = ['Все клиенты', 'VIP', 'Новые', 'Постоянные'];

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<PushNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'group'>('all');
  const [group, setGroup] = useState(GROUPS[0]);

  useEffect(() => { loadNotifs(); }, []);

  async function loadNotifs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?tenant_id=1`);
      const data = await res.json();
      setNotifs(data);
    } catch {
      setNotifs([]);
    } finally { setLoading(false); }
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) { addToast('Заполните заголовок и текст уведомления.', 'warning'); return; }
    try {
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: 1, title, body, audience, group: audience === 'group' ? group : null }),
      });
      setTitle('');
      setBody('');
      await loadNotifs();
    } catch (e: any) { addToast('Ошибка отправки уведомления.', 'error'); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Push-уведомления</h1>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Создать уведомление</h2>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Заголовок" className="w-full h-9 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea value={body} onChange={e => setBody(e.target.value)}
              placeholder="Текст уведомления" rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="audience" checked={audience === 'all'} onChange={() => setAudience('all')} className="accent-blue-500" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1"><Users size={14} /> Всем</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="audience" checked={audience === 'group'} onChange={() => setAudience('group')} className="accent-blue-500" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1"><UserCheck size={14} /> Выбранной группе</span>
              </label>
              {audience === 'group' && (
                <select value={group} onChange={e => setGroup(e.target.value)}
                  className="h-8 px-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none">
                  {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              )}
            </div>
            <button onClick={handleSend} className="flex items-center gap-2 px-4 h-9 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
              <Send size={15} /> Отправить
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                    <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Заголовок</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Текст</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Аудитория</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Отправлено</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {notifs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">Нет уведомлений</td></tr>
                  ) : notifs.map(n => (
                    <tr key={n.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{n.title}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">{n.body}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{n.audienceLabel}</td>
                      <td className="px-4 py-3 text-zinc-500">{new Date(n.sentAt).toLocaleString('ru-RU')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${n.status === 'delivered' ? 'bg-green-50 text-green-600' : n.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
                          {n.status === 'delivered' ? 'Доставлено' : n.status === 'failed' ? 'Ошибка' : 'В обработке'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 h-fit">
          <h2 className="font-semibold text-zinc-900 dark:text-white mb-4">Статистика</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Всего отправлено</span>
              <span className="font-bold text-zinc-900 dark:text-white">{notifs.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Доставлено</span>
              <span className="font-bold text-green-600">{notifs.filter(n => n.status === 'delivered').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
