import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'issuerName', label: 'Выдающий' },
  { key: 'ordersIssued', label: 'Выдано заказов', format: 'number', align: 'right' },
  { key: 'itemsIssued', label: 'Выдано товаров', format: 'number', align: 'right' },
  { key: 'avgTime', label: 'Среднее время', align: 'right' },
  { key: 'branch', label: 'Филиал' },
];

export default function Issuers({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFulfillmentIssuers({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Выдачи заказов</h2>
        <ExportButton data={data} columns={columns} filename="issuers" title="Выдачи заказов" />
      </div>
      <ReportChart type="bar" data={data} xKey="issuerName" yKey="ordersIssued" title="Количество выдач по сотрудникам" />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
