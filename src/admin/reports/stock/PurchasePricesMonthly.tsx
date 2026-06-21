import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'month', label: 'Месяц' },
  { key: 'itemName', label: 'Товар' },
  { key: 'avgPrice', label: 'Средняя цена', format: 'currency', align: 'right' },
  { key: 'minPrice', label: 'Мин. цена', format: 'currency', align: 'right' },
  { key: 'maxPrice', label: 'Макс. цена', format: 'currency', align: 'right' },
  { key: 'priceChange', label: 'Изменение', format: 'percent', align: 'right' },
  { key: 'quantity', label: 'Кол-во', format: 'number', align: 'right' },
];

export default function PurchasePricesMonthly({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStockPurchasePricesMonthly({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const itemNames = [...new Set(data.map(d => d.itemName))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Цены закупок по месяцам</h2>
        <ExportButton data={data} columns={columns} filename="purchase-prices" title="Цены закупок" />
      </div>
      {itemNames.slice(0, 5).map(name => (
        <ReportChart key={name} type="line" data={data.filter(d => d.itemName === name)} xKey="month" yKey="avgPrice" title={name} height={200} />
      ))}
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
