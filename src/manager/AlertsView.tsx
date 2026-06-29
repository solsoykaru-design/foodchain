import { useEffect, useState } from 'react';
import * as api from '../api';
import { AlertTriangle, Package, TrendingDown, Bell } from 'lucide-react';

export default function AlertsView() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [lowStock, pendingOrders] = await Promise.all([
        api.request('/api/inventory/low-stock').catch(() => []),
        api.request('/api/purchase-orders?status=draft').catch(() => []),
      ]);
      const list = [] as any[];
      if (Array.isArray(lowStock) && lowStock.length) {
        list.push({
          id: 'low-stock',
          type: 'warning',
          icon: <Package size={18} />,
          title: 'Низкий запас',
          message: `${lowStock.length} товаров ниже минимального остатка`,
        });
      }
      if (Array.isArray(pendingOrders) && pendingOrders.length) {
        list.push({
          id: 'pending-orders',
          type: 'info',
          icon: <Bell size={18} />,
          title: 'Заказы на утверждение',
          message: `${pendingOrders.length} заказов поставщикам ожидают решения`,
        });
      }
      setAlerts(list);
    } catch {}
    setLoading(false);
  };

  if (loading) return <div className="text-center py-12 text-zinc-500">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Алерты</h2>
      {alerts.length === 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center">
          <p className="text-emerald-700 dark:text-emerald-400 font-medium">Всё в порядке 🎉</p>
          <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">Нет критических алертов</p>
        </div>
      )}
      {alerts.map(a => (
        <div key={a.id} className={`rounded-2xl p-4 border flex items-start gap-3 ${a.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
          <div className={a.type === 'warning' ? 'text-amber-600' : 'text-blue-600'}>{a.icon}</div>
          <div>
            <p className="font-bold text-zinc-900 dark:text-white">{a.title}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{a.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
