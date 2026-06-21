import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'branch', label: 'Филиал' },
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'avgCheck', label: 'Средний чек', format: 'currency', align: 'right' },
];

export default function SalesBranchesDaily({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesBranchesDaily({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const branchNames = [...new Set(data.map(d => d.branch))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Продажи по филиалам (ежедневно)</h2>
        <ExportButton data={data} columns={columns} filename="branches-daily" title="Продажи по филиалам" />
      </div>
      {branchNames.map(branch => (
        <ReportChart key={branch} type="line" data={data.filter(d => d.branch === branch)} xKey="date" yKey="revenue" title={branch} height={200} />
      ))}
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
