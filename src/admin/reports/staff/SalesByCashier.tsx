import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'rank', label: '#', align: 'center' },
  { key: 'cashierName', label: 'Кассир' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'avgCheck', label: 'Средний чек', format: 'currency', align: 'right' },
  { key: 'itemsPerOrder', label: 'Товаров/заказ', format: 'number', align: 'right' },
  { key: 'share', label: 'Доля', format: 'percent', align: 'right' },
];

export default function SalesByCashier({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStaffSalesByCashier({ from, to, branch_id: branchId })
      .then(res => setData((res.data || []).map((d: any, i: number) => ({ ...d, rank: i + 1 }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Продажи по кассирам</h2>
        <ExportButton data={data} columns={columns} filename="sales-by-cashier" title="Продажи по кассирам" />
      </div>
      <ReportChart type="bar" data={data} xKey="cashierName" yKey="revenue" title="Выручка по кассирам" />
      <ReportChart type="bar" data={data} xKey="cashierName" yKey="orders" title="Заказы по кассирам" />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
