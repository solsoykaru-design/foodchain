import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'staffName', label: 'Сотрудник' },
  { key: 'tipsAmount', label: 'Сумма чаевых', format: 'currency', align: 'right' },
  { key: 'ordersServed', label: 'Обслужено заказов', format: 'number', align: 'right' },
  { key: 'avgTipPerOrder', label: 'Средний чаевые', format: 'currency', align: 'right' },
  { key: 'tipsShare', label: 'Доля чаевых', format: 'percent', align: 'right' },
];

export default function StaffTips({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStaffTips({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalTips = data.reduce((s, r) => s + (r.tipsAmount || 0), 0);
  const totalOrders = data.reduce((s, r) => s + (r.ordersServed || 0), 0);

  const byStaff = data.reduce((acc: Record<string, { tips: number; orders: number }>, r) => {
    const name = r.staffName || 'Неизвестно';
    if (!acc[name]) acc[name] = { tips: 0, orders: 0 };
    acc[name].tips += r.tipsAmount || 0;
    acc[name].orders += r.ordersServed || 0;
    return acc;
  }, {});

  const staffChart = Object.entries(byStaff).map(([name, val]) => ({ name, value: val.tips }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Чаевые</h2>
        <ExportButton data={data} columns={columns} filename="staff-tips" title="Чаевые" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего чаевых</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalTips.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Средние чаевые за заказ</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalOrders > 0 ? Math.round(totalTips / totalOrders).toLocaleString() : 0} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Обслужено заказов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalOrders.toLocaleString()}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="pie" data={staffChart} nameKey="name" dataKey="value" title="Распределение чаевых" height={300} />
        <ReportChart type="line" data={data} xKey="date" yKey="tipsAmount" title="Динамика чаевых" height={300} />
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
