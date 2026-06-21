import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'hour', label: 'Час', align: 'center' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'avgCheck', label: 'Средний чек', format: 'currency', align: 'right' },
  { key: 'itemsSold', label: 'Товаров', format: 'number', align: 'right' },
];

const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export default function SalesHourly({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesHourly({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalRevenue = data.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalOrders = data.reduce((s, r) => s + (r.orders || 0), 0);
  const peakHour = [...data].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Продажи по часам</h2>
        <ExportButton data={data} columns={columns} filename="sales-hourly" title="Продажи по часам" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего выручка</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalRevenue.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Пиковый час</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{peakHour ? `${peakHour.hour}:00` : '—'}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Пиковая выручка</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{peakHour ? (peakHour.revenue || 0).toLocaleString() : 0} ₽</p>
        </div>
      </div>
      <ReportChart type="bar" data={data} xKey="hour" yKey="revenue" title="Гистограмма выручки по часам" height={350} />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
