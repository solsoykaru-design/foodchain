import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'systemAmount', label: 'Сумма в системе', format: 'currency', align: 'right' },
  { key: 'actualAmount', label: 'Фактическая сумма', format: 'currency', align: 'right' },
  { key: 'difference', label: 'Расхождение', format: 'currency', align: 'right' },
  { key: 'status', label: 'Статус', align: 'center' },
];

export default function Reconciliation({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFinanceReconciliation({ from, to, branch_id: branchId })
      .then(res => { setData(res.data || []); setTotals(res.totals || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const matchCount = data.filter(d => d.status === 'ok').length;
  const mismatchCount = data.filter(d => d.status === 'mismatch').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Сверка платежей</h2>
        <ExportButton data={data} columns={columns} filename="reconciliation" title="Сверка платежей" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">В системе</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.systemAmount ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Фактически</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.actualAmount ?? 0).toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Совпало</p>
          <p className="text-2xl font-bold text-emerald-500">{matchCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Расхождений</p>
          <p className="text-2xl font-bold text-red-500">{mismatchCount}</p>
        </div>
      </div>
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              {columns.map(col => (
                <th key={col.key} className={`px-4 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={`border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 transition-all ${row.status === 'mismatch' ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}`}>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{new Date(row.date).toLocaleDateString('ru-RU')}</td>
                <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 tabular-nums">{(row.systemAmount || 0).toLocaleString()} ₽</td>
                <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300 tabular-nums">{(row.actualAmount || 0).toLocaleString()} ₽</td>
                <td className={`px-4 py-3 text-right tabular-nums font-medium ${Math.abs(row.difference || 0) > 0 ? 'text-red-500' : 'text-zinc-700 dark:text-zinc-300'}`}>{(row.difference || 0).toLocaleString()} ₽</td>
                <td className="px-4 py-3 text-center">
                  {row.status === 'ok' ? (
                    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">Совпадает</span>
                  ) : (
                    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">Расхождение</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
