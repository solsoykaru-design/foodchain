import { useState, useEffect, useMemo } from 'react';
import { Network, TrendingUp, Users, ShoppingBag, CreditCard, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import * as api from '../../../api';
import ReportChart from '../components/ReportChart';
import ReportTable from '../components/ReportTable';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'branch_name', label: 'Точка' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'avg_check', label: 'Средний чек', format: 'currency', align: 'right' },
  { key: 'guests', label: 'Гостей', format: 'number', align: 'right' },
  { key: 'revenue_growth_percent', label: 'Рост', format: 'percent', align: 'right' },
];

function fmtCurrency(n: number) {
  return `${Number(n || 0).toLocaleString()} ₽`;
}

function Growth({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-zinc-400"><Minus size={16} className="inline" /></span>;
  const up = value >= 0;
  return (
    <span className={`flex items-center justify-end gap-1 ${up ? 'text-green-500' : 'text-red-500'}`}>
      {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function NetworkDashboard({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportNetworkDashboard({ from, to })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to]);

  const trendByBranch = useMemo(() => {
    if (!data?.trend) return [];
    const map: Record<string, any> = {};
    data.trend.forEach((row: any) => {
      if (!map[row.date]) map[row.date] = { date: row.date };
      map[row.date][row.branch_name] = row.revenue;
    });
    return Object.values(map);
  }, [data]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return <div className="text-center py-12 text-zinc-400">Ошибка загрузки</div>;

  const overall = data.overall || {};
  const branches = data.branches || [];

  const kpi = [
    { icon: CreditCard, label: 'Выручка', value: fmtCurrency(overall.revenue), sub: <Growth value={overall.revenue_growth_percent} /> },
    { icon: ShoppingBag, label: 'Заказы', value: Number(overall.orders || 0).toLocaleString(), sub: `Точек: ${overall.branches_count || 0}` },
    { icon: Users, label: 'Гостей', value: Number(overall.guests || 0).toLocaleString(), sub: null },
    { icon: TrendingUp, label: 'Средний чек', value: fmtCurrency(overall.avg_check), sub: null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Network size={22} /> Консолидированная аналитика по сети</h2>
        <ExportButton data={branches} columns={columns} filename="network-dashboard" title="Аналитика по сети" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpi.map((k, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 mb-2 text-zinc-500 dark:text-zinc-400 text-sm">
              <k.icon size={18} />
              <span>{k.label}</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{k.value}</p>
            {k.sub && <div className="mt-1 text-xs">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="bar" data={branches} xKey="branch_name" yKey="revenue" title="Выручка по точкам" />
        <ReportChart type="bar" data={branches} xKey="branch_name" yKey="orders" title="Заказы по точкам" />
      </div>

      {trendByBranch.length > 0 && (
        <ReportChart type="line" data={trendByBranch} xKey="date" title="Динамика выручки по точкам" height={360} />
      )}

      <ReportTable columns={columns} data={branches} />
    </div>
  );
}
