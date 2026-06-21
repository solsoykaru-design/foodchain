import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'paymentType', label: 'Тип оплаты' },
  { key: 'amount', label: 'Сумма', format: 'currency', align: 'right' },
  { key: 'count', label: 'Операций', format: 'number', align: 'right' },
  { key: 'share', label: 'Доля', format: 'percent', align: 'right' },
];

const typeLabels: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  telegram_stars: 'Telegram Stars',
  yookassa: 'ЮKassa',
  tinkoff: 'Tinkoff',
  sbp: 'СБП',
};

export default function SalesPaymentType({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportSalesPaymentType({ from, to, branch_id: branchId })
      .then(res => setData((res.data || []).map((d: any) => ({ ...d, paymentType: typeLabels[d.paymentType] || d.paymentType }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Типы оплат</h2>
        <ExportButton data={data} columns={columns} filename="payment-type" title="Типы оплат" />
      </div>
      <ReportChart type="pie" data={data} nameKey="paymentType" dataKey="amount" title="Распределение по типам оплат" height={300} />
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
