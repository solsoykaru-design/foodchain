import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'itemName', label: 'Товар' },
  { key: 'type', label: 'Тип' },
  { key: 'quantity', label: 'Количество', format: 'number', align: 'right' },
  { key: 'unit', label: 'Ед. изм.' },
  { key: 'beforeStock', label: 'До операции', format: 'number', align: 'right' },
  { key: 'afterStock', label: 'После операции', format: 'number', align: 'right' },
  { key: 'document', label: 'Документ' },
  { key: 'user', label: 'Пользователь' },
];

export default function MovementLog({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStockMovementLog({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const typeColors: Record<string, string> = {
    receipt: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    'write-off': 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    transfer: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    production: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    return: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  };

  const typeLabels: Record<string, string> = {
    receipt: 'Оприходование',
    'write-off': 'Списание',
    transfer: 'Перемещение',
    production: 'Производство',
    return: 'Возврат',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Журнал движений товаров</h2>
        <ExportButton data={data} columns={columns} filename="movement-log" title="Журнал движений" />
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
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all">
                {columns.map(col => {
                  const val = row[col.key];
                  if (col.key === 'type') {
                    return (
                      <td key={col.key} className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${typeColors[val] || 'bg-zinc-100 text-zinc-600'}`}>
                          {typeLabels[val] || val}
                        </span>
                      </td>
                    );
                  }
                  let display: string;
                  if (col.format === 'currency') display = `${Number(val || 0).toLocaleString()} ₽`;
                  else if (col.format === 'number') display = Number(val || 0).toLocaleString();
                  else if (col.format === 'percent') display = `${Number(val || 0).toFixed(1)}%`;
                  else if (col.format === 'date') {
                    const d = new Date(val);
                    display = isNaN(d.getTime()) ? String(val ?? '') : d.toLocaleDateString('ru-RU');
                  } else display = String(val ?? '');
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
