import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'orderId', label: 'Заказ #', align: 'center' },
  { key: 'type', label: 'Тип' },
  { key: 'status', label: 'Статус', align: 'center' },
  { key: 'prepTime', label: 'Время готовки' },
  { key: 'totalTime', label: 'Общее время' },
  { key: 'items', label: 'Позиций', format: 'number', align: 'right' },
  { key: 'amount', label: 'Сумма', format: 'currency', align: 'right' },
];

export default function FulfillmentOrders({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFulfillmentOrders({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const avgPrepTime = data.reduce((s, r) => s + (parseInt(r.prepTime) || 0), 0) / (data.length || 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Выполнение заказов</h2>
        <ExportButton data={data} columns={columns} filename="fulfillment-orders" title="Выполнение заказов" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего заказов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Среднее время готовки</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{Math.round(avgPrepTime)} мин</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Общая выручка</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString()} ₽</p>
        </div>
      </div>
      <ReportChart type="composed" data={data} xKey="date" yKey="amount" yKey2="items" title="Заказы: сумма и позиции" />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
