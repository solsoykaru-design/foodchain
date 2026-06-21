import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'product', label: 'Товар' },
  { key: 'category', label: 'Категория', align: 'center' },
  { key: 'quantity', label: 'Кол-во', format: 'number', align: 'right' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'revenueShare', label: 'Доля выручки', format: 'percent', align: 'right' },
  { key: 'cumulativeShare', label: 'Накоп. доля', format: 'percent', align: 'right' },
  { key: 'abcClass', label: 'Класс', align: 'center' },
];

export default function AbcAnalysis({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFinanceAbcAnalysis({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const classColors: Record<string, string> = {
    A: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
    B: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
    C: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">ABC-анализ</h2>
        <ExportButton data={data} columns={columns} filename="abc-analysis" title="ABC-анализ" />
      </div>
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-medium">
          <span className="w-3 h-3 rounded-full bg-emerald-500" /> A — 80% выручки
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-medium">
          <span className="w-3 h-3 rounded-full bg-amber-500" /> B — 15% выручки
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium">
          <span className="w-3 h-3 rounded-full bg-red-500" /> C — 5% выручки
        </div>
      </div>
      <ReportChart type="line" data={data} xKey="product" yKey="cumulativeShare" title="Накопленная доля выручки (кривая ABC)" height={300} />
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              {columns.map(col => (
                <th key={col.key} className={`px-4 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all">
                {columns.map(col => {
                  const val = row[col.key];
                  if (col.key === 'abcClass') {
                    return (
                      <td key={col.key} className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${classColors[val] || 'text-zinc-600 bg-zinc-100'}`}>{val}</span>
                      </td>
                    );
                  }
                  if (col.key === 'cumulativeShare') {
                    const share = val ?? 0;
                    const barColor = share <= 80 ? 'bg-emerald-500' : share <= 95 ? 'bg-amber-500' : 'bg-red-500';
                    return (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                            <div className={`${barColor} h-2 rounded-full`} style={{ width: `${Math.min(share, 100)}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                    );
                  }
                  const fmt = col.format;
                  let display: string;
                  if (fmt === 'currency') display = `${Number(val || 0).toLocaleString()} ₽`;
                  else if (fmt === 'number') display = Number(val || 0).toLocaleString();
                  else if (fmt === 'percent') display = `${Number(val || 0).toFixed(1)}%`;
                  else display = String(val ?? '');
                  return (
                    <td key={col.key} className={`px-4 py-3 text-zinc-700 dark:text-zinc-300 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>{display}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
