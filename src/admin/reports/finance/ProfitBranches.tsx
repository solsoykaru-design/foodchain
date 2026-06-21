import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'branch', label: 'Филиал' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'cost', label: 'Себестоимость', format: 'currency', align: 'right' },
  { key: 'grossProfit', label: 'Валовая прибыль', format: 'currency', align: 'right' },
  { key: 'margin', label: 'Маржа', format: 'percent', align: 'right' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
];

export default function ProfitBranches({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFinanceProfitBranches({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Прибыль по филиалам</h2>
        <ExportButton data={data} columns={columns} filename="profit-branches" title="Прибыль по филиалам" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="bar" data={data} xKey="branch" yKey="grossProfit" title="Валовая прибыль по филиалам" />
        <ReportChart type="bar" data={data} xKey="branch" yKey="margin" title="Маржа по филиалам" />
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
