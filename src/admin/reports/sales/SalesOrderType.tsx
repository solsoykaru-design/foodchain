import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'type', label: 'Тип заказа' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'avgCheck', label: 'Средний чек', format: 'currency', align: 'right' },
  { key: 'share', label: 'Доля', format: 'percent', align: 'right' },
];

const typeLabels: Record<string, string> = {
  delivery: 'Доставка',
  pickup: 'Самовывоз',
  dine_in: 'В заведении',
};

export default function SalesOrderType({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesOrderType({ from, to, branch_id: branchId })
      .then(res => setData((res.data || []).map((d: any) => ({ ...d, type: typeLabels[d.type] || d.type }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Типы заказов</h2>
        <ExportButton data={data} columns={columns} filename="order-type" title="Типы заказов" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="pie" data={data} nameKey="type" dataKey="revenue" title="Выручка по типам" height={300} />
        <div className="space-y-4">
          {data.map((d: any, i: number) => (
            <div key={d.type} className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between items-center mb-2">
                <p className="font-medium text-zinc-900 dark:text-white">{d.type}</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-white">{(d.revenue || 0).toLocaleString()} ₽</p>
              </div>
              <div className="flex justify-between text-sm text-zinc-500 mb-1">
                <span>Заказов: {(d.orders || 0).toLocaleString()}</span>
                <span>Средний чек: {(d.avgCheck || 0).toLocaleString()} ₽</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
