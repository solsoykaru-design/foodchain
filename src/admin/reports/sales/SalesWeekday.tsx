import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'weekday', label: 'День недели' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'avgCheck', label: 'Средний чек', format: 'currency', align: 'right' },
  { key: 'share', label: 'Доля', format: 'percent', align: 'right' },
];

const dayLabels: Record<string, string> = {
  '1': 'Понедельник', '2': 'Вторник', '3': 'Среда', '4': 'Четверг',
  '5': 'Пятница', '6': 'Суббота', '7': 'Воскресенье',
};

export default function SalesWeekday({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesWeekday({ from, to, branch_id: branchId })
      .then(res => setData((res.data || []).map((d: any) => ({ ...d, weekday: dayLabels[d.weekday] || d.weekday }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalRevenue = data.reduce((s, r) => s + (r.revenue || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Продажи по дням недели</h2>
        <ExportButton data={data} columns={columns} filename="sales-weekday" title="Продажи по дням недели" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {data.map((d: any) => (
          <div key={d.weekday} className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{d.weekday}</p>
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{(d.revenue || 0).toLocaleString()} ₽</p>
            <div className="mt-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(d.revenue / (totalRevenue || 1)) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="bar" data={data} xKey="weekday" yKey="revenue" title="Выручка по дням недели" />
        <ReportChart type="pie" data={data} nameKey="weekday" dataKey="revenue" title="Распределение выручки" />
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
