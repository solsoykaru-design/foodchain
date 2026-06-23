import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { ArrowRight, ShoppingBag, UserCheck, CreditCard, Calendar, LayoutDashboard, Users, AlertCircle, Store, Download, Shield } from 'lucide-react';

export function Dashboard() {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMyTenant()
      .then(t => {
        setTenant(t);
        return api.getTenantStats().catch(() => null);
      })
      .then(s => setStats(s))
      .catch(e => setError(e.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
        <div className="text-slate-400 text-sm">Загрузка...</div>
      </div>
    </div>
  );

  if (!tenant) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <AlertCircle size={48} className="text-slate-600 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Ресторан не найден</h2>
      <p className="text-slate-400 text-sm">{error || 'Обратитесь в поддержку'}</p>
    </div>
  );

  const daysLeft = tenant.subscription_end
    ? Math.max(0, Math.ceil((new Date(tenant.subscription_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 reveal">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{tenant.name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{tenant.inn} · {tenant.phone}</p>
        </div>
        <Link to="/subscription" className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-0.5 transition text-sm flex items-center gap-2 self-start shadow-md">
          {tenant.tariff_name} · {tenant.price_monthly?.toLocaleString('ru-RU')} ₽/мес <ArrowRight size={15} />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: ShoppingBag, color: 'from-cyan-500 to-blue-600', bg: 'bg-cyan-500/10', label: 'Заказов в этом месяце', value: stats?.orders_count ?? '—' },
          { icon: UserCheck, color: 'from-emerald-400 to-green-500', bg: 'bg-emerald-500/10', label: 'Активных сотрудников', value: stats?.staff_count ?? '—' },
          { icon: CreditCard, color: 'from-violet-400 to-purple-500', bg: 'bg-purple-500/10', label: 'Оплачено всего', value: stats?.total_paid?.toLocaleString('ru-RU') ?? '—' },
          { icon: Calendar, color: 'from-amber-400 to-orange-500', bg: 'bg-amber-500/10', label: 'Дней до окончания', value: daysLeft },
        ].map((item, i) => (
          <div key={i} className="bg-[#112240]/60 backdrop-blur-sm border border-white/5 rounded-xl p-4 hover:border-cyan-500/20 transition group" style={{animation: `fadeUp 0.6s ease ${i * 0.1}s both`}}>
            <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition`}>
              <item.icon size={18} className={`bg-gradient-to-br ${item.color} bg-clip-text text-transparent`} />
            </div>
            <div className="text-2xl font-bold text-white">{item.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {user?.role === 'superadmin' && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-600/5 border border-cyan-500/20 rounded-xl px-4 py-3 mb-8 text-sm text-cyan-300 flex items-center gap-2 backdrop-blur-sm">
          <Shield size={16} />
          Вы вошли как суперадминистратор портала.
          <Link to="/admin/tenants" className="font-semibold text-cyan-400 hover:text-cyan-300 transition ml-1">Перейти в админ-панель →</Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {[
          { to: '/subscription', title: 'Подписка и тариф', desc: <>Тариф <strong>{tenant.tariff_name}</strong>{tenant.subscription_end && <> · до {new Date(tenant.subscription_end).toLocaleDateString('ru-RU')}</>}</>, icon: LayoutDashboard },
          { to: '/payments', title: 'Платежи и счета', desc: 'История платежей, выставленные счета, онлайн-оплата', icon: CreditCard },
          { to: '/branches', title: 'Точки (филиалы)', desc: tenant?.allow_create_branches ? 'Управление точками и филиалами' : 'Управление точками ограничено', icon: Store },
          { to: '/staff', title: 'Сотрудники', desc: 'Управление доступом к админ-панели ресторана', icon: Users },
          { to: '/import', title: 'Импорт данных', desc: 'Загрузка меню и технологических карт из Excel', icon: Download },
          { to: null, title: 'Перейти в админ-панель', desc: 'Управление заказами, меню, складом и отчётами', icon: ArrowRight, external: 'http://localhost:5173' },
        ].map((item, i) => {
          const content = (
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white">{item.title}</h3>
              <item.icon size={16} className="text-slate-500 group-hover:text-cyan-400 transition" />
            </div>
          );
          const inner = (
            <div className="bg-[#112240]/40 backdrop-blur-sm border border-white/5 rounded-xl p-5 hover:border-cyan-500/20 hover:bg-[#112240]/60 transition-all group" style={{animation: `fadeUp 0.6s ease ${(i + 4) * 0.08}s both`}}>
              {content}
              <p className="text-sm text-slate-400">{item.desc}</p>
            </div>
          );
          return item.external ? (
            <a key={i} href={item.external} target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all p-5 group">
              {content}
              <p className="text-sm text-white/80">{item.desc}</p>
            </a>
          ) : (
            <Link key={i} to={item.to!}>{inner}</Link>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .reveal { animation: fadeUp 0.6s ease both; }
      `}</style>
    </div>
  );
}
