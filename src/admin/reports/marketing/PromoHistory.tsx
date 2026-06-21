import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'promoName', label: 'Акция' },
  { key: 'promoCode', label: 'Код' },
  { key: 'usageCount', label: 'Использований', format: 'number', align: 'right' },
  { key: 'discountTotal', label: 'Скидка всего', format: 'currency', align: 'right' },
  { key: 'revenueGenerated', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'effectiveness', label: 'Эффективность', format: 'percent', align: 'right' },
];

export default function PromoHistory({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportMarketingPromoHistory({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalDiscount = data.reduce((s, r) => s + (r.discountTotal || 0), 0);
  const totalRevenue = data.reduce((s, r) => s + (r.revenueGenerated || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">История акций</h2>
        <ExportButton data={data} columns={columns} filename="promo-history" title="История акций" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего акций</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Сумма скидок</p>
          <p className="text-2xl font-bold text-red-500">{totalDiscount.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Выручка по акциям</p>
          <p className="text-2xl font-bold text-emerald-500">{totalRevenue.toLocaleString()} ₽</p>
        </div>
      </div>
      <ReportChart type="bar" data={data} xKey="promoName" yKey="usageCount" title="Использования акций" />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
