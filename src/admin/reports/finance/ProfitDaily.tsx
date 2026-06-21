import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'cost', label: 'Себестоимость', format: 'currency', align: 'right' },
  { key: 'grossProfit', label: 'Валовая прибыль', format: 'currency', align: 'right' },
  { key: 'margin', label: 'Маржа', format: 'percent', align: 'right' },
];

export default function ProfitDaily({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFinanceProfitDaily({ from, to, branch_id: branchId })
      .then(res => { setData(res.data || []); setTotals(res.totals || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Прибыль по дням</h2>
        <ExportButton data={data} columns={columns} filename="profit-daily" title="Прибыль по дням" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Выручка</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.revenue ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Себестоимость</p>
          <p className="text-2xl font-bold text-orange-500">{(totals.cost ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Валовая прибыль</p>
          <p className="text-2xl font-bold text-emerald-500">{(totals.grossProfit ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Маржа</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{((totals.margin ?? 0)).toFixed(1)}%</p>
        </div>
      </div>
      <ReportChart type="composed" data={data} xKey="date" yKey="revenue" yKey2="grossProfit" title="Выручка и валовая прибыль" />
      <ReportChart type="line" data={data} xKey="date" yKey="margin" title="Динамика маржи" />
      <ReportTable columns={columns} data={data} summary={{ date: 'Итого', revenue: totals.revenue, cost: totals.cost, grossProfit: totals.grossProfit, margin: totals.margin }} />
    </div>
  );
}
