import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { CartItem, Dish, Order } from '../types';
import * as api from '../api';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import DishPage from './pages/DishPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';

type Page = 'home' | 'menu' | 'dish' | 'cart' | 'checkout' | 'order-tracking' | 'auth' | 'profile' | 'about';

interface WebsiteState {
  page: Page; setPage: (p: Page) => void;
  cart: CartItem[]; addToCart: (dish: Dish, qty: number, options?: { [k: number]: number[] }) => void;
  removeFromCart: (dishId: number) => void; updateCartQty: (dishId: number, qty: number) => void;
  clearCart: () => void; cartTotal: number; cartCount: number;
  selectedDish: Dish | null; setSelectedDish: (d: Dish | null) => void;
  user: any; setUser: (u: any) => void;
  siteSettings: any; branding: any;
  menuData: { dishes: Dish[]; categories: any[] };
  tenantId: string;
  isLoggedIn: boolean; logout: () => void;
  orders: any[]; setOrders: (o: any[]) => void;
  promoCode: string; setPromoCode: (c: string) => void;
  promoDiscount: number; setPromoDiscount: (d: number) => void;
  selectedDishData: any; setSelectedDishData: (d: any) => void;
  refreshMenu: () => Promise<void>;
}

const WebsiteContext = createContext<WebsiteState | null>(null);
export function useWebsite() { return useContext(WebsiteContext)!; }

const DEFAULT_CSS_VARS = {
  '--color-primary': '#ea580c',
  '--color-primary-light': '#fed7aa',
  '--color-primary-dark': '#c2410c',
  '--color-bg': '#ffffff',
  '--color-bg-alt': '#f9fafb',
  '--color-text': '#1f2937',
  '--color-text-secondary': '#6b7280',
};

export default function WebsiteApp() {
  const [page, setPage] = useState<Page>('home');
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('website_cart') || '[]'); } catch { return []; }
  });
  const [user, setUser] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('website_user') || 'null'); } catch { return null; }
  });
  const [siteSettings, setSiteSettings] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [menuData, setMenuData] = useState<{ dishes: Dish[]; categories: any[] }>({ dishes: [], categories: [] });
  const [orders, setOrders] = useState<any[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [selectedDishData, setSelectedDishData] = useState<any>(null);

  const tenantId = localStorage.getItem('foodchain_website_tenant') || '1';
  const isLoggedIn = !!user;

  useEffect(() => { localStorage.setItem('website_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('website_user', JSON.stringify(user)); }, [user]);

  const refreshMenu = useCallback(async () => {
    try {
      const [menu, cats] = await Promise.all([
        api.getPublicMenu('site').catch(() => ({ categories: [], dishes: [] })),
        api.getPublicMenu('site').catch(() => ({ categories: [], dishes: [] })),
      ]);
      setMenuData({ dishes: menu.dishes || [], categories: menu.categories || [] });
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      api.get(`/api/site-settings/public/${tenantId}`).catch(() => ({ settings: null })),
      api.getBranding().then(r => r.branding).catch(() => null),
    ]).then(([settingsRes, brand]) => {
      setSiteSettings(settingsRes?.settings || null);
      setBranding(brand);
      if (brand?.site?.browserTitle) document.title = brand.site.browserTitle;
      if (brand?.common?.faviconUrl) {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = brand.common.faviconUrl;
      }
    });
    refreshMenu();
    if (user?.id) {
      api.get(`/api/website/orders?userId=${user.id}`).then(setOrders).catch(() => {});
    }
  }, []);

  const addToCart = useCallback((dish: Dish, qty: number, options?: { [k: number]: number[] }) => {
    setCart(prev => {
      const existing = prev.find(i => i.dish.id === dish.id);
      let extraPrice = 0;
      if (options && dish.customizations) {
        Object.entries(options).forEach(([custId, optIds]) => {
          const cust = dish.customizations?.find(c => c.id === Number(custId));
          if (cust) { optIds.forEach(optId => { const opt = cust.options.find(o => o.id === optId); if (opt) extraPrice += opt.price; }); }
        });
      }
      if (existing) return prev.map(i => i.dish.id === dish.id ? { ...i, quantity: i.quantity + qty, totalPrice: (dish.price + extraPrice) * (i.quantity + qty), selectedOptions: options || i.selectedOptions } : i);
      return [...prev, { dish, quantity: qty, selectedOptions: options || {}, totalPrice: (dish.price + extraPrice) * qty }];
    });
  }, []);

  const removeFromCart = useCallback((dishId: number) => setCart(prev => prev.filter(i => i.dish.id !== dishId)), []);
  const updateCartQty = useCallback((dishId: number, qty: number) => {
    if (qty <= 0) { removeFromCart(dishId); return; }
    setCart(prev => prev.map(i => {
      if (i.dish.id !== dishId) return i;
      let extraPrice = 0;
      if (i.selectedOptions && i.dish.customizations) {
        Object.entries(i.selectedOptions).forEach(([custId, optIds]) => {
          const cust = i.dish.customizations?.find(c => c.id === Number(custId));
          if (cust) { optIds.forEach(optId => { const opt = cust.options.find(o => o.id === optId); if (opt) extraPrice += opt.price; }); }
        });
      }
      return { ...i, quantity: qty, totalPrice: (i.dish.price + extraPrice) * qty };
    }));
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);
  const cartTotal = cart.reduce((sum, i) => sum + i.totalPrice, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const logout = useCallback(() => {
    localStorage.removeItem('website_user');
    setUser(null);
    setPage('home');
  }, []);

  const s = siteSettings || { common: {}, colors: {}, images: {}, categories: {}, productCards: {} };
  const colors = s.colors || {};
  const cssVars = {
    '--color-primary': colors.primaryFillColor || DEFAULT_CSS_VARS['--color-primary'],
    '--color-primary-light': colors.secondaryFillColor || DEFAULT_CSS_VARS['--color-primary-light'],
    '--color-primary-dark': '#c2410c',
    '--color-bg': colors.backgroundColor || DEFAULT_CSS_VARS['--color-bg'],
    '--color-bg-alt': '#f9fafb',
    '--color-text': colors.primaryTextColor || DEFAULT_CSS_VARS['--color-text'],
    '--color-text-secondary': colors.secondaryTextColor || DEFAULT_CSS_VARS['--color-text-secondary'],
  } as React.CSSProperties;

  return (
    <WebsiteContext.Provider value={{
      page, setPage, cart, addToCart, removeFromCart, updateCartQty, clearCart, cartTotal, cartCount,
      selectedDish: selectedDishData, setSelectedDish: setSelectedDishData,
      user, setUser, siteSettings, branding, menuData, tenantId, isLoggedIn, logout, orders, setOrders,
      promoCode, setPromoCode, promoDiscount, setPromoDiscount, selectedDishData, setSelectedDishData, refreshMenu,
    }}>
      <div style={{ ...cssVars, fontFamily: s.common?.fontFamily || 'Inter' }} className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        <Header />
        <main className="flex-1">
          {page === 'home' && <HomePage />}
          {page === 'menu' && <MenuPage />}
          {page === 'dish' && <DishPage />}
          {page === 'cart' && <CartPage />}
          {page === 'checkout' && <CheckoutPage />}
          {page === 'order-tracking' && <OrderTrackingPage />}
          {page === 'auth' && <AuthPage />}
          {page === 'profile' && <ProfilePage />}
          {page === 'about' && <AboutPage />}
        </main>
        <Footer />
      </div>
    </WebsiteContext.Provider>
  );
}

function AboutPage() {
  const ctx = useWebsite();
  const brand = ctx.branding?.site || {};
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-6">О нас</h1>
      <div className="prose max-w-none">
        <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed mb-6">
          {brand.aboutText || 'Мы — команда профессионалов, которые любят готовить и радовать гостей вкусной едой. Наш ресторан — это место, где традиции встречаются с современностью.'}
        </p>
        <div className="grid md:grid-cols-2 gap-8 my-10">
          <div className="bg-[var(--color-bg-alt)] rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-2">Наша миссия</h3>
            <p className="text-[var(--color-text-secondary)]">Дарить людям удовольствие от вкусной, свежей и качественной еды, приготовленной с душой.</p>
          </div>
          <div className="bg-[var(--color-bg-alt)] rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-2">Наши ценности</h3>
            <p className="text-[var(--color-text-secondary)]">Свежие продукты, уникальные рецепты, внимательный сервис и забота о каждом госте.</p>
          </div>
        </div>
        <div className="bg-[var(--color-primary-light)] rounded-2xl p-8 text-center">
          <h3 className="font-bold text-xl mb-3">Контакты</h3>
          <p className="mb-1"><strong>Телефон:</strong> {brand.phone || '+7 (999) 123-45-67'}</p>
          <p className="mb-1"><strong>Адрес:</strong> {brand.address || 'г. Москва, ул. Примерная, д. 1'}</p>
          <p><strong>Email:</strong> {brand.email || 'info@foodchain.ru'}</p>
        </div>
      </div>
    </div>
  );
}
