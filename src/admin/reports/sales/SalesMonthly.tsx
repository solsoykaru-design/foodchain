import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'month', label: 'Месяц' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'avgCheck', label: 'Средний чек', format: 'currency', align: 'right' },
  { key: 'growth', label: 'Рост', format: 'percent', align: 'right' },
];

export default function SalesMonthly({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesMonthly({ from, to, branch_id: branchId })
      .then(res => { setData(res.data || []); setTotals(res.totals || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Помесячные продажи</h2>
        <ExportButton data={data} columns={columns} filename="sales-monthly" title="Помесячные продажи" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Выручка</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.revenue ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Заказы</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.orders ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Средний чек</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.avgCheck ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ср. рост</p>
          <p className="text-2xl font-bold text-emerald-500">{(totals.avgGrowth ?? 0).toFixed(1)}%</p>
        </div>
      </div>
      <ReportChart type="bar" data={data} xKey="month" yKey="revenue" title="Выручка по месяцам" />
      <ReportTable columns={columns} data={data} summary={{ month: 'Итого', revenue: totals.revenue, orders: totals.orders, avgCheck: totals.avgCheck }} />
    </div>
  );
}
