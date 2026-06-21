import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'itemName', label: 'Товар' },
  { key: 'article', label: 'Артикул' },
  { key: 'estimatedStock', label: 'Оценочный остаток', format: 'number', align: 'right' },
  { key: 'unit', label: 'Ед. изм.' },
  { key: 'avgPrice', label: 'Средняя цена', format: 'currency', align: 'right' },
  { key: 'estimatedValue', label: 'Оценочная стоимость', format: 'currency', align: 'right' },
];

export default function EstimatedBalance({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStockEstimatedBalance({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalValue = data.reduce((s, r) => s + (r.estimatedValue || 0), 0);
  const totalStock = data.reduce((s, r) => s + (r.estimatedStock || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Оценочный остаток</h2>
        <ExportButton data={data} columns={columns} filename="estimated-balance" title="Оценочный остаток" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Общая стоимость</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalValue.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Общий остаток</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalStock.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Позиций</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
        </div>
      </div>
      <ReportChart type="bar" data={data.slice(0, 15)} xKey="itemName" yKey="estimatedValue" title="Топ-15 по оценочной стоимости" height={350} />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
