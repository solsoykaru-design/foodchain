import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'source', label: 'Источник' },
  { key: 'amount', label: 'Сумма', format: 'currency', align: 'right' },
  { key: 'count', label: 'Количество', format: 'number', align: 'right' },
  { key: 'share', label: 'Доля', format: 'percent', align: 'right' },
];

export default function SalesPaymentSources({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesPaymentSources({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const total = data.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Источники оплат</h2>
        <ExportButton data={data} columns={columns} filename="payment-sources" title="Источники оплат" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReportChart type="pie" data={data} nameKey="source" dataKey="amount" title="Распределение по источникам" height={320} />
        <div className="space-y-4">
          {data.map((d: any) => (
            <div key={d.source} className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between items-center mb-2">
                <p className="font-medium text-zinc-900 dark:text-white">{d.source}</p>
                <p className="font-bold text-zinc-900 dark:text-white">{(d.amount || 0).toLocaleString()} ₽</p>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5">
                <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${((d.amount || 0) / (total || 1)) * 100}%` }} />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{((d.share ?? 0)).toFixed(1)}% от общего объема</p>
            </div>
          ))}
        </div>
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
