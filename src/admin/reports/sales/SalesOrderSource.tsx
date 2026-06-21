import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'source', label: 'Источник' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'avgOrderValue', label: 'Ср. стоимость', format: 'currency', align: 'right' },
  { key: 'share', label: 'Доля', format: 'percent', align: 'right' },
];

export default function SalesOrderSource({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesOrderSource({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Источники заказов</h2>
        <ExportButton data={data} columns={columns} filename="order-source" title="Источники заказов" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="pie" data={data} nameKey="source" dataKey="orders" title="Распределение заказов" height={300} />
        <ReportChart type="bar" data={data} xKey="source" yKey="revenue" title="Выручка по источникам" height={300} />
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
