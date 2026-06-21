import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'branch', label: 'Филиал' },
  { key: 'month', label: 'Месяц' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'avgCheck', label: 'Средний чек', format: 'currency', align: 'right' },
  { key: 'share', label: 'Доля', format: 'percent', align: 'right' },
];

export default function SalesBranchesMonthly({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesBranchesMonthly({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const branchNames = [...new Set(data.map(d => d.branch))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Продажи по филиалам (помесячно)</h2>
        <ExportButton data={data} columns={columns} filename="branches-monthly" title="Продажи по филиалам помесячно" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="bar" data={data} xKey="month" yKey="revenue" title="Выручка по месяцам и филиалам" />
        <ReportChart type="pie" data={branchNames.map(b => ({ name: b, revenue: data.filter(d => d.branch === b).reduce((s, d) => s + (d.revenue || 0), 0) }))} nameKey="name" dataKey="revenue" title="Доля филиалов" />
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
