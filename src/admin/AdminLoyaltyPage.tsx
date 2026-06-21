import { useState, useEffect } from 'react';
import * as api from '../api';
import { Gift, Award, Settings, Users, Plus, Edit3, Trash2, X, TrendingUp, Clock, Percent, Save, Search, ChevronDown, ChevronUp, Filter, RefreshCw } from 'lucide-react';

export default function AdminLoyaltyPage() {
  const [tab, setTab] = useState<'settings' | 'guests'>('settings');
  const [settings, setSettings] = useState<any>(null);
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ userId: 0, userName: '', amount: 100, description: '' });
  const [guestSort, setGuestSort] = useState<string>('name');
  const [guestDir, setGuestDir] = useState<'asc' | 'desc'>('asc');
  const [editLevelIndex, setEditLevelIndex] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ls, g] = await Promise.all([
        api.getLoyaltySettings().catch(() => null),
        api.adminGetLoyaltyGuests().catch(() => []),
      ]);
      if (ls) {
        setSettings(ls);
        setLevels(ls.levels || []);
      }
      setGuests(g);
    } catch (e) {}
    setLoading(false);
  };

  const handleSettingsSave = async () => {
    setSaving(true);
    try {
      const result = await api.adminUpdateLoyaltySettings({
        bonusPercent: settings.bonusPercent,
        burnDays: settings.burnDays,
        maxWriteOffPercent: settings.maxWriteOffPercent,
        levels,
      });
      setSettings(result);
    } catch (e: any) { alert(e.message || 'Ошибка сохранения'); }
    setSaving(false);
  };

  const addLevel = () => {
    setLevels([...levels, { name: '', minSpent: 0, bonusPercent: 0, bonusMultiplier: 1, discountPercent: 0 }]);
    setEditLevelIndex(levels.length);
  };

  const updateLevel = (i: number, field: string, value: any) => {
    const updated = [...levels];
    updated[i] = { ...updated[i], [field]: value };
    setLevels(updated);
  };

  const removeLevel = (i: number) => {
    if (!confirm('Удалить уровень?')) return;
    setLevels(levels.filter((_, idx) => idx !== i));
  };

  const handleAdjust = async () => {
    if (!adjustForm.userId || !adjustForm.amount) return;
    try {
      await api.adminAdjustLoyalty(adjustForm.userId, adjustForm.amount, adjustForm.description);
      setShowAdjustModal(false);
      setAdjustForm({ userId: 0, userName: '', amount: 100, description: '' });
      loadData();
    } catch (e: any) { alert(e.message || 'Ошибка'); }
  };

  const sortedGuests = [...guests]
    .filter(g => !searchQuery || g.name?.toLowerCase().includes(searchQuery.toLowerCase()) || g.phone?.includes(searchQuery))
    .sort((a, b) => {
      let cmp = 0;
      if (guestSort === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (guestSort === 'balance') cmp = (a.bonusBalanceInternal || 0) - (b.bonusBalanceInternal || 0);
      else if (guestSort === 'spent') cmp = (a.totalSpent || 0) - (b.totalSpent || 0);
      return guestDir === 'asc' ? cmp : -cmp;
    });

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-zinc-300 border-t-orange-500 rounded-full animate-spin" /></div>;

  const tabs = [
    { id: 'settings' as const, label: 'Настройки', icon: Settings },
    { id: 'guests' as const, label: 'Гости', icon: Users },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Программа лояльности</h2>
          <p className="text-sm text-zinc-500 mt-1">Управление бонусной системой, уровнями и балансами гостей</p>
        </div>
        <div className="flex gap-2">
          {tab === 'guests' && (
            <button onClick={() => setShowAdjustModal(true)} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-600">
              <Plus size={18} /> Начислить / Списать
            </button>
          )}
          <button onClick={loadData} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700">
            <RefreshCw size={16} /> Обновить
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 text-sm w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition ${tab === t.id ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div className="space-y-6">
          {/* Main Settings */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2"><Settings size={18} /> Основные настройки</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1.5">Процент начисления бонусов</label>
                <div className="relative">
                  <input type="number" value={settings?.bonusPercent || ''} onChange={e => setSettings({ ...settings, bonusPercent: Number(e.target.value) })} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">%</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">Сколько % от суммы заказа получает гость бонусами</p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1.5">Максимум бонусов в заказе</label>
                <div className="relative">
                  <input type="number" value={settings?.maxWriteOffPercent || ''} onChange={e => setSettings({ ...settings, maxWriteOffPercent: Number(e.target.value) })} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">%</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">Максимальный % от заказа, который можно оплатить бонусами</p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1.5">Сгорание бонусов (дни)</label>
                <input type="number" value={settings?.burnDays || ''} onChange={e => setSettings({ ...settings, burnDays: Number(e.target.value) })} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                <p className="text-xs text-zinc-400 mt-1">0 — отключить сгорание. Бонусы старше N дней сгорают</p>
              </div>
            </div>
          </div>

          {/* Levels */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2"><TrendingUp size={18} /> Уровни лояльности</h3>
              <button onClick={addLevel} className="flex items-center gap-1.5 bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-600"><Plus size={14} /> Уровень</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Название</th>
                    <th className="text-right p-3 text-zinc-500 font-medium text-xs">Порог (₽)</th>
                    <th className="text-right p-3 text-zinc-500 font-medium text-xs">% бонусов</th>
                    <th className="text-right p-3 text-zinc-500 font-medium text-xs">Множитель</th>
                    <th className="text-right p-3 text-zinc-500 font-medium text-xs">% скидки</th>
                    <th className="p-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {levels.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-zinc-400">Нет уровней. Добавьте первый уровень</td></tr>
                  ) : levels.map((lvl, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="p-3">
                        <input value={lvl.name} onChange={e => updateLevel(i, 'name', e.target.value)} placeholder="Название" className="w-28 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                      </td>
                      <td className="p-3">
                        <input type="number" value={lvl.minSpent || ''} onChange={e => updateLevel(i, 'minSpent', Number(e.target.value))} className="w-24 text-right border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                      </td>
                      <td className="p-3">
                        <div className="relative w-20 ml-auto">
                          <input type="number" value={lvl.bonusPercent || ''} onChange={e => updateLevel(i, 'bonusPercent', Number(e.target.value))} className="w-full text-right border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pr-5" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <input type="number" step="0.1" value={lvl.bonusMultiplier || 1} onChange={e => updateLevel(i, 'bonusMultiplier', Number(e.target.value))} className="w-20 text-right border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                      </td>
                      <td className="p-3">
                        <div className="relative w-20 ml-auto">
                          <input type="number" value={lvl.discountPercent || ''} onChange={e => updateLevel(i, 'discountPercent', Number(e.target.value))} className="w-full text-right border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pr-5" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <button onClick={() => removeLevel(i)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-400 mt-3">Уровни сортируются по порогу. Первый уровень — начальный (новичок). Множитель влияет на итоговый % начисления бонусов.</p>
          </div>

          <button onClick={handleSettingsSave} disabled={saving} className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50">
            {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Сохранение...</> : <><Save size={18} /> Сохранить настройки</>}
          </button>
        </div>
      )}

      {tab === 'guests' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по имени или телефону..." className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <span className="text-xs text-zinc-500">{sortedGuests.length} гостей</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs cursor-pointer select-none" onClick={() => { setGuestSort('name'); setGuestDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                    <span className="flex items-center gap-1">Гость {guestSort === 'name' && (guestDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
                  </th>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">Телефон</th>
                  <th className="text-right p-3 text-zinc-500 font-medium text-xs cursor-pointer select-none" onClick={() => { setGuestSort('balance'); setGuestDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                    <span className="flex items-center gap-1 justify-end">Баланс {guestSort === 'balance' && (guestDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
                  </th>
                  <th className="text-right p-3 text-zinc-500 font-medium text-xs cursor-pointer select-none" onClick={() => { setGuestSort('spent'); setGuestDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                    <span className="flex items-center gap-1 justify-end">Потрачено {guestSort === 'spent' && (guestDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
                  </th>
                  <th className="text-right p-3 text-zinc-500 font-medium text-xs">Начислено</th>
                  <th className="text-right p-3 text-zinc-500 font-medium text-xs">Потрачено бонусов</th>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">Уровень</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedGuests.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-zinc-400">Нет гостей</td></tr>
                ) : sortedGuests.map(g => (
                  <tr key={g.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="p-3 font-medium text-zinc-900 dark:text-white">{g.name || '—'}</td>
                    <td className="p-3 text-zinc-500 text-xs">{g.phone || '—'}</td>
                    <td className="p-3 text-right font-bold text-green-500">{g.bonusBalanceInternal || 0}₽</td>
                    <td className="p-3 text-right text-zinc-900 dark:text-white font-medium">{g.totalSpent?.toLocaleString() || 0}₽</td>
                    <td className="p-3 text-right text-zinc-500">{g.lifetimeEarned || 0}₽</td>
                    <td className="p-3 text-right text-zinc-500">{g.lifetimeSpent || 0}₽</td>
                    <td className="p-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                        {g.loyaltyLevel || 'новичок'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button onClick={() => { setAdjustForm({ userId: g.id, userName: g.name || g.phone, amount: 100, description: '' }); setShowAdjustModal(true); }} className="text-xs text-blue-500 hover:text-blue-600 font-medium">Корректировка</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAdjustModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Корректировка бонусов</h3>
              <button onClick={() => setShowAdjustModal(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Гость</label>
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3">
                  <Search size={16} className="text-zinc-400 shrink-0" />
                  <input list="guestList" value={adjustForm.userName} onChange={e => {
                    const name = e.target.value;
                    setAdjustForm({ ...adjustForm, userName: name });
                    const found = guests.find(g => g.name === name || g.phone === name);
                    if (found) setAdjustForm({ ...adjustForm, userId: found.id, userName: found.name || found.phone });
                  }} placeholder="Введите имя или телефон..." className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white outline-none placeholder-zinc-400" />
                </div>
                <datalist id="guestList">
                  {guests.map(g => <option key={g.id} value={g.name || g.phone} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Сумма (положительная — начислить, отрицательная — списать)</label>
                <input type="number" value={adjustForm.amount || ''} onChange={e => setAdjustForm({ ...adjustForm, amount: Number(e.target.value) })} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Описание</label>
                <input value={adjustForm.description} onChange={e => setAdjustForm({ ...adjustForm, description: e.target.value })} placeholder="Например: Бонус за отзыв" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
              <button onClick={handleAdjust} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-orange-600 active:scale-[0.97]">
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}