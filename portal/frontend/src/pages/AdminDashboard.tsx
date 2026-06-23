import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { RefreshCw, TrendingUp, Users, ShoppingCart, DollarSign, Award, Shield, Activity } from 'lucide-react';

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
        <div className="text-slate-400 text-sm">Загрузка...</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8 reveal">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Глобальный дашборд</h1>
          <p className="text-slate-400 text-sm mt-0.5">Сводка по всей платформе FoodChain</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="border border-white/10 text-slate-300 font-medium px-4 py-2 rounded-xl hover:bg-white/5 transition text-sm flex items-center gap-2">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Обновить
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users, value: data?.active_tenants ?? 0, label: 'Активных арендаторов', color: 'from-cyan-500 to-blue-600', bg: 'bg-cyan-500/10' },
          { icon: DollarSign, value: `${(data?.monthly_revenue ?? 0).toLocaleString('ru-RU')} ₽`, label: 'Выручка за месяц', color: 'from-emerald-400 to-green-500', bg: 'bg-emerald-500/10' },
          { icon: ShoppingCart, value: data?.monthly_orders ?? 0, label: 'Заказов за месяц', color: 'from-violet-400 to-purple-500', bg: 'bg-purple-500/10' },
          { icon: TrendingUp, value: `${data?.avg_order ? Math.round(data.avg_order).toLocaleString('ru-RU') : 0} ₽`, label: 'Средний чек', color: 'from-amber-400 to-orange-500', bg: 'bg-amber-500/10' },
        ].map((item, i) => (
          <div key={i} className="bg-[#112240]/60 backdrop-blur-sm border border-white/5 rounded-xl p-4 hover:border-cyan-500/20 transition group" style={{animation: `fadeUp 0.6s ease ${i * 0.1}s both`}}>
            <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition`}>
              <item.icon size={18} className={`bg-gradient-to-br ${item.color} bg-clip-text text-transparent`} />
            </div>
            <div className="text-2xl font-bold text-white">{item.value}</div>
            <div className="text-sm text-slate-400 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#112240]/40 backdrop-blur-sm border border-white/5 rounded-xl p-5">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2"><Activity size={16} className="text-cyan-400" /> Динамика подключений</h2>
          {data?.signups?.length > 0 ? (
            <div className="space-y-2">
              {data.signups.slice(-14).map((s: any, i: number) => (
                <div key={s.date} className="flex items-center gap-3 text-sm" style={{animation: `fadeUp 0.4s ease ${i * 0.03}s both`}}>
                  <span className="text-slate-500 w-24 shrink-0">{s.date}</span>
                  <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all" style={{ width: `${Math.min(100, (s.count / (Math.max(...data.signups.map((x: any) => x.count)) || 1)) * 100)}%` }} />
                  </div>
                  <span className="font-bold text-slate-300 w-6 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-500 text-sm">Нет данных</p>}
        </div>

        <div className="bg-[#112240]/40 backdrop-blur-sm border border-white/5 rounded-xl p-5">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2"><DollarSign size={16} className="text-cyan-400" /> Топ-10 по выручке</h2>
          {data?.top_by_revenue?.length > 0 ? (
            <div className="space-y-2">
              {data.top_by_revenue.map((t: any, i: number) => (
                <div key={t.id} className="flex items-center justify-between text-sm py-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 w-5 shrink-0 font-mono text-xs">#{i + 1}</span>
                    <span className="truncate text-slate-200">{t.name}</span>
                  </div>
                  <span className="font-bold text-slate-200 shrink-0 ml-2">{t.total.toLocaleString('ru-RU')} ₽</span>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-500 text-sm">Нет данных</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {[
          { to: '/admin/tickets', title: 'Тикеты поддержки', desc: 'Управление обращениями арендаторов', icon: Award },
          { to: '/admin/monitoring', title: 'Мониторинг', desc: 'Доступность и нагрузка системы', icon: Activity },
        ].map((item, i) => (
          <Link key={i} to={item.to} className="bg-[#112240]/40 backdrop-blur-sm border border-white/5 rounded-xl p-5 hover:border-cyan-500/20 hover:bg-[#112240]/60 transition-all group" style={{animation: `fadeUp 0.6s ease ${(i + 4) * 0.1}s both`}}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-white">{item.title}</h3>
              <item.icon size={18} className="text-slate-500 group-hover:text-cyan-400 transition" />
            </div>
            <p className="text-sm text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .reveal { animation: fadeUp 0.6s ease both; }
      `}</style>
    </div>
  );
}
