import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { Store, LogOut, User, LayoutDashboard, Shield, FileText, Bell, Search, Activity, CreditCard, Palette, Grid, Menu, X, ChevronDown, MessageCircle, Globe } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const { isAuthenticated, isSuperAdmin, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navLinks = [
    { to: '/', label: 'Главная' },
    { to: '/apps', label: 'Приложения' },
    { to: '/features', label: 'Возможности' },
    { to: '/integrations', label: 'Интеграции' },
    { to: '/finance', label: 'Финансы' },
    { to: '/pricing', label: 'Цены' },
    { to: '/about', label: 'О нас' },
    { to: '/contact', label: 'Контакты' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition">
              <span className="text-white font-bold text-sm">FC</span>
            </div>
            <span className="font-bold text-xl text-zinc-900">FoodChain</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  isActive(link.to)
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 transition text-sm font-medium text-zinc-700"
                >
                  <User size={16} />
                  {user?.full_name || user?.email}
                  <ChevronDown size={14} className={`transition ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-zinc-200 rounded-2xl shadow-lg py-1.5 z-50">
                    <Link to="/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                      <LayoutDashboard size={16} /> Дашборд
                    </Link>
                    {isSuperAdmin && (
                      <>
                        <div className="px-4 py-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Админ-панель</div>
                        <Link to="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <Shield size={16} /> Дашборд
                        </Link>
                        <Link to="/admin/tenants" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <Store size={16} /> Рестораны
                        </Link>
                        <Link to="/admin/tariffs" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <FileText size={16} /> Тарифы
                        </Link>
                        <Link to="/admin/tickets" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <Bell size={16} /> Тикеты
                        </Link>
                        <Link to="/admin/monitoring" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <Activity size={16} /> Мониторинг
                        </Link>
                        <Link to="/admin/audit" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <FileText size={16} /> Аудит
                        </Link>
                        <Link to="/admin/invoices" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <CreditCard size={16} /> Счета
                        </Link>
                        <Link to="/admin/branding" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <Palette size={16} /> Брендинг
                        </Link>
                        <Link to="/admin/search" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <Search size={16} /> Поиск
                        </Link>
                        <Link to="/admin/exchange-rates" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <Globe size={16} /> Курсы валют
                        </Link>
                        <Link to="/admin/subscriptions" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <Activity size={16} /> Подписки
                        </Link>
                        <Link to="/admin/payment-providers" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <CreditCard size={16} /> Платежи
                        </Link>
                        <Link to="/admin/notifications" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50" onClick={() => setUserMenuOpen(false)}>
                          <Bell size={16} /> Уведомления
                        </Link>
                      </>
                    )}
                    <hr className="my-1 border-zinc-100" />
                    <button onClick={() => { setUserMenuOpen(false); handleLogout(); }} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                      <LogOut size={16} /> Выйти
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition">
                  Войти
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition"
                >
                  Попробовать бесплатно
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2 text-zinc-600 hover:text-zinc-900" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-zinc-100 bg-white px-4 py-4 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive(link.to)
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-50'
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <hr className="my-2 border-zinc-100" />
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="block px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Дашборд</Link>
              {isSuperAdmin && (
                <>
                  <div className="px-4 py-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Админ-панель</div>
                  <Link to="/admin" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Дашборд</Link>
                  <Link to="/admin/tenants" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Рестораны</Link>
                  <Link to="/admin/tariffs" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Тарифы</Link>
                  <Link to="/admin/tickets" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Тикеты</Link>
                  <Link to="/admin/monitoring" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Мониторинг</Link>
                  <Link to="/admin/audit" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Аудит</Link>
                  <Link to="/admin/invoices" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Счета</Link>
                  <Link to="/admin/branding" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Брендинг</Link>
                  <Link to="/admin/search" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Поиск</Link>
                  <Link to="/admin/exchange-rates" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Курсы валют</Link>
                  <Link to="/admin/notifications" className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>Уведомления</Link>
                </>
              )}
              <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl">
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="block px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-xl" onClick={() => setMenuOpen(false)}>
                Войти
              </Link>
              <Link to="/register" className="block px-4 py-2.5 text-sm font-bold text-orange-600 hover:bg-orange-50 rounded-xl" onClick={() => setMenuOpen(false)}>
                Попробовать бесплатно
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}