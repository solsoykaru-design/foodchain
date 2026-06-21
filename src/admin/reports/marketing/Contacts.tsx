import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'date', label: 'Дата', format: 'date' },
  { key: 'contactType', label: 'Тип контакта' },
  { key: 'count', label: 'Количество', format: 'number', align: 'right' },
  { key: 'uniqueContacts', label: 'Уникальных', format: 'number', align: 'right' },
  { key: 'conversionToOrder', label: 'Конверсия в заказ', format: 'percent', align: 'right' },
];

export default function Contacts({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportMarketingContacts({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const totalContacts = data.reduce((s, r) => s + (r.count || 0), 0);
  const totalUnique = data.reduce((s, r) => s + (r.uniqueContacts || 0), 0);

  const byType = data.reduce((acc: Record<string, { count: number; orders: number }>, r) => {
    const t = r.contactType || 'Другое';
    if (!acc[t]) acc[t] = { count: 0, orders: 0 };
    acc[t].count += r.count || 0;
    acc[t].orders += r.conversionToOrder || 0;
    return acc;
  }, {});

  const chartData = Object.entries(byType).map(([name, val]) => ({ name, value: val.count }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Контакты</h2>
        <ExportButton data={data} columns={columns} filename="contacts" title="Контакты" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Всего контактов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalContacts.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Уникальных контактов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalUnique.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Типов контактов</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{Object.keys(byType).length}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="pie" data={chartData} nameKey="name" dataKey="value" title="Распределение по типам" height={300} />
        <ReportChart type="bar" data={data} xKey="date" yKey="count" title="Контакты по дням" height={300} />
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
