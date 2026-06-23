import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, ShoppingBag, TrendingUp, UsersRound, Users, CalendarDays, ChevronLeft, ChevronRight, Clock, BarChart3, Pizza, ArrowUp, ArrowDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import * as api from '../api';
import { onEvent } from '../api';
import type { Order } from '../types';

const STATUS_COLORS: Record<string, string> = { new: '#3b82f6', confirmed: '#06b6d4', preparing: '#f59e0b', ready: '#8b5cf6', assigned: '#6b7280', en_route: '#f97316', delivered: '#22c55e', cancelled: '#ef4444' };
const PIE_COLORS = ['#3b82f6', '#06b6d4', '#f59e0b', '#8b5cf6', '#6b7280', '#f97316', '#22c55e', '#ef4444'];

function StatCard({ label, value, icon: Icon, color, trend }: { label: string; value: string; icon: any; color: string; trend?: { up: boolean; text: string } }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}><Icon size={20} className="text-white" /></div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-bold ${trend.up ? 'text-green-500' : 'text-red-500'}`}>
            {trend.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{trend.text}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</p>
      <p className="text-sm text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const STATUS_LABELS: Record<string, string> = { new: t('status_new'), confirmed: t('status_confirmed'), preparing: t('status_preparing'), ready: t('status_ready'), assigned: t('status_assigned'), en_route: t('status_en_route'), delivered: t('status_delivered'), cancelled: t('status_cancelled') };
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [chartRange, setChartRange] = useState<'7' | '30'>('7');
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const today = new Date().toISOString().slice(0, 10);
      setSelectedDate(prev => prev < today ? today : prev);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [ordersData, usersData, staffData, invData] = await Promise.all([
        api.getOrders(), api.getUsers(), api.getStaff(), api.getInventory({ limit: 999 })
      ]);
      setOrders(ordersData || []);
      setUsers(usersData || []);
      setStaff(staffData || []);
      const alerts = (invData || []).filter((i: any) => i.minStock && i.currentStock < i.minStock);
      setStockAlerts(alerts.slice(0, 10));
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const unsub1 = onEvent('order:new', (order: Order) => setOrders(prev => [order, ...prev]));
    const unsub2 = onEvent('order:update', (order: Order) => setOrders(prev => prev.map(o => o.id === order.id ? order : o)));
    return () => { unsub1(); unsub2(); };
  }, []);

  const dayOrders = orders.filter(o => o.createdAt?.slice(0, 10) === selectedDate);
  const dayRevenue = dayOrders.reduce((s, o) => s + (o.total || 0), 0);
  const dayAvgCheck = dayOrders.length ? Math.round(dayRevenue / dayOrders.length) : 0;
  const dayDelivered = dayOrders.filter(o => o.status === 'delivered').length;
  const dayNewUsers = users.filter(u => u.created_at?.slice(0, 10) === selectedDate).length;

  const allTimeRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const allTimeOrders = orders.length;
  const allTimeDelivered = orders.filter(o => o.status === 'delivered').length;

  const prevDate = new Date(selectedDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevOrders = orders.filter(o => o.createdAt?.slice(0, 10) === prevDate.toISOString().slice(0, 10));
  const prevRevenue = prevOrders.reduce((s, o) => s + (o.total || 0), 0);
  const revTrend = prevRevenue > 0 ? ((dayRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : '0';

  const chartDays = Array.from({ length: Number(chartRange) }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (Number(chartRange) - 1 - i));
    const ds = d.toISOString().slice(0, 10);
    const ords = orders.filter(o => o.createdAt?.slice(0, 10) === ds);
    return { name: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), revenue: ords.reduce((s, o) => s + (o.total || 0), 0), orders: ords.length };
  });

  const statusCounts = Object.entries(STATUS_LABELS).map(([key, label]) => ({ name: label, value: orders.filter(o => o.status === key).length, key }));
  const statusWithOrders = statusCounts.filter(s => s.value > 0);
  const pieData = statusWithOrders.length > 0 ? statusWithOrders : [{ name: t('dashboard_no_orders'), value: 1, key: 'none' }];

  const hourCounts = Array.from({ length: 24 }, (_, i) => {
    const count = orders.filter(o => o.createdAt && new Date(o.createdAt).getHours() === i).length;
    return { hour: `${i}:00`, count };
  });

  const trendDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const ds = d.toISOString().slice(0, 10);
    const count = orders.filter(o => o.createdAt?.slice(0, 10) === ds).length;
    return { name: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), count };
  });

  const dishCounts: Record<string, { name: string; count: number; revenue: number }> = {};
  orders.filter(o => o.status === 'delivered').forEach(o => {
    (o.items || []).forEach((item: any) => {
      const dishName = item.name || item.dishName || 'Блюдо';
      if (!dishCounts[dishName]) dishCounts[dishName] = { name: dishName, count: 0, revenue: 0 };
      dishCounts[dishName].count += item.quantity || 1;
      dishCounts[dishName].revenue += (item.price || 0) * (item.quantity || 1);
    });
  });
  const topDishes = Object.values(dishCounts).sort((a, b) => b.count - a.count).slice(0, 5);

  const recentOrders = orders.slice(0, 10);

  const changeDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    if (d <= new Date()) setSelectedDate(d.toISOString().slice(0, 10));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header with date selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('sidebar_dashboard')}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{t('dashboard_overview')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-blue-500 transition-colors active:scale-[0.97]" title={t('topbar_refresh')}><RefreshCw size={18} /></button>
          <div className="flex items-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
            <button onClick={() => changeDay(-1)} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 active:scale-[0.97]"><ChevronLeft size={18} /></button>
            <div className="flex items-center gap-2 px-3 py-1.5 border-x border-zinc-200 dark:border-zinc-700">
              <CalendarDays size={16} className="text-blue-500 cursor-pointer" onClick={() => dateInputRef.current?.showPicker()} />
              <input type="date" ref={dateInputRef} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} max={new Date().toISOString().slice(0, 10)}
                className="bg-transparent text-sm font-medium text-zinc-900 dark:text-white outline-none w-[130px]" />
            </div>
            <button onClick={() => changeDay(1)} disabled={selectedDate >= new Date().toISOString().slice(0, 10)} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30 active:scale-[0.97]"><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label={t('dashboard_revenue')} value={`${dayRevenue.toLocaleString()}₽`} icon={DollarSign} color="from-green-500 to-emerald-500" trend={{ up: Number(revTrend) >= 0, text: `${revTrend}%` }} />
        <StatCard label={t('dashboard_orders')} value={String(dayOrders.length)} icon={ShoppingBag} color="from-blue-500 to-cyan-500" />
        <StatCard label={t('dashboard_avg_check')} value={`${dayAvgCheck.toLocaleString()}₽`} icon={TrendingUp} color="from-purple-500 to-pink-500" />
        <StatCard label={t('dashboard_new_clients')} value={String(dayNewUsers)} icon={UsersRound} color="from-orange-500 to-red-500" />
        <StatCard label={t('dashboard_delivered')} value={String(dayDelivered)} icon={BarChart3} color="from-emerald-500 to-teal-500" />
      </div>

      {/* Second row: quick numbers & status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-3xl font-bold">{allTimeOrders}</p>
          <p className="text-sm text-blue-100 mt-1">{t('dashboard_total_orders')}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-3xl font-bold">{allTimeRevenue.toLocaleString()}₽</p>
          <p className="text-sm text-green-100 mt-1">{t('dashboard_total_revenue')}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-3xl font-bold">{allTimeDelivered}</p>
          <p className="text-sm text-purple-100 mt-1">{t('dashboard_total_delivered')}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-3xl font-bold">{users.length}</p>
          <p className="text-sm text-amber-100 mt-1">{t('dashboard_total_clients')}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-3xl font-bold">{staff.filter((s: any) => s.isOnline).length}</p>
          <p className="text-sm text-emerald-100 mt-1">{t('dashboard_couriers_online')}</p>
        </div>
      </div>

      {/* Chart + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-zinc-900 dark:text-white">{t('dashboard_revenue_chart')}</h3>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 text-xs">
              <button onClick={() => setChartRange('7')} className={`px-3 py-1.5 rounded-md font-medium transition-colors active:scale-[0.97] ${chartRange === '7' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>{t('dashboard_days_7')}</button>
              <button onClick={() => setChartRange('30')} className={`px-3 py-1.5 rounded-md font-medium transition-colors active:scale-[0.97] ${chartRange === '30' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>{t('dashboard_days_30')}</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartDays}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by status */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4">{t('dashboard_orders_by_status')}</h3>
          <div className="flex justify-center mb-4">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, idx) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {Object.entries(STATUS_LABELS).map(([key, label]) => {
              const count = orders.filter(o => o.status === key).length;
              if (count === 0) return null;
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
                    <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
                  </div>
                  <span className="font-bold text-zinc-900 dark:text-white">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Orders by hour + Orders trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by hour */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-amber-500" /> Загрузка кухни по часам</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourCounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#9ca3af" interval={3} />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Orders trend */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-blue-500" /> Динамика заказов (14 дней)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendDays}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top dishes + Recent orders + Stock alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top dishes */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Pizza size={18} className="text-orange-500" /> {t('dashboard_top_dishes')}</h3>
          {topDishes.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">{t('dashboard_no_top_data')}</p>
          ) : (
            <div className="space-y-3">
              {topDishes.map((dish, idx) => (
                <div key={dish.name} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-zinc-400' : idx === 2 ? 'bg-amber-700' : 'bg-zinc-600'}`}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{dish.name}</p>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 mt-1">
                      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-1.5 rounded-full" style={{ width: `${(dish.count / topDishes[0].count) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{dish.count}</p>
                    <p className="text-xs text-zinc-400">{dish.revenue.toLocaleString()}₽</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-blue-500" /> {t('dashboard_recent_orders')}</h3>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">{t('dashboard_no_orders')}</p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {recentOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: STATUS_COLORS[o.status] || '#6b7280' }}>#{o.id}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{o.userName || t('dashboard_guest')}</p>
                      <p className="text-xs text-zinc-500">{o.createdAt ? new Date(o.createdAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{o.total?.toLocaleString()}₽</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${o.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : o.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>{STATUS_LABELS[o.status] || o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock alerts */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><ShoppingBag size={18} className="text-red-500" /> {t('dashboard_stock_alerts')}</h3>
          {stockAlerts.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8"><ShoppingBag size={32} className="mx-auto text-green-300 mb-2" />{t('dashboard_all_ok')}</p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {stockAlerts.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">!</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{i.name}</p>
                      <p className="text-xs text-zinc-500">{i.article || ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-500">{i.currentStock || 0}</p>
                    <p className="text-[10px] text-zinc-400">{t('dashboard_min')} {i.minStock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}