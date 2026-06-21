import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'cash', label: 'Наличные', format: 'currency', align: 'right' },
  { key: 'card', label: 'Карта', format: 'currency', align: 'right' },
  { key: 'online', label: 'Онлайн', format: 'currency', align: 'right' },
  { key: 'total', label: 'Всего', format: 'currency', align: 'right' },
  { key: 'transactionCount', label: 'Операций', format: 'number', align: 'right' },
];

export default function PaymentsDaily({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFinancePaymentsDaily({ from, to, branch_id: branchId })
      .then(res => { setData(res.data || []); setTotals(res.totals || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Платежи по дням</h2>
        <ExportButton data={data} columns={columns} filename="payments-daily" title="Платежи по дням" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Наличные</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.cash ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Карта</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.card ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Онлайн</p>
          <p className="text-2xl font-bold text-blue-500">{(totals.online ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.total ?? 0).toLocaleString()} ₽</p>
        </div>
      </div>
      <ReportChart type="bar" data={data} xKey="date" yKey="total" title="Платежи по дням" />
      <ReportChart type="line" data={data} xKey="date" yKey="cash" yKey2="card" title="Наличные vs Карта" />
      <ReportTable columns={columns} data={data} summary={{ date: 'Итого', cash: totals.cash, card: totals.card, online: totals.online, total: totals.total, transactionCount: totals.transactionCount }} />
    </div>
  );
}
