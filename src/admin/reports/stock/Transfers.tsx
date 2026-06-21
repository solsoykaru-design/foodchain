import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'itemName', label: 'Товар' },
  { key: 'quantity', label: 'Количество', format: 'number', align: 'right' },
  { key: 'unit', label: 'Ед. изм.' },
  { key: 'fromWarehouse', label: 'Откуда' },
  { key: 'toWarehouse', label: 'Куда' },
  { key: 'status', label: 'Статус', align: 'center' },
  { key: 'user', label: 'Пользователь' },
];

export default function Transfers({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStockTransfers({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const completedCount = data.filter(d => d.status === 'completed').length;
  const pendingCount = data.filter(d => d.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Перемещения между складами</h2>
        <ExportButton data={data} columns={columns} filename="transfers" title="Перемещения" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего перемещений</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Выполнено</p>
          <p className="text-2xl font-bold text-emerald-500">{completedCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">В ожидании</p>
          <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
        </div>
      </div>
      <ReportChart type="bar" data={data} xKey="date" yKey="quantity" title="Интенсивность перемещений" />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
