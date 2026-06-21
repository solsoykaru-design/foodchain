import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'item', label: 'Статья' },
  { key: 'amount', label: 'Сумма', format: 'currency', align: 'right' },
  { key: 'share', label: 'Доля', format: 'percent', align: 'right' },
];

export default function PnL({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFinancePnL({ from, to, branch_id: branchId })
      .then(res => setData(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;

  const renderSection = (title: string, items: any[], totalKey?: string, totalLabel?: string, color?: string) => (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {items.map((row: any, i: number) => (
            <tr key={i} className={`border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${row.isSubtotal ? 'bg-zinc-50 dark:bg-zinc-800/30 font-semibold' : ''}`}>
              <td className={`px-4 py-2.5 ${row.isSubtotal ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400'} ${row.indent ? 'pl-8' : ''}`}>{row.item}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${row.isSubtotal ? 'text-zinc-800 dark:text-zinc-200 font-semibold' : 'text-zinc-600 dark:text-zinc-400'}`}>
                {(row.amount || 0).toLocaleString()} ₽
              </td>
            </tr>
          ))}
          {totalKey && (
            <tr className="border-t-2 border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800/60 font-bold text-lg">
              <td className="px-4 py-3">{totalLabel || 'Итого'}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${color || 'text-zinc-900 dark:text-white'}`}>
                {(data[totalKey] || 0).toLocaleString()} ₽
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Отчёт о прибылях и убытках (PNL)</h2>
        <ExportButton data={data.income || []} columns={columns} filename="pnl" title="PNL" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Выручка</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(data.totalRevenue || 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Расходы</p>
          <p className="text-2xl font-bold text-red-500">{(data.totalExpenses || 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Чистая прибыль</p>
          <p className="text-2xl font-bold text-emerald-500">{(data.netProfit || 0).toLocaleString()} ₽</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderSection('Доходы', data.income || [], 'totalRevenue', 'Итого доходов')}
        {renderSection('Расходы', data.expenses || [], 'totalExpenses', 'Итого расходов', 'text-red-500')}
      </div>
      {renderSection('Чистая прибыль', [{ item: 'Прибыль', amount: data.netProfit || 0, isSubtotal: true }])}
    </div>
  );
}
