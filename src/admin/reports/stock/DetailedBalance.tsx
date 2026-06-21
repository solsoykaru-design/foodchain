import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'itemName', label: 'Товар' },
  { key: 'article', label: 'Артикул' },
  { key: 'batch', label: 'Партия' },
  { key: 'quantity', label: 'Количество', format: 'number', align: 'right' },
  { key: 'unit', label: 'Ед. изм.' },
  { key: 'price', label: 'Цена', format: 'currency', align: 'right' },
  { key: 'total', label: 'Сумма', format: 'currency', align: 'right' },
  { key: 'expiryDate', label: 'Срок годности', format: 'date' },
  { key: 'warehouse', label: 'Склад' },
];

export default function DetailedBalance({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStockDetailedBalance({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalQty = data.reduce((s, r) => s + (r.quantity || 0), 0);
  const totalValue = data.reduce((s, r) => s + (r.total || 0), 0);
  const expiredCount = data.filter(r => r.expiryDate && new Date(r.expiryDate) < new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Детальный остаток</h2>
        <ExportButton data={data} columns={columns} filename="detailed-balance" title="Детальный остаток" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего позиций</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Общее количество</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalQty.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Общая стоимость</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalValue.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Просрочено</p>
          <p className={`text-2xl font-bold ${expiredCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{expiredCount}</p>
        </div>
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
