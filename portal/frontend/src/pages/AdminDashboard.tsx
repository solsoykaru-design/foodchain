import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { RefreshCw, TrendingUp, Users, ShoppingCart, DollarSign, Award } from 'lucide-react';

export function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await api.adminGetDashboard();
      setData(d);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-zinc-400">Загрузка...</div></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Глобальный дашборд</h1>
        <button onClick={handleRefresh} disabled={refreshing}
          className="border border-zinc-300 text-zinc-700 font-medium px-4 py-2 rounded-xl hover:bg-zinc-50 transition text-sm flex items-center gap-2">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Обновить
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3"><Users size={20} className="text-blue-600" /></div>
          <div className="text-2xl font-bold text-zinc-900">{data?.active_tenants ?? 0}</div>
          <div className="text-sm text-zinc-500">Активных арендаторов</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3"><DollarSign size={20} className="text-green-600" /></div>
          <div className="text-2xl font-bold text-zinc-900">{(data?.monthly_revenue ?? 0).toLocaleString('ru-RU')} ₽</div>
          <div className="text-sm text-zinc-500">Выручка за месяц</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3"><ShoppingCart size={20} className="text-purple-600" /></div>
          <div className="text-2xl font-bold text-zinc-900">{data?.monthly_orders ?? 0}</div>
          <div className="text-sm text-zinc-500">Заказов за месяц</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3"><TrendingUp size={20} className="text-amber-600" /></div>
          <div className="text-2xl font-bold text-zinc-900">{data?.avg_order ? Math.round(data.avg_order).toLocaleString('ru-RU') : 0} ₽</div>
          <div className="text-sm text-zinc-500">Средний чек</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-bold text-zinc-900 mb-4">Динамика подключений</h2>
          {data?.signups?.length > 0 ? (
            <div className="space-y-2">
              {data.signups.slice(-14).map((s: any) => (
                <div key={s.date} className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-500 w-24 shrink-0">{s.date}</span>
                  <div className="flex-1 h-5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all" style={{ width: `${Math.min(100, (s.count / (Math.max(...data.signups.map((x: any) => x.count)) || 1)) * 100)}%` }} />
                  </div>
                  <span className="font-bold text-zinc-700 w-6 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-zinc-400 text-sm">Нет данных</p>}
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <h2 className="font-bold text-zinc-900 mb-4">Топ-10 по выручке</h2>
          {data?.top_by_revenue?.length > 0 ? (
            <div className="space-y-2">
              {data.top_by_revenue.map((t: any, i: number) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-zinc-400 w-5 shrink-0">#{i + 1}</span>
                    <span className="truncate text-zinc-900">{t.name}</span>
                  </div>
                  <span className="font-bold text-zinc-700 shrink-0 ml-2">{t.total.toLocaleString('ru-RU')} ₽</span>
                </div>
              ))}
            </div>
          ) : <p className="text-zinc-400 text-sm">Нет данных</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Link to="/admin/tickets" className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition flex items-center justify-between group">
          <div>
            <h3 className="font-bold text-zinc-900">Тикеты поддержки</h3>
            <p className="text-sm text-zinc-500 mt-1">Управление обращениями арендаторов</p>
          </div>
          <Award size={20} className="text-zinc-300 group-hover:text-orange-500 transition" />
        </Link>
        <Link to="/admin/monitoring" className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition flex items-center justify-between group">
          <div>
            <h3 className="font-bold text-zinc-900">Мониторинг</h3>
            <p className="text-sm text-zinc-500 mt-1">Доступность и нагрузка</p>
          </div>
          <TrendingUp size={20} className="text-zinc-300 group-hover:text-orange-500 transition" />
        </Link>
      </div>
    </div>
  );
}
