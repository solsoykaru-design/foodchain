import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { Store, LogOut, User, LayoutDashboard, Shield, FileText, Bell, BellDot, Search, Activity, CreditCard, Palette, Grid, Menu, X, ChevronDown, MessageCircle, Globe } from 'lucide-react';

import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

export function Header() {
  const { isAuthenticated, isSuperAdmin, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated && !isSuperAdmin) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isSuperAdmin]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.getMyNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {}
  };

  const markRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleNotifClick = (notif: any) => {
    if (!notif.is_read) markRead(notif.id);
  };

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
    { to: '/blog', label: 'Блог' },
    { to: '/contact', label: 'Контакты' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-[#0a192f]/95 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition shadow-cyan-500/20">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="font-bold text-xl text-white">Food<span className="text-cyan-400">Chain</span></span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  isActive(link.to)
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {!isSuperAdmin && (
                  <div ref={notifRef} className="relative">
                    <button onClick={() => setNotifOpen(v => !v)}
                      className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition">
                      {unreadCount > 0 ? <BellDot size={20} /> : <Bell size={20} />}
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 border-2 border-[#0a192f] rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                    {notifOpen && (
                      <div className="absolute right-0 mt-2 w-80 bg-[#1e2a4a] border border-white/10 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto">
                        <div className="p-3 border-b border-white/10 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white">Уведомления</h3>
                          <Link to="/notifications" onClick={() => setNotifOpen(false)} className="text-xs text-cyan-400 hover:underline">Все</Link>
                        </div>
                        {notifications.length === 0 ? (
                          <p className="text-center text-xs text-slate-500 py-8">Нет уведомлений</p>
                        ) : (
                          notifications.slice(0, 10).map(n => (
                            <button key={n.id} onClick={() => handleNotifClick(n)}
                              className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition ${n.is_read ? '' : 'bg-cyan-500/5'}`}>
                              <p className={`text-sm ${n.is_read ? 'text-slate-300' : 'text-white font-semibold'}`}>{n.subject}</p>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-[10px] text-slate-600 mt-1">{n.created_at ? new Date(n.created_at).toLocaleDateString('ru-RU') : ''}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition text-sm font-medium text-white"
                  >
                    <User size={16} />
                    {user?.full_name || user?.email}
                    <ChevronDown size={14} className={`transition ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#1e2a4a] border border-white/10 rounded-2xl shadow-xl py-1.5 z-50">
                    <Link to="/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                      <LayoutDashboard size={16} /> Дашборд
                    </Link>
                    {isSuperAdmin && (
                      <>
                        <div className="px-4 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Админ-панель</div>
                        <Link to="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Shield size={16} /> Дашборд
                        </Link>
                        <Link to="/admin/tenants" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Store size={16} /> Рестораны
                        </Link>
                        <Link to="/admin/tariffs" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <FileText size={16} /> Тарифы
                        </Link>
                        <Link to="/admin/tickets" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Bell size={16} /> Тикеты
                        </Link>
                        <Link to="/admin/monitoring" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Activity size={16} /> Мониторинг
                        </Link>
                        <Link to="/admin/audit" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <FileText size={16} /> Аудит
                        </Link>
                        <Link to="/admin/invoices" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <CreditCard size={16} /> Счета
                        </Link>
                        <Link to="/admin/branding" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Palette size={16} /> Брендинг
                        </Link>
                        <Link to="/admin/search" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Search size={16} /> Поиск
                        </Link>
                        <Link to="/admin/exchange-rates" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Globe size={16} /> Курсы валют
                        </Link>
                        <Link to="/admin/subscriptions" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Activity size={16} /> Подписки
                        </Link>
                        <Link to="/admin/payment-providers" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <CreditCard size={16} /> Платежи
                        </Link>
                        <Link to="/admin/notifications" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5" onClick={() => setUserMenuOpen(false)}>
                          <Bell size={16} /> Уведомления
                        </Link>
                      </>
                    )}
                    <hr className="my-1 border-white/10" />
                    <button onClick={() => { setUserMenuOpen(false); handleLogout(); }} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                      <LogOut size={16} /> Выйти
                    </button>
                  </div>
                )}
              </div>
            </> ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition">
                  Войти
                </Link>
                <Link
                  to="/register"
                  className="bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition hover:-translate-y-0.5"
                >
                  Попробовать бесплатно
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#0a192f]/98 backdrop-blur-xl px-4 py-4 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive(link.to)
                  ? 'bg-white/10 text-white'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <hr className="my-2 border-white/10" />
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="block px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Дашборд</Link>
              {!isSuperAdmin && (
                <Link to="/notifications" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>
                  <Bell size={16} className="inline mr-1.5" />Уведомления
                </Link>
              )}
              {isSuperAdmin && (
                <>
                  <div className="px-4 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Админ-панель</div>
                  <Link to="/admin" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Дашборд</Link>
                  <Link to="/admin/tenants" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Рестораны</Link>
                  <Link to="/admin/tariffs" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Тарифы</Link>
                  <Link to="/admin/tickets" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Тикеты</Link>
                  <Link to="/admin/monitoring" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Мониторинг</Link>
                  <Link to="/admin/audit" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Аудит</Link>
                  <Link to="/admin/invoices" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Счета</Link>
                  <Link to="/admin/branding" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Брендинг</Link>
                  <Link to="/admin/search" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Поиск</Link>
                  <Link to="/admin/exchange-rates" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Курсы валют</Link>
                  <Link to="/admin/notifications" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>Уведомления</Link>
                </>
              )}
              <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl">
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="block px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>
                Войти
              </Link>
              <Link to="/register" className="block px-4 py-2.5 text-sm font-bold text-cyan-400 hover:bg-white/5 rounded-xl" onClick={() => setMenuOpen(false)}>
                Попробовать бесплатно
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}