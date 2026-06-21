import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'dailyRevenue', label: 'Дневная выручка', format: 'currency', align: 'right' },
  { key: 'cumulativeRevenue', label: 'Накоп. выручка', format: 'currency', align: 'right' },
  { key: 'dailyOrders', label: 'Заказов за день', format: 'number', align: 'right' },
  { key: 'cumulativeOrders', label: 'Накоп. заказов', format: 'number', align: 'right' },
];

export default function SalesCumulative({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesCumulative({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const finalCumulative = data.length > 0 ? data[data.length - 1] : {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Накопительные продажи</h2>
        <ExportButton data={data} columns={columns} filename="sales-cumulative" title="Накопительные продажи" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Итоговая накопленная выручка</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(finalCumulative.cumulativeRevenue || 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Итоговое накопленное кол-во заказов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(finalCumulative.cumulativeOrders || 0).toLocaleString()}</p>
        </div>
      </div>
      <ReportChart type="area" data={data} xKey="date" yKey="cumulativeRevenue" title="Накопленная выручка" />
      <ReportChart type="line" data={data} xKey="date" yKey="dailyRevenue" title="Дневная выручка" />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
