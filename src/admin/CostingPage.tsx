import { useState, useEffect, useCallback } from 'react';
import { Calculator, RefreshCw, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function CostingPage() {
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'margin' | 'cost' | 'price'>('margin');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, st] = await Promise.all([
        api.getCostingOverview().catch(() => []),
        api.getCostingStatus().catch(() => null),
      ]);
      setDishes(overview);
      setStatus(st);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const recalcAll = async () => {
    setBusy(true);
    try {
      const result = await api.recalculateAllCosts();
      addToast(`Обновлено: ${result.updated}/${result.total} блюд`, 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
    setBusy(false);
  };

  const recalcOne = async (id: number) => {
    try {
      const result = await api.recalculateDishCost(id);
      if (result.success) {
        addToast(`Себестоимость: ${result.cost}₽`, 'info');
        load();
      }
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const getColorByMargin = (margin: number) => {
    if (margin >= 40) return 'text-emerald-600';
    if (margin >= 20) return 'text-blue-600';
    if (margin >= 10) return 'text-amber-600';
    return 'text-red-600';
  };

  const sorted = [...dishes]
    .filter(d => !search || d.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = sortBy === 'margin' ? (a.margin_percent || 0) : sortBy === 'cost' ? (a.cost || 0) : (a.price || 0);
      const vb = sortBy === 'margin' ? (b.margin_percent || 0) : sortBy === 'cost' ? (b.cost || 0) : (b.price || 0);
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const avgMargin = dishes.length > 0 ? Math.round(dishes.reduce((s, d) => s + (d.margin_percent || 0), 0) / dishes.length * 10) / 10 : 0;
  const withCost = dishes.filter(d => d.cost > 0).length;
  const withoutTechCard = dishes.filter(d => !d.tech_card_id).length;

  if (loading) {
    return <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm"><div className="text-center py-12 text-zinc-400">Загрузка...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <Calculator size={22} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Калькуляция себестоимости</h1>
          <p className="text-sm text-zinc-500">Расчёт себестоимости блюд по текущим ценам ингредиентов</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">Всего блюд</p>
          <p className="text-2xl font-bold">{dishes.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">С рассчитанной себестоимостью</p>
          <p className="text-2xl font-bold text-blue-600">{withCost}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">Без техкарты</p>
          <p className="text-2xl font-bold text-amber-600">{withoutTechCard}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-zinc-500">Средняя маржа</p>
          <p className={`text-2xl font-bold ${getColorByMargin(avgMargin)}`}>{avgMargin}%</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none max-w-xs flex-1" placeholder="Поиск блюда..." />
        <button onClick={recalcAll} disabled={busy}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">
          {busy ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Пересчитать всё
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Блюдо</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500 cursor-pointer" onClick={() => { setSortBy('price'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                  Цена <ArrowUpDown size={12} className="inline" />
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500 cursor-pointer" onClick={() => { setSortBy('cost'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                  Себестоимость <ArrowUpDown size={12} className="inline" />
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Ингредиентов</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500 cursor-pointer" onClick={() => { setSortBy('margin'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>
                  Маржа <ArrowUpDown size={12} className="inline" />
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Техкарта</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Действия</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-zinc-400">Нет данных</td></tr>
              ) : sorted.map((d: any) => (
                <tr key={d.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-3 py-2.5 font-medium">{d.name}</td>
                  <td className="px-3 py-2.5 font-medium">{d.price} ₽</td>
                  <td className="px-3 py-2.5">{d.cost ? `${d.cost} ₽` : <span className="text-zinc-400">—</span>}</td>
                  <td className="px-3 py-2.5 text-zinc-500">{d.ing_count || 0}</td>
                  <td className="px-3 py-2.5">
                    {d.price > 0 ? (
                      <span className={`font-semibold flex items-center gap-1 ${getColorByMargin(d.margin_percent || 0)}`}>
                        {d.margin_percent >= 40 ? <TrendingUp size={14} /> : d.margin_percent >= 20 ? <TrendingUp size={14} className="text-blue-500" /> : <TrendingDown size={14} />}
                        {d.margin_percent}%
                      </span>
                    ) : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {d.tech_card_id ? (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">Есть</span>
                    ) : (
                      <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">Нет</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {d.tech_card_id && (
                      <button onClick={() => recalcOne(d.id)} className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg transition">
                        Пересчитать
                      </button>
                    )}
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
