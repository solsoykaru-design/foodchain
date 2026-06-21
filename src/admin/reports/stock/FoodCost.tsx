import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import * as api from '../../../api';

interface FoodCostItem {
  id: number; name: string; category: string;
  price: number; cost: number; margin: number;
  has_tech_card: boolean; ingredient_count: number;
}

export default function FoodCost() {
  const [data, setData] = useState<FoodCostItem[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'margin' | 'price'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState<'all' | 'with_tc' | 'without_tc'>('all');

  useEffect(() => {
    api.get('/api/reports/food-cost').then((res: any) => {
      setData(res.data || []);
      setTotals(res.totals || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = data
    .filter(d => filter === 'all' || (filter === 'with_tc' && d.has_tech_card) || (filter === 'without_tc' && !d.has_tech_card))
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return mul * a.name.localeCompare(b.name);
      return mul * ((a as any)[sortBy] - (b as any)[sortBy]);
    });

  const chartData = filtered.filter(d => d.has_tech_card).slice(0, 15).map(d => ({
    name: d.name.length > 20 ? d.name.slice(0, 20) + '…' : d.name,
    себестоимость: d.cost,
    цена: d.price,
  }));

  const hc = 'px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 select-none';
  const rc = 'px-4 py-3 text-sm border-t border-zinc-100 dark:border-zinc-800';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Фудкост / Себестоимость</h2>
          {totals && (
            <p className="text-sm text-zinc-500 mt-1">
              {totals.with_tech_card} блюд с техкартой из {totals.total_dishes} • Средняя себестоимость: {totals.avg_cost}₽ • Средняя маржа: {totals.avg_margin}%
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {(['all', 'with_tc', 'without_tc'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
              {f === 'all' ? 'Все' : f === 'with_tc' ? 'С техкартой' : 'Без техкарты'}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-4">Топ-15 блюд по себестоимости</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}₽`} />
              <Bar dataKey="себестоимость" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="цена" fill="#94a3b8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/40">
                <th className={hc} onClick={() => { setSortBy('name'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>Блюдо</th>
                <th className={hc}>Категория</th>
                <th className={`${hc} text-right`} onClick={() => { setSortBy('price'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>Цена, ₽</th>
                <th className={`${hc} text-right`} onClick={() => { setSortBy('cost'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>Себестоимость, ₽</th>
                <th className={`${hc} text-right`} onClick={() => { setSortBy('margin'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>Маржа, %</th>
                <th className={hc}>Техкарта</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className={`${rc} font-medium text-zinc-900 dark:text-white`}>{d.name}</td>
                  <td className={`${rc} text-zinc-500`}>{d.category}</td>
                  <td className={`${rc} text-right text-zinc-900 dark:text-white`}>{d.price.toLocaleString()}</td>
                  <td className={`${rc} text-right font-medium ${d.cost > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                    {d.cost > 0 ? d.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className={`${rc} text-right font-medium`}>
                    {d.margin > 0 ? (
                      <span className={d.margin < 30 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}>
                        {d.margin}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className={rc}>
                    {d.has_tech_card ? (
                      <span className="text-green-600 dark:text-green-400 text-xs font-medium bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                        {d.ingredient_count} инг.
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Нет</span>
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
