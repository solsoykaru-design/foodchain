import { useState } from 'react';
import { ShoppingCart, Menu, X, User, LogOut, Package } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';

export default function Header() {
  const ctx = useWebsite();
  const [mobileOpen, setMobileOpen] = useState(false);
  const s = ctx.siteSettings || {};
  const logoUrl = s.images?.logoHorizontal || ctx.branding?.common?.logoUrl || '';
  const storeName = ctx.branding?.common?.restaurantName || 'Ресторан';

  const nav = [
    { label: 'Меню', page: 'menu' as const },
    { label: 'Акции', page: 'home' as const, hash: '#promo' },
    { label: 'О нас', page: 'about' as const },
    { label: 'Контакты', page: 'about' as const },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <button className="flex items-center gap-2 shrink-0" onClick={() => ctx.setPage('home')}>
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-9 w-auto object-contain" />
          ) : (
            <div className="w-9 h-9 bg-[var(--color-primary)] rounded-xl flex items-center justify-center text-white font-bold text-lg">F</div>
          )}
          <span className="font-bold text-lg hidden sm:block text-[var(--color-text)]">{storeName}</span>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map(item => (
            <button key={item.label} onClick={() => { ctx.setPage(item.page); if (item.hash) window.location.hash = item.hash; }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-orange-50 transition-colors">
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={() => ctx.setPage('cart')} className="relative p-2.5 rounded-xl text-[var(--color-text-secondary)] hover:bg-orange-50 hover:text-[var(--color-primary)] transition-colors">
            <ShoppingCart size={20} />
            {ctx.cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[var(--color-primary)] text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                {ctx.cartCount > 99 ? '99+' : ctx.cartCount}
              </span>
            )}
          </button>

          {ctx.isLoggedIn ? (
            <div className="hidden sm:flex items-center gap-1">
              <button onClick={() => ctx.setPage('profile')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-orange-50 hover:text-[var(--color-primary)] transition-colors">
                <User size={16} /> {ctx.user?.name || 'Профиль'}
              </button>
              <button onClick={ctx.logout} className="p-2 rounded-xl text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-red-500 transition-colors" title="Выйти">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => ctx.setPage('auth')} className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:brightness-110 transition-all shadow-sm">
              <User size={16} /> Войти
            </button>
          )}

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-xl text-[var(--color-text-secondary)] hover:bg-orange-50 transition-colors">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {nav.map(item => (
            <button key={item.label} onClick={() => { ctx.setPage(item.page); setMobileOpen(false); }}
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-orange-50 transition-colors">
              {item.label}
            </button>
          ))}
          {ctx.isLoggedIn ? (
            <>
              <button onClick={() => { ctx.setPage('profile'); setMobileOpen(false); }}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-orange-50 transition-colors">
                <User size={16} className="inline mr-2" />Профиль
              </button>
              <button onClick={() => { ctx.logout(); setMobileOpen(false); }}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={16} className="inline mr-2" />Выйти
              </button>
            </>
          ) : (
            <button onClick={() => { ctx.setPage('auth'); setMobileOpen(false); }}
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-primary)] text-white transition-colors">
              Войти / Регистрация
            </button>
          )}
        </div>
      )}
    </header>
  );
}
