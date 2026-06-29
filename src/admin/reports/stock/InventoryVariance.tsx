import { useEffect, useState } from 'react';
import * as api from '../../../api';

export default function InventoryVariance({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    api.request(`/api/reports/inventory-variance?${q.toString()}`).then(setData).catch(() => {});
  }, [from, to]);

  if (!data) return <p>Загрузка...</p>;
  const { rows, summary } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border bg-white dark:bg-zinc-900"><p className="text-xs opacity-70">Актов</p><p className="text-xl font-bold">{summary.totalCounts}</p></div>
        <div className="p-3 rounded-xl border bg-white dark:bg-zinc-900"><p className="text-xs opacity-70">Позиций</p><p className="text-xl font-bold">{summary.totalItems}</p></div>
        <div className="p-3 rounded-xl border bg-white dark:bg-zinc-900"><p className="text-xs opacity-70">Излишки</p><p className="text-xl font-bold text-green-600">+{summary.positiveSum.toFixed(2)}₽</p></div>
        <div className="p-3 rounded-xl border bg-white dark:bg-zinc-900"><p className="text-xs opacity-70">Недостачи</p><p className="text-xl font-bold text-red-600">{summary.negativeSum.toFixed(2)}₽</p></div>
      </div>
      <div className="overflow-auto rounded-xl border dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-800"><tr><th className="px-3 py-2 text-left">Дата</th><th className="px-3 py-2 text-left">Товар</th><th className="px-3 py-2 text-right">Ожидалось</th><th className="px-3 py-2 text-right">Факт</th><th className="px-3 py-2 text-right">Разница</th><th className="px-3 py-2 text-right">Сумма</th></tr></thead>
          <tbody>
            {rows.map((r: any, idx: number) => (
              <tr key={idx} className="border-t dark:border-zinc-800">
                <td className="px-3 py-2">{r.countedAt ? new Date(r.countedAt).toLocaleDateString('ru-RU') : '—'}</td>
                <td className="px-3 py-2">{r.itemName}</td>
                <td className="px-3 py-2 text-right">{r.expectedQuantity} {r.unit}</td>
                <td className="px-3 py-2 text-right">{r.actualQuantity} {r.unit}</td>
                <td className={`px-3 py-2 text-right font-semibold ${r.difference > 0 ? 'text-green-600' : r.difference < 0 ? 'text-red-600' : ''}`}>{r.difference > 0 ? '+' : ''}{r.difference}</td>
                <td className="px-3 py-2 text-right">{(r.difference * r.pricePerUnit).toFixed(2)}₽</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
