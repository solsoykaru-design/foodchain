import { useEffect, useState } from 'react';
import * as api from '../api';
import { TrendingUp, TrendingDown, DollarSign, Users, ChefHat, ShoppingBag } from 'lucide-react';

interface DashboardViewProps {
  onNavigate?: (tab: 'dashboard' | 'orders' | 'alerts') => void;
}

const CACHE_KEY = 'fc_manager_dashboard';

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const [ordersRes, financeRes, lowStock] = await Promise.all([
        api.request(`/api/orders?date=${today}`),
        api.request(`/api/finance/summary?date=${today}`).catch(() => ({} as any)),
        api.request('/api/inventory/low-stock').catch(() => []),
      ]);
      const orders = Array.isArray(ordersRes) ? ordersRes : [];
      const revenue = orders.reduce((s: number, o: any) => s + (o.total || 0), 0);
      const data = {
        revenue,
        orderCount: orders.length,
        avgCheck: orders.length ? revenue / orders.length : 0,
        lowStockCount: Array.isArray(lowStock) ? lowStock.length : 0,
        cash: financeRes.cash || 0,
        loadedAt: new Date().toISOString(),
      };
      setMetrics(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setCached(false);
    } catch {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        try { setMetrics(JSON.parse(saved)); setCached(true); } catch {}
      }
    }
    setLoading(false);
  };

  if (loading) return <div className="text-center py-12 text-zinc-500">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Сегодня</h2>
        {cached && <span className="text-xs text-amber-500">Кэшированные данные</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<DollarSign size={20} />} label="Выручка" value={`${Math.round(metrics?.revenue || 0).toLocaleString()} ₽`} trend="up" />
        <MetricCard icon={<ShoppingBag size={20} />} label="Заказов" value={metrics?.orderCount || 0} />
        <MetricCard icon={<Users size={20} />} label="Средний чек" value={`${Math.round(metrics?.avgCheck || 0).toLocaleString()} ₽`} />
        <MetricCard icon={<ChefHat size={20} />} label="Низкий запас" value={metrics?.lowStockCount || 0} trend={metrics?.lowStockCount > 0 ? 'down' : undefined} />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
        <h3 className="font-bold mb-3">Быстрые действия</h3>
        <div className="space-y-2">
          <QuickAction label="Утвердить заказы поставщикам" to="orders" onNavigate={onNavigate} />
          <QuickAction label="Проверить алерты" to="alerts" onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: React.ReactNode; trend?: 'up' | 'down' }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-500">{icon}</span>
        {trend === 'up' && <TrendingUp size={16} className="text-emerald-500" />}
        {trend === 'down' && <TrendingDown size={16} className="text-red-500" />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  );
}

function QuickAction({ label, to, onNavigate }: { label: string; to: 'orders' | 'alerts'; onNavigate?: (tab: any) => void }) {
  return (
    <button
      onClick={() => onNavigate?.(to)}
      className="w-full text-left px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-sm font-medium"
    >
      {label} →
    </button>
  );
}
