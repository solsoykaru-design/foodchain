import { useState, useEffect } from 'react';
import { Gift, Users, Settings2, TrendingUp, Copy, Check } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function ReferralProgramPage() {
  const [settings, setSettings] = useState<any>({ enabled: false, referrer_bonus: 100, referee_bonus: 100, min_order_amount: 500, bonus_type: 'points' });
  const [stats, setStats] = useState<any>({});
  const [referrals, setReferrals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [s, st, list] = await Promise.all([api.getReferralSettings(), api.getReferralStats(), api.getReferralList()]);
      setSettings({ ...s, enabled: s.enabled !== 0 });
      setStats(st);
      setReferrals(list || []);
    } catch (e) { console.error(e); }
  };

  const saveSettings = async () => {
    try {
      await api.updateReferralSettings({ ...settings, enabled: settings.enabled ? 1 : 0 });
      addToast('Настройки сохранены', 'success');
      loadData();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center"><Gift className="text-white" size={22} /></div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Реферальная программа</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Приглашайте друзей и получайте бонусы</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-2 text-zinc-500 text-sm"><Users size={16} /> Всего рефералов</div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.total || 0}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-2 text-zinc-500 text-sm"><Check size={16} /> Завершено</div>
          <p className="text-2xl font-bold text-green-600">{stats.completed || 0}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-2 text-zinc-500 text-sm"><TrendingUp size={16} /> В ожидании</div>
          <p className="text-2xl font-bold text-amber-600">{stats.pending || 0}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Settings2 size={20} /> Настройки</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="flex items-center justify-between md:col-span-2">
            <span className="font-medium">Включить программу</span>
            <button onClick={() => setSettings({ ...settings, enabled: !settings.enabled })} className={`relative w-14 h-7 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-7' : ''}`} />
            </button>
          </div>
          <div><label className="text-xs text-zinc-500">Бонус пригласившему, ₽</label><input type="number" value={settings.referrer_bonus} onChange={e => setSettings({ ...settings, referrer_bonus: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div>
          <div><label className="text-xs text-zinc-500">Бонус приглашённому, ₽</label><input type="number" value={settings.referee_bonus} onChange={e => setSettings({ ...settings, referee_bonus: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div>
          <div><label className="text-xs text-zinc-500">Минимальная сумма заказа для активации</label><input type="number" value={settings.min_order_amount} onChange={e => setSettings({ ...settings, min_order_amount: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div>
          <div><label className="text-xs text-zinc-500">Тип бонуса</label><select value={settings.bonus_type} onChange={e => setSettings({ ...settings, bonus_type: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"><option value="points">Баллы лояльности</option></select></div>
        </div>
        <button onClick={saveSettings} className="mt-4 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">Сохранить</button>
      </div>

      {stats.top?.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Топ рефереров</h2>
          <div className="space-y-2">
            {stats.top.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{t.name || 'Пользователь'} {t.phone ? `(${t.phone})` : ''}</p>
                  <p className="text-xs text-zinc-500">Код: <span className="font-mono">{t.code}</span></p>
                </div>
                <span className="text-lg font-bold text-zinc-900 dark:text-white">{t.used_count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">История рефералов</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500"><th className="text-left p-3">Пригласивший</th><th className="text-left p-3">Приглашённый</th><th className="text-left p-3">Код</th><th className="text-left p-3">Статус</th><th className="text-left p-3">Дата</th></tr></thead>
            <tbody>
              {referrals.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-400">Нет рефералов</td></tr>}
              {referrals.map((r: any) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-3">{r.referrer_name || ''} <span className="text-zinc-500">{r.referrer_phone || ''}</span></td>
                  <td className="p-3">{r.referee_name || ''} <span className="text-zinc-500">{r.referee_phone || ''}</span></td>
                  <td className="p-3 font-mono text-xs">{r.code}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-md text-xs font-medium ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span></td>
                  <td className="p-3 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
