import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'metric', label: 'Показатель' },
  { key: 'value', label: 'Значение', align: 'right' },
  { key: 'change', label: 'Изменение', format: 'percent', align: 'right' },
];

export default function FulfillmentSummary({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFulfillmentSummary({ from, to, branch_id: branchId })
      .then(res => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;

  const kpis = [
    { metric: 'Всего заказов', value: String(data.totalOrders || 0), change: data.ordersChange },
    { metric: 'Выполнено', value: String(data.completedOrders || 0), change: data.completedChange },
    { metric: 'Отменено', value: String(data.cancelledOrders || 0), change: data.cancelledChange },
    { metric: 'Среднее время готовки', value: `${data.avgPrepTime || 0} мин`, change: data.prepTimeChange },
    { metric: 'Среднее время доставки', value: `${data.avgDeliveryTime || 0} мин`, change: data.deliveryTimeChange },
  ];

  const tableData = kpis.map(k => ({ ...k, change: k.change ?? 0 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Сводка выполнения заказов</h2>
        <ExportButton data={tableData} columns={columns} filename="fulfillment-summary" title="Сводка выполнения" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего заказов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(data.totalOrders || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Выполнено</p>
          <p className="text-2xl font-bold text-emerald-500">{(data.completedOrders || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Отменено</p>
          <p className="text-2xl font-bold text-red-500">{(data.cancelledOrders || 0).toLocaleString()}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Среднее время готовки</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">{data.avgPrepTime || 0} <span className="text-lg font-normal text-zinc-500">мин</span></p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Среднее время доставки</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">{data.avgDeliveryTime || 0} <span className="text-lg font-normal text-zinc-500">мин</span></p>
        </div>
      </div>
      <ReportTable columns={columns} data={tableData} />
      {data.dailyData && data.dailyData.length > 0 && (
        <ReportChart type="line" data={data.dailyData} xKey="date" yKey="orders" title="Динамика заказов" />
      )}
    </div>
  );
}
