import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'income', label: 'Доходы', format: 'currency', align: 'right' },
  { key: 'expense', label: 'Расходы', format: 'currency', align: 'right' },
  { key: 'balance', label: 'Баланс', format: 'currency', align: 'right' },
];

export default function IncomeExpense({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFinanceIncomeExpense({ from, to, branch_id: branchId })
      .then(res => { setData(res.data || []); setTotals(res.totals || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Доходы и расходы</h2>
        <ExportButton data={data} columns={columns} filename="income-expense" title="Доходы и расходы" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Доходы</p>
          <p className="text-2xl font-bold text-emerald-500">{(totals.income ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Расходы</p>
          <p className="text-2xl font-bold text-red-500">{(totals.expense ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Чистый баланс</p>
          <p className={`text-2xl font-bold ${(totals.balance ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {(totals.balance ?? 0).toLocaleString()} ₽
          </p>
        </div>
      </div>
      <ReportChart type="area" data={data} xKey="date" yKey="income" yKey2="expense" title="Доходы и расходы" />
      <ReportTable columns={columns} data={data} summary={{ date: 'Итого', income: totals.income, expense: totals.expense, balance: totals.balance }} />
    </div>
  );
}
