import { useState, useEffect } from 'react';
import * as api from '../../../api';
import ReportTable from '../components/ReportTable';
import ReportChart from '../components/ReportChart';
import ExportButton from '../components/ExportButton';
import type { ColumnDef } from '../components/ExportButton';

const columns: ColumnDef[] = [
  { key: 'itemName', label: 'Товар' },
  { key: 'calories', label: 'Калории', format: 'number', align: 'right' },
  { key: 'proteins', label: 'Белки', format: 'number', align: 'right' },
  { key: 'fats', label: 'Жиры', format: 'number', align: 'right' },
  { key: 'carbs', label: 'Углеводы', format: 'number', align: 'right' },
  { key: 'unit', label: 'На 100 г' },
  { key: 'category', label: 'Категория' },
];

export default function Calories({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReportStockCalories({ from, to, branch_id: branchId })
      .then(res => setData(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const avgCalories = data.length ? Math.round(data.reduce((s, r) => s + (r.calories || 0), 0) / data.length) : 0;

  const categoryCalories = data.reduce((acc: Record<string, { calories: number; count: number }>, r) => {
    const cat = r.category || 'Без категории';
    if (!acc[cat]) acc[cat] = { calories: 0, count: 0 };
    acc[cat].calories += r.calories || 0;
    acc[cat].count += 1;
    return acc;
  }, {});

  const chartData = Object.entries(categoryCalories).map(([name, val]) => ({
    name,
    value: Math.round(val.calories / val.count),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Калорийность товаров</h2>
        <ExportButton data={data} columns={columns} filename="calories" title="Калорийность" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Позиций</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Средняя калорийность</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{avgCalories.toLocaleString()} ккал</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Макс. калорийность</p>
          <p className="text-2xl font-bold text-orange-500">{Math.max(...data.map(d => d.calories || 0)).toLocaleString()} ккал</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChart type="bar" data={data.slice(0, 15)} xKey="itemName" yKey="calories" title="Топ-15 по калорийности" height={350} />
        <ReportChart type="pie" data={chartData} nameKey="name" dataKey="value" title="Средняя калорийность по категориям" height={350} />
      </div>
      <ReportTable columns={columns} data={data} />
    </div>
  );
}
