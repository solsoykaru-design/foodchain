import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'accrued', label: 'Начислено', format: 'number', align: 'right' },
  { key: 'spent', label: 'Потрачено', format: 'number', align: 'right' },
  { key: 'balance', label: 'Баланс', format: 'number', align: 'right' },
  { key: 'customersWithBonus', label: 'Клиентов с бонусами', format: 'number', align: 'right' },
];

export default function BonusReport({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportMarketingBonusReport({ from, to, branch_id: branchId })
      .then(res => { setData(res.data || []); setTotals(res.totals || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Бонусный отчёт</h2>
        <ExportButton data={data} columns={columns} filename="bonus-report" title="Бонусный отчёт" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Начислено бонусов</p>
          <p className="text-2xl font-bold text-emerald-500">{(totals.accrued ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Потрачено бонусов</p>
          <p className="text-2xl font-bold text-red-500">{(totals.spent ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Текущий баланс</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.balance ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Клиентов с бонусами</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.customersWithBonus ?? 0).toLocaleString()}</p>
        </div>
      </div>
      <ReportChart type="area" data={data} xKey="date" yKey="accrued" yKey2="spent" title="Начисление и трата бонусов" />
      <ReportTable columns={columns} data={data} summary={{ date: 'Итого', accrued: totals.accrued, spent: totals.spent, balance: totals.balance, customersWithBonus: totals.customersWithBonus }} />
    </div>
  );
}
