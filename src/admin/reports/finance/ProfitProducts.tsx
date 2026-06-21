import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'rank', label: '#', align: 'center' },
  { key: 'product', label: 'Товар' },
  { key: 'quantity', label: 'Кол-во', format: 'number', align: 'right' },
  { key: 'revenue', label: 'Выручка', format: 'currency', align: 'right' },
  { key: 'cost', label: 'Себестоимость', format: 'currency', align: 'right' },
  { key: 'profit', label: 'Прибыль', format: 'currency', align: 'right' },
  { key: 'margin', label: 'Маржа', format: 'percent', align: 'right' },
];

export default function ProfitProducts({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportFinanceProfitProducts({ from, to, branch_id: branchId })
      .then(res => setData((res.data || []).map((d: any, i: number) => ({ ...d, rank: i + 1 }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const top10 = [...data].sort((a, b) => (b.profit || 0) - (a.profit || 0)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Прибыль по товарам</h2>
        <ExportButton data={data} columns={columns} filename="profit-products" title="Прибыль по товарам" />
      </div>
      <ReportChart type="bar" data={top10.reverse()} xKey="product" yKey="profit" title="Топ-10 товаров по прибыли" height={400} />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
