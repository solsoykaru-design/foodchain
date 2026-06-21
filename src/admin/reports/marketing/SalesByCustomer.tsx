import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'rank', label: '#', align: 'center' },
  { key: 'customerName', label: 'Клиент' },
  { key: 'phone', label: 'Телефон' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'totalSpent', label: 'Потрачено', format: 'currency', align: 'right' },
  { key: 'avgOrderValue', label: 'Ср. заказ', format: 'currency', align: 'right' },
  { key: 'lastOrderDate', label: 'Последний заказ', format: 'date' },
];

export default function SalesByCustomer({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportMarketingSalesByCustomer({ from, to, branch_id: branchId })
      .then(res => setData((res.data || []).map((d: any, i: number) => ({ ...d, rank: i + 1 }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalRevenue = data.reduce((s, r) => s + (r.totalSpent || 0), 0);
  const totalOrders = data.reduce((s, r) => s + (r.orders || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Продажи по клиентам</h2>
        <ExportButton data={data} columns={columns} filename="sales-by-customer" title="Продажи по клиентам" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Клиентов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Общая выручка</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalRevenue.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего заказов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalOrders.toLocaleString()}</p>
        </div>
      </div>
      <ReportChart type="bar" data={data.slice(0, 10)} xKey="customerName" yKey="totalSpent" title="Топ-10 клиентов по сумме" height={350} />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
