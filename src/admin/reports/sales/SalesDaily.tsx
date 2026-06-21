import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'avgOrderValue', label: 'Ср. стоимость', format: 'currency', align: 'right' },
  { key: 'itemsSold', label: 'Товаров', format: 'number', align: 'right' },
  { key: 'cancelled', label: 'Отмены', format: 'number', align: 'right' },
];

export default function SalesDaily({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesDaily({ from, to, branch_id: branchId })
      .then(res => { setData(res.data || []); setTotals(res.totals || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Ежедневные продажи</h2>
        <ExportButton data={data} columns={columns} filename="sales-daily" title="Ежедневные продажи" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего выручка</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.revenue ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего заказов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.orders ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Средний дневной оборот</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length ? Math.round((totals.revenue ?? 0) / data.length).toLocaleString() : 0} ₽</p>
        </div>
      </div>
      <ReportChart type="bar" data={data} xKey="date" yKey="revenue" title="Выручка по дням" />
      <ReportChart type="line" data={data} xKey="date" yKey="orders" title="Количество заказов" />
      <ReportTable columns={columns} data={data} summary={{ date: 'Итого', revenue: totals.revenue, orders: totals.orders, avgOrderValue: totals.avgOrderValue, itemsSold: totals.itemsSold, cancelled: totals.cancelled }} />
    </div>
  );
}
