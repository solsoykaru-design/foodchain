import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'newConnections', label: 'Новые подключения', format: 'number', align: 'right' },
  { key: 'totalCards', label: 'Всего карт', format: 'number', align: 'right' },
  { key: 'activeCards', label: 'Активных карт', format: 'number', align: 'right' },
  { key: 'conversionRate', label: 'Конверсия', format: 'percent', align: 'right' },
];

export default function CardConnections({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportMarketingCardConnections({ from, to, branch_id: branchId })
      .then(res => { setData(res.data || []); setTotals(res.totals || {}); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Подключения карт лояльности</h2>
        <ExportButton data={data} columns={columns} filename="card-connections" title="Подключения карт" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Новые подключения</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.newConnections ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего карт</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{(totals.totalCards ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Активных карт</p>
          <p className="text-2xl font-bold text-emerald-500">{(totals.activeCards ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Конверсия</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{((totals.conversionRate ?? 0)).toFixed(1)}%</p>
        </div>
      </div>
      <ReportChart type="bar" data={data} xKey="date" yKey="newConnections" title="Новые подключения по дням" />
      <ReportChart type="line" data={data} xKey="date" yKey="totalCards" yKey2="activeCards" title="Всего vs Активных карт" />
      <ReportTable columns={columns} data={data} summary={{ date: 'Итого', newConnections: totals.newConnections, totalCards: totals.totalCards, activeCards: totals.activeCards }} />
    </div>
  );
}
