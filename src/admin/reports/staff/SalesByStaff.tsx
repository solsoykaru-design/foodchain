import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'rank', label: '#', align: 'center' },
  { key: 'staffName', label: 'Сотрудник' },
  { key: 'role', label: 'Должность' },
  { key: 'orders', label: 'Заказы', format: 'number', align: 'right' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'avgOrderValue', label: 'Ср. стоимость', format: 'currency', align: 'right' },
  { key: 'rating', label: 'Рейтинг', format: 'number', align: 'right' },
];

export default function SalesByStaff({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStaffSalesByStaff({ from, to, branch_id: branchId })
      .then(res => setData((res.data || []).map((d: any, i: number) => ({ ...d, rank: i + 1 }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Продажи по сотрудникам</h2>
        <ExportButton data={data} columns={columns} filename="sales-by-staff" title="Продажи по сотрудникам" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="bar" data={data} xKey="staffName" yKey="revenue" title="Выручка по сотрудникам" height={350} />
        <ReportChart type="bar" data={data} xKey="staffName" yKey="rating" title="Рейтинг сотрудников" height={350} />
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
