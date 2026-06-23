import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { LayoutDashboard, Users, CreditCard, Calendar, ArrowRight, ShoppingBag, UserCheck, AlertCircle } from 'lucide-react';

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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-zinc-400">Загрузка...</div></div>;

  if (!tenant) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <AlertCircle size={48} className="text-zinc-300 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-zinc-700 mb-2">Ресторан не найден</h2>
      <p className="text-zinc-500 text-sm">{error || 'Обратитесь в поддержку'}</p>
    </div>
  );

  const daysLeft = tenant.subscription_end
    ? Math.max(0, Math.ceil((new Date(tenant.subscription_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{tenant.name}</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{tenant.inn} · {tenant.phone}</p>
        </div>
        <Link to="/subscription" className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition text-sm shadow-sm flex items-center gap-2 self-start">
          {tenant.tariff_name} · {tenant.price_monthly?.toLocaleString('ru-RU')} ₽/мес <ArrowRight size={15} />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center mb-2"><ShoppingBag size={18} className="text-blue-600" /></div>
          <div className="text-2xl font-bold text-zinc-900">{stats?.orders_count ?? '—'}</div>
          <div className="text-xs text-zinc-500">Заказов в этом месяце</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center mb-2"><UserCheck size={18} className="text-green-600" /></div>
          <div className="text-2xl font-bold text-zinc-900">{stats?.staff_count ?? '—'}</div>
          <div className="text-xs text-zinc-500">Активных сотрудников</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center mb-2"><CreditCard size={18} className="text-purple-600" /></div>
          <div className="text-2xl font-bold text-zinc-900">{stats?.total_paid?.toLocaleString('ru-RU') ?? '—'}</div>
          <div className="text-xs text-zinc-500">Оплачено всего</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center mb-2"><Calendar size={18} className="text-amber-600" /></div>
          <div className="text-2xl font-bold text-zinc-900">{daysLeft}</div>
          <div className="text-xs text-zinc-500">Дней до окончания</div>
        </div>
      </div>

      {user?.role === 'superadmin' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-8 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle size={16} />
          Вы вошли как суперадминистратор портала.
          <Link to="/admin/tenants" className="font-medium underline ml-1">Перейти в админ-панель →</Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Link to="/subscription" className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-zinc-900">Подписка и тариф</h3>
            <ArrowRight size={16} className="text-zinc-300 group-hover:text-orange-500 transition" />
          </div>
          <p className="text-sm text-zinc-500">
            Тариф <strong>{tenant.tariff_name}</strong>
            {tenant.subscription_end && <> · до {new Date(tenant.subscription_end).toLocaleDateString('ru-RU')}</>}
          </p>
        </Link>

        <Link to="/payments" className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-zinc-900">Платежи и счета</h3>
            <ArrowRight size={16} className="text-zinc-300 group-hover:text-orange-500 transition" />
          </div>
          <p className="text-sm text-zinc-500">История платежей, выставленные счета, оплата</p>
        </Link>

        <Link to="/branches" className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-zinc-900">Точки (филиалы)</h3>
            <ArrowRight size={16} className="text-zinc-300 group-hover:text-orange-500 transition" />
          </div>
          <p className="text-sm text-zinc-500">{tenant?.allow_create_branches ? 'Управление точками' : 'Управление точками ограничено'}</p>
        </Link>

        <Link to="/staff" className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-zinc-900">Сотрудники</h3>
            <ArrowRight size={16} className="text-zinc-300 group-hover:text-orange-500 transition" />
          </div>
          <p className="text-sm text-zinc-500">Управление доступом к админ-панели</p>
        </Link>

        <Link to="/import" className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-zinc-900">Импорт данных</h3>
            <ArrowRight size={16} className="text-zinc-300 group-hover:text-orange-500 transition" />
          </div>
          <p className="text-sm text-zinc-500">Загрузка меню и технологических карт из Excel</p>
        </Link>

        <a href="http://localhost:5173" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl p-5 hover:opacity-90 transition group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Перейти в админ-панель</h3>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition" />
          </div>
          <p className="text-sm text-white/80">Управление заказами, меню, складом и отчётами</p>
        </a>
      </div>
    </div>
  );
}
