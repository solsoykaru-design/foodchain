import { useState, useEffect } from 'react';
import { addToast } from '../ToastContext';
import * as api from '../api';
import { MessageCircle, Send, RefreshCw, Users, Activity, Power, PowerOff, Settings, MessageSquare, BarChart3, Command, TrendingUp } from 'lucide-react';

export default function TelegramBotPage() {
  const [tab, setTab] = useState<'settings' | 'analytics'>('settings');
  const [settings, setSettings] = useState<any>({ enabled: false, token: '', welcome_message: '', contacts_text: '' });
  const [stats, setStats] = useState<any>({ totalUsers: 0, todayActive: 0 });
  const [analytics, setAnalytics] = useState<any>({ totalUsers: 0, activeToday: 0, popularCmds: [], dailyActive: [] });
  const [broadcastText, setBroadcastText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/telegram-bot/settings'),
      api.get('/api/telegram-bot/stats')
    ]).then(([s, st]) => {
      setSettings({ enabled: false, token: '', welcome_message: 'Добро пожаловать!', contacts_text: '', ...s });
      setStats(st || { totalUsers: 0, todayActive: 0 });
    }).catch(() => {}).finally(() => setLoading(false));
    if (tab === 'analytics') loadAnalytics();
  }, [tab]);

  const loadAnalytics = async () => {
    try { setAnalytics(await api.get('/api/telegram-bot/analytics')); } catch {}
  };

  const save = async () => {
    try {
      await api.put('/api/telegram-bot/settings', settings);
      addToast('Настройки сохранены', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const restart = async () => {
    try {
      await api.post('/api/telegram-bot/restart', {});
      addToast('Бот перезапущен', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setSending(true);
    try {
      const r = await api.post('/api/telegram-bot/broadcast', { message: broadcastText });
      addToast(`Отправлено: ${r.sent}, ошибок: ${r.failed} из ${r.total}`, r.failed > 0 ? 'warning' : 'success');
      setBroadcastText('');
      const s = await api.get('/api/telegram-bot/stats');
      setStats(s || stats);
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setSending(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const tabs = [
    { key: 'settings', label: 'Настройки', icon: Settings },
    { key: 'analytics', label: 'Аналитика', icon: BarChart3 },
  ] as const;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
          <MessageCircle className="text-blue-500" size={28} />
          Telegram Bot
        </h1>
      </div>

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-1">
                <Users size={20} className="text-blue-500" />
                <span className="text-sm text-zinc-500">Всего пользователей</span>
              </div>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">{stats.totalUsers}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-1">
                <Activity size={20} className="text-emerald-500" />
                <span className="text-sm text-zinc-500">Активных сегодня</span>
              </div>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">{stats.todayActive}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-5">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Settings size={18} /> Настройки бота</h2>

            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
              <div className="flex items-center gap-3">
                {settings.enabled ? <Power className="text-green-500" size={20} /> : <PowerOff className="text-zinc-400" size={20} />}
                <div>
                  <p className="font-medium text-sm text-zinc-700 dark:text-zinc-300">Бот {settings.enabled ? 'активен' : 'отключён'}</p>
                  <p className="text-xs text-zinc-400">{settings.enabled && settings.token ? 'Ожидает сообщения' : 'Настройте токен и включите'}</p>
                </div>
              </div>
              <button onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                className={`w-12 h-7 rounded-full transition-colors relative ${settings.enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow ${settings.enabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Токен бота (от BotFather)</label>
              <input value={settings.token || ''} onChange={e => setSettings({ ...settings, token: e.target.value })}
                placeholder="123456:ABC-defGHI..."
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Приветственное сообщение (/start)</label>
              <textarea value={settings.welcome_message || ''} onChange={e => setSettings({ ...settings, welcome_message: e.target.value })} rows={2}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Текст контактов (/contacts)</label>
              <textarea value={settings.contacts_text || ''} onChange={e => setSettings({ ...settings, contacts_text: e.target.value })} rows={2}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">URL Mini App (Telegram Web App)</label>
              <input value={settings.webapp_url || ''} onChange={e => setSettings({ ...settings, webapp_url: e.target.value })}
                placeholder="https://yourdomain.com/tg-app"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono" />
              <p className="text-xs text-zinc-400 mt-1">Для Telegram требуется HTTPS. Локально можно тестировать через test environment.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={save} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl transition-all active:scale-[0.97]">Сохранить</button>
              <button onClick={restart} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium py-2.5 px-4 rounded-xl transition-all active:scale-[0.97]">
                <RefreshCw size={16} /> Перезапустить
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Send size={18} /> Рассылка пользователям</h2>
            <p className="text-xs text-zinc-400">Сообщение будет отправлено всем пользователям, которые когда-либо писали боту.</p>
            <textarea value={broadcastText} onChange={e => setBroadcastText(e.target.value)} rows={3} placeholder="Введите текст рассылки..."
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <button onClick={sendBroadcast} disabled={sending || !broadcastText.trim()}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 px-5 rounded-xl transition-all active:scale-[0.97]">
              {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MessageSquare size={16} />}
              {sending ? 'Отправка...' : `Отправить (${stats.totalUsers} пользователям)`}
            </button>
          </div>
        </>
      )}

      {tab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-1">
                <Users size={20} className="text-blue-500" />
                <span className="text-sm text-zinc-500">Всего пользователей</span>
              </div>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">{analytics.totalUsers}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-1">
                <Activity size={20} className="text-emerald-500" />
                <span className="text-sm text-zinc-500">Активных сегодня</span>
              </div>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">{analytics.activeToday}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Command size={16} /> Популярные команды (30 дней)</h2>
            <div className="space-y-2">
              {analytics.popularCmds?.map((cmd: any, i: number) => {
                const maxCount = Math.max(...(analytics.popularCmds?.map((c: any) => c.count) || [1]));
                const pct = Math.round(cmd.count / maxCount * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-500 w-24 truncate">{cmd.command}</span>
                    <div className="flex-1 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 w-10 text-right">{cmd.count}</span>
                  </div>
                );
              })}
              {(!analytics.popularCmds || analytics.popularCmds.length === 0) && (
                <p className="text-sm text-zinc-400 text-center py-4">Нет данных</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp size={16} /> Активность за 14 дней</h2>
            <div className="flex items-end gap-1 h-32">
              {analytics.dailyActive?.map((d: any, i: number) => {
                const maxUsers = Math.max(...(analytics.dailyActive?.map((dd: any) => dd.users) || [1]));
                const height = Math.round(d.users / maxUsers * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-400">{d.users}</span>
                    <div className="w-full bg-blue-500 rounded-t transition-all" style={{ height: `${height}%` }} />
                    <span className="text-[10px] text-zinc-400 truncate w-full text-center">{d.day?.slice(5)}</span>
                  </div>
                );
              })}
              {(!analytics.dailyActive || analytics.dailyActive.length === 0) && (
                <p className="text-sm text-zinc-400 text-center py-4 w-full">Нет данных</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
