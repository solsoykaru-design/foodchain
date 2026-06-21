import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'staffName', label: 'Сотрудник' },
  { key: 'role', label: 'Должность' },
  { key: 'bonusAmount', label: 'Начислено', format: 'currency', align: 'right' },
  { key: 'bonusReason', label: 'Основание' },
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'paidStatus', label: 'Статус', align: 'center' },
];

export default function StaffBonuses({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStaffBonuses({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalBonuses = data.reduce((s, r) => s + (r.bonusAmount || 0), 0);
  const paidCount = data.filter(d => d.paidStatus === 'paid').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Бонусы сотрудникам</h2>
        <ExportButton data={data} columns={columns} filename="staff-bonuses" title="Бонусы сотрудников" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего начислено</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalBonuses.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Выплачено</p>
          <p className="text-2xl font-bold text-emerald-500">{paidCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Записей</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
        </div>
      </div>
      <ReportChart type="bar" data={data} xKey="staffName" yKey="bonusAmount" title="Бонусы по сотрудникам" />
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
                  if (col.key === 'paidStatus') {
                    const isPaid = val === 'paid';
                    return (
                      <td key={col.key} className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isPaid ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        }`}>{isPaid ? 'Выплачено' : 'Начислено'}</span>
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
