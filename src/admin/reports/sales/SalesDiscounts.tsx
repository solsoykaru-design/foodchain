import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'discountAmount', label: 'Скидки', format: 'currency', align: 'right' },
  { key: 'discountPercent', label: 'Доля скидок', format: 'percent', align: 'right' },
  { key: 'ordersWithDiscount', label: 'Заказов со скидкой', format: 'number', align: 'right' },
  { key: 'totalOrders', label: 'Всего заказов', format: 'number', align: 'right' },
];

export default function SalesDiscounts({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesDiscounts({ from, to, branch_id: branchId })
      .then(res => { setData(res.data || []); setTotals(res.totals || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Анализ скидок</h2>
        <ExportButton data={data} columns={columns} filename="sales-discounts" title="Анализ скидок" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Сумма скидок</p>
          <p className="text-2xl font-bold text-red-500">{(totals.discountAmount ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Доля скидок</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{((totals.discountPercent ?? 0)).toFixed(1)}%</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Заказов со скидкой</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.ordersWithDiscount ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего заказов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.totalOrders ?? 0).toLocaleString()}</p>
        </div>
      </div>
      <ReportChart type="composed" data={data} xKey="date" yKey="revenue" yKey2="discountAmount" title="Выручка и скидки" />
      <ReportTable columns={columns} data={data} summary={{ date: 'Итого', revenue: totals.revenue, discountAmount: totals.discountAmount, discountPercent: totals.discountPercent, ordersWithDiscount: totals.ordersWithDiscount, totalOrders: totals.totalOrders }} />
    </div>
  );
}
