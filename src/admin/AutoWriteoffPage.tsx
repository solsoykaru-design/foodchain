import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, Trash2, Play, Save, RefreshCw, CalendarX, TrendingDown } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function AutoWriteoffPage() {
  const [settings, setSettings] = useState<any>({ enabled: false, warn_days: 3, auto_writeoff: false, notify_admin: true, include_losses: false });
  const [expiring, setExpiring] = useState<any[]>([]);
  const [expired, setExpired] = useState<any[]>([]);
  const [lossData, setLossData] = useState<any[]>([]);
  const [showLosses, setShowLosses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, expiringSoon, expiredItems] = await Promise.all([
        api.getAutoWriteoffSettings().catch(() => ({ enabled: false, warn_days: 3, auto_writeoff: false, notify_admin: true, include_losses: false })),
        api.getExpiringSoon().catch(() => []),
        api.getExpiredItems().catch(() => []),
      ]);
      setSettings(s);
      setExpiring(expiringSoon.filter((i: any) => (i.days_left || 99) > 0));
      setExpired(expiredItems);
    } catch {}
    setLoading(false);
  }, []);

  const loadLosses = useCallback(async () => {
    try {
      const ids = [...expired, ...expiring].map((i: any) => i.id).filter(Boolean);
      if (ids.length > 0) {
        const data = await api.calculateWriteoffLosses(ids);
        setLossData(data);
      }
    } catch {}
  }, [expired, expiring]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api.saveAutoWriteoffSettings(settings);
      setSettings(updated);
      addToast('Настройки сохранены', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
    setBusy(false);
  };

  const toggleLosses = () => {
    setSettings((p: any) => ({ ...p, include_losses: !p.include_losses }));
    setShowLosses(!showLosses);
    if (!showLosses) setTimeout(loadLosses, 100);
  };

  const runNow = async () => {
    setBusy(true);
    setResultMsg(null);
    try {
      const result = await api.runAutoWriteoff();
      setResultMsg(`Списано: ${result.written_off} позиций. ${result.message}`);
      addToast(result.message, result.written_off > 0 ? 'success' : 'info');
      load();
    } catch (e: any) { setResultMsg(`Ошибка: ${e.message}`); addToast(e.message, 'error'); }
    setBusy(false);
  };

  if (loading) {
    return <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm"><div className="text-center py-12 text-zinc-400">Загрузка...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
          <CalendarX size={22} className="text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Списание по срокам годности</h1>
          <p className="text-sm text-zinc-500">Автоматическое выявление и списание просроченных продуктов</p>
        </div>
      </div>

      {resultMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium ${resultMsg.includes('Ошибка') ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
          {resultMsg}
        </div>
      )}

      {/* Settings */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm max-w-lg">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Настройки</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="font-medium">Автосписание</p><p className="text-sm text-zinc-500">Включить проверку сроков годности</p></div>
            <button onClick={() => setSettings((p: any) => ({ ...p, enabled: !p.enabled }))}
              className={`relative w-14 h-7 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-7' : ''}`} />
            </button>
          </div>

          <div>
            <p className="font-medium mb-1">Дней до предупреждения</p>
            <p className="text-sm text-zinc-500 mb-2">За сколько дней показывать предупреждение об истечении срока</p>
            <input type="number" value={settings.warn_days} onChange={e => setSettings((p: any) => ({ ...p, warn_days: Number(e.target.value) }))}
              className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none w-24" />
          </div>

          <div className="flex items-center justify-between">
            <div><p className="font-medium">Автоматически списывать</p><p className="text-sm text-zinc-500">Создавать документ списания без ручного подтверждения</p></div>
            <button onClick={() => setSettings((p: any) => ({ ...p, auto_writeoff: !p.auto_writeoff }))}
              className={`relative w-14 h-7 rounded-full transition-colors ${settings.auto_writeoff ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.auto_writeoff ? 'translate-x-7' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div><p className="font-medium">Уведомления</p><p className="text-sm text-zinc-500">Уведомлять администратора о списании</p></div>
            <button onClick={() => setSettings((p: any) => ({ ...p, notify_admin: !p.notify_admin }))}
              className={`relative w-14 h-7 rounded-full transition-colors ${settings.notify_admin ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.notify_admin ? 'translate-x-7' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div><p className="font-medium">Учитывать потери</p><p className="text-sm text-zinc-500">Применять % холодной и тепловой обработки при списании</p></div>
            <button onClick={toggleLosses}
              className={`relative w-14 h-7 rounded-full transition-colors ${settings.include_losses ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.include_losses ? 'translate-x-7' : ''}`} />
            </button>
          </div>

          <button onClick={save} disabled={busy}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50">
            <Save size={16} /> {busy ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Expired items */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Просроченные продукты</h2>
            {expired.length > 0 && <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">{expired.length}</span>}
          </div>
          <button onClick={runNow} disabled={busy}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
            {busy ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
            Списать сейчас
          </button>
        </div>

        {expired.length === 0 ? (
          <div className="text-center py-8 text-zinc-400"><p>✓ Просроченных продуктов нет</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Продукт</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Остаток</th>
                  {settings.include_losses && <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">С учётом потерь</th>}
                  {settings.include_losses && <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Потери %</th>}
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Срок до</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Просрочен</th>
                </tr>
              </thead>
              <tbody>
                {expired.map((item: any) => {
                  const lossPct = (item.cold_loss_percent || 0) + (item.heat_loss_percent || 0);
                  const baseQty = item.current_balance ?? item.current_stock ?? 0;
                  const adjustedQty = Math.round(baseQty * (1 + lossPct / 100) * 100) / 100;
                  return (
                    <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2.5 font-medium">{item.name}</td>
                      <td className="px-3 py-2.5 text-red-600 font-medium">{baseQty}</td>
                      {settings.include_losses && <td className="px-3 py-2.5 text-orange-600 font-medium">{adjustedQty}</td>}
                      {settings.include_losses && <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lossPct > 0 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'text-zinc-400'}`}>{lossPct > 0 ? `${lossPct}%` : '—'}</span></td>}
                      <td className="px-3 py-2.5 text-zinc-500">{item.expiry_date}</td>
                      <td className="px-3 py-2.5 text-red-600 font-medium">{item.days_expired} дн.</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expiring soon */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={20} className="text-amber-500" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Истекает скоро</h2>
        </div>

        {expiring.length === 0 ? (
          <div className="text-center py-8 text-zinc-400"><p>✓ Нет продуктов с истекающим сроком</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Продукт</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Остаток</th>
                  {settings.include_losses && <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Потери %</th>}
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Срок до</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Осталось дней</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((item: any) => {
                  const lossPct = (item.cold_loss_percent || 0) + (item.heat_loss_percent || 0);
                  return (
                    <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2.5 font-medium">{item.name}</td>
                      <td className="px-3 py-2.5 font-medium">{item.current_balance ?? item.current_stock ?? 0}</td>
                      {settings.include_losses && <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lossPct > 0 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'text-zinc-400'}`}>{lossPct > 0 ? `${lossPct}%` : '—'}</span></td>}
                      <td className="px-3 py-2.5 text-zinc-500">{item.expiry_date}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.days_left <= 1 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                          {item.days_left} дн.
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Loss analysis */}
      {showLosses && lossData.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={20} className="text-orange-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Анализ потерь</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Продукт</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Факт. остаток</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Теор. расход</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Разница</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Потери %</th>
                </tr>
              </thead>
              <tbody>
                {lossData.map((item: any) => (
                  <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-3 py-2.5 font-medium">{item.name}</td>
                    <td className="px-3 py-2.5">{item.actual_quantity}</td>
                    <td className="px-3 py-2.5 text-orange-600">{item.theoretical_loss}</td>
                    <td className={`px-3 py-2.5 font-medium ${item.loss_difference > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{item.loss_difference}</td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-600">{item.total_loss_percent}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
