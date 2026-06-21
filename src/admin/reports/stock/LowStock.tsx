import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'name', label: 'Товар' },
  { key: 'article', label: 'Артикул' },
  { key: 'currentStock', label: 'Текущий остаток', format: 'number', align: 'right' },
  { key: 'minStock', label: 'Мин. остаток', format: 'number', align: 'right' },
  { key: 'unit', label: 'Ед. изм.' },
  { key: 'deficit', label: 'Дефицит', format: 'number', align: 'right' },
  { key: 'branch', label: 'Филиал' },
];

export default function LowStock({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStockLowStock({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const criticalCount = data.filter(d => (d.currentStock || 0) <= 0).length;
  const warningCount = data.filter(d => (d.currentStock || 0) > 0 && (d.currentStock || 0) <= (d.minStock || 0)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Остатки ниже нормы</h2>
        <ExportButton data={data} columns={columns} filename="low-stock" title="Остатки ниже нормы" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Критический остаток (0)</p>
          <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ниже минимума</p>
          <p className="text-2xl font-bold text-amber-500">{warningCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего позиций</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
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
              <tr key={i} className={`border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 transition-all ${
                (row.currentStock || 0) <= 0 ? 'bg-red-50 dark:bg-red-900/10' :
                (row.currentStock || 0) <= (row.minStock || 0) * 0.5 ? 'bg-orange-50 dark:bg-orange-900/10' :
                'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
              }`}>
                {columns.map(col => {
                  const val = row[col.key];
                  let display: string;
                  if (col.format === 'currency') display = `${Number(val || 0).toLocaleString()} ₽`;
                  else if (col.format === 'number') display = Number(val || 0).toLocaleString();
                  else if (col.format === 'percent') display = `${Number(val || 0).toFixed(1)}%`;
                  else if (col.format === 'date') {
                    const d = new Date(val);
                    display = isNaN(d.getTime()) ? String(val ?? '') : d.toLocaleDateString('ru-RU');
                  } else display = String(val ?? '');
                  return (
                    <td key={col.key} className={`px-4 py-3 text-zinc-700 dark:text-zinc-300 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                      {col.key === 'currentStock' ? (
                        <span className={`font-semibold ${(val || 0) <= 0 ? 'text-red-500' : (val || 0) <= (row.minStock || 0) * 0.5 ? 'text-orange-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                          {display}
                        </span>
                      ) : display}
                    </td>
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
