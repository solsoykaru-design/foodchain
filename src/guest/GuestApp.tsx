import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { useApp } from '../context';
import { Dish, SavedAddress, SupportMessage, Coupon, GameScore, UserSettings, OrderStatus } from '../types';
import QrMenuPage from './QrMenuPage';
import AddressInput from '../components/AddressInput';
import PickupPointSelector from './PickupPointSelector';
import ErrorBoundary from '../components/ErrorBoundary';
import * as api from '../api';

// Leaflet for map
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Public Settings Context ──
const PublicSettingsContext = createContext<Record<string, any>>({});
export function usePublicSettings() { return useContext(PublicSettingsContext); }
import GamesPage from './GamesPage';

// ── Menu Data Context ──
interface MenuData { dishes: Dish[]; categories: any[]; branches: any[]; categoryColors: Record<number, string>; }
const MenuDataContext = createContext<MenuData>({ dishes: [], categories: [], branches: [], categoryColors: {} });
export function useMenuData() { return useContext(MenuDataContext); }

const GRADIENTS = ['from-orange-500 to-red-500', 'from-red-500 to-yellow-500', 'from-blue-500 to-cyan-500', 'from-green-500 to-emerald-500', 'from-purple-500 to-pink-500', 'from-yellow-500 to-amber-500', 'from-teal-500 to-cyan-500', 'from-pink-500 to-rose-500'];
import { usePrice } from '../PriceContext';

import {
  Search, ShoppingCart, Heart, Star, MapPin, ChevronLeft, ChevronRight,
  Plus, Minus, X, Trash2, Award, MessageCircle, Truck, Store, UtensilsCrossed,
  Users, Calendar, Flame, Clock, Percent, Package, Phone, Mail, LogOut,
  Gift, Zap, Gamepad2, Settings, BookHeart, MapPinned, Ticket, RotateCcw,
  CheckCircle2, Circle, Send, Reply, Image as ImageIcon, ThumbsUp, Edit3, Bell,
  Smartphone, Sun, Moon, ChevronDown, Sparkles, ShoppingBag, BadgePercent, Loader, LogIn, AlertTriangle
} from 'lucide-react';

const DEFAULT_BRANDING = {
  common: {
    logoUrl: '', restaurantName: '', iconUrl: '', faviconUrl: '',
    primaryColor: '#FF5722', secondaryColor: '#FFC107',
    textColor: '#1F2937', secondaryTextColor: '#6B7280',
    backgroundColor: '#F9FAFB', cardColor: '#FFFFFF',
    successColor: '#10B981', errorColor: '#EF4444', warningColor: '#F59E0B',
    fontFamily: 'Inter', headingSize: 'medium', bodySize: 'medium',
    buttonRadius: 'medium', cardStyle: 'shadow', shadow: 'medium',
    loginBackground: '', homeBackground: '', emptyStateImage: '',
  },
  site: {
    title: '', slogan: '', bannerUrl: '', aboutText: '',
    phone: '', address: '', email: '',
    social: { instagram: '', vk: '', telegram: '' },
    browserTitle: '', metaDescription: '',
  },
  apps: { guest: {}, courier: {}, waiter: {}, kitchen: {} },
};

const BrandingContext = createContext<any>(DEFAULT_BRANDING);
export function useBranding() { return useContext(BrandingContext); }

export default function GuestApp({ onLogout: _onLogout, onLogin, isLoggedIn: _isLoggedIn, onShowTenantPicker }: { onLogout?: () => void; onLogin?: () => void; isLoggedIn?: boolean; onShowTenantPicker?: () => void }) {
  const { guestPage, setGuestPage } = useApp();
  const [publicSettings, setPublicSettings] = useState<Record<string, any>>({});
  const [branding, setBranding] = useState<any>(DEFAULT_BRANDING);
  const [menuData, setMenuData] = useState<MenuData>({ dishes: [], categories: [], branches: [], categoryColors: {} });
  const [menuLoading, setMenuLoading] = useState(true);
  const isLoggedIn = _isLoggedIn;

  useEffect(() => {
    Promise.all([
      api.getPublicSettings().catch(() => ({})),
      api.getBranding().then(r => r.branding).catch(() => DEFAULT_BRANDING),
    ]).then(([settings, brand]) => {
      setPublicSettings(settings);
      setBranding(brand);
      const title = brand?.site?.browserTitle || brand?.common?.restaurantName || '';
      if (title) document.title = title;
      const favicon = brand?.common?.faviconUrl;
      if (favicon) {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = favicon;
      }
    });
  }, []);

  useEffect(() => {
    Promise.all([
      api.getPublicMenu('app').catch(() => ({ categories: [], dishes: [] })),
      api.get('/api/branches').catch(() => []),
    ]).then(([menuData, branches]) => {
      const cats = menuData.categories || [];
      const items = menuData.dishes || [];
      const colors: Record<number, string> = {};
      cats.forEach((c: any, i: number) => { colors[c.id] = GRADIENTS[i % GRADIENTS.length]; });
      setMenuData({ dishes: items, categories: cats, branches, categoryColors: colors });
    }).finally(() => setMenuLoading(false));
  }, []);

  const c = branding?.common || DEFAULT_BRANDING.common;
  const rootStyle = {
    '--brand-primary': c.primaryColor,
    '--brand-secondary': c.secondaryColor,
    '--brand-text': c.textColor,
    '--brand-text-secondary': c.secondaryTextColor,
    '--brand-bg': c.backgroundColor,
    '--brand-card': c.cardColor,
    '--brand-success': c.successColor,
    '--brand-error': c.errorColor,
    '--brand-warning': c.warningColor,
    '--brand-font': c.fontFamily,
  } as React.CSSProperties;

  const handleLogout = () => {
    sessionStorage.removeItem('foodchain_guest_user');
    setGuestPage('home');
    _onLogout?.();
  };

  return (
    <BrandingContext.Provider value={branding}>
    <PublicSettingsContext.Provider value={publicSettings}>
    <MenuDataContext.Provider value={menuData}>
    <div style={{ ...rootStyle, fontFamily: c.fontFamily !== 'Inter' ? c.fontFamily : undefined }} className="min-h-screen bg-zinc-950 text-white">
      {!menuLoading && guestPage === 'home' && <HomePage onShowLogin={onLogin} onShowTenantPicker={onShowTenantPicker} isLoggedIn={isLoggedIn} />}
      {guestPage === 'menu' && <MenuPage />}
      {guestPage === 'dish' && <DishPage />}
      {guestPage === 'cart' && <CartPage />}
      {guestPage === 'checkout' && <CheckoutPage />}
      {guestPage === 'payment' && <PaymentProcessingPage />}
      {guestPage === 'qr-payment' && <QrPaymentPage />}
      {guestPage === 'qr-menu' && <QrMenuPage />}
      {guestPage === 'games' && <GamesPage />}
      {guestPage === 'payment-success' && <PaymentSuccessPage />}
      {guestPage === 'booking' && <BookingPage />}
      {guestPage === 'profile' && <ErrorBoundary><ProfilePage onLogout={handleLogout} /></ErrorBoundary>}
      {guestPage === 'orders' && <OrdersPage />}
      {guestPage === 'loyalty' && <LoyaltyPage />}
      {guestPage === 'reviews' && <ReviewsPage />}
      {guestPage === 'support' && <SupportPage />}
      {guestPage === 'order-tracking' && <OrderTrackingPage />}
      {guestPage === 'favorites' && <FavoritesPage />}
      {guestPage === 'addresses' && <AddressesPage />}
      {guestPage === 'support-chat' && <SupportChatPage />}
      {guestPage === 'courier-chat' && <CourierChatPage />}
      {guestPage === 'mini-game' && <MiniGamePage />}
      {guestPage === 'coupons' && <CouponsPage />}
      {guestPage === 'settings' && <SettingsPage />}
      {guestPage === 'order-checklist' && <OrderChecklistPage />}
      {guestPage === 'repeat-order' && <RepeatOrderPage />}
      <BottomNav />
      {publicSettings.access_mode === 'demo' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg backdrop-blur-sm">
          ДЕМО-ВЕРСИЯ
        </div>
      )}
      </div>
    </MenuDataContext.Provider>
    </PublicSettingsContext.Provider>
    </BrandingContext.Provider>
  );
}

function PaymentProcessingPage() {
  const appCtx = useApp();
  const [paymentUrl, setPaymentUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('pending_payment');
    if (!stored) { setError('Нет информации о платеже'); setLoading(false); return; }

    try {
      const data = JSON.parse(stored);
      if (data.confirmationUrl) {
        setPaymentUrl(data.confirmationUrl);
        setLoading(false);
        return;
      }

      const checkStatus = async () => {
        try {
          const status = await api.getPaymentStatus(data.paymentId);
          if (status.status === 'succeeded') {
            sessionStorage.removeItem('pending_payment');
            appCtx?.setGuestPage('payment-success');
          } else if (status.status === 'canceled' || status.status === 'error') {
            setError('Платёж не прошёл: ' + (status.errorMessage || 'Попробуйте снова'));
            setLoading(false);
          } else {
            setTimeout(checkStatus, 2000);
          }
        } catch { setTimeout(checkStatus, 3000); }
      };
      checkStatus();
    } catch { setError('Ошибка обработки платежа'); setLoading(false); }
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center pb-24">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Перенаправление на оплату...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center pb-24 px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <X size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Ошибка оплаты</h2>
        <p className="text-zinc-400 text-sm mb-6">{error}</p>
        <button onClick={() => appCtx?.setGuestPage('checkout')} className="bg-orange-500 text-white font-bold px-6 py-3 rounded-xl">
          Вернуться к оформлению
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => appCtx?.setGuestPage('checkout')} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors">
          <X size={20} className="text-zinc-400" />
        </button>
        <h3 className="font-bold text-white text-sm">Оплата заказа</h3>
      </div>
      <div className="p-0">
        <iframe src={paymentUrl} className="w-full border-0" style={{ height: 'calc(100vh - 120px)' }} title="Оплата" allow="payment" />
      </div>
    </div>
  );
}

function PaymentSuccessPage() {
  const appCtx = useApp();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      appCtx?.setGuestPage('order-tracking');
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, appCtx]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center pb-24 px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Оплата прошла успешно!</h2>
        <p className="text-zinc-400 text-sm mb-6">Ваш заказ принят и передан в обработку</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => appCtx?.setGuestPage('order-tracking')} className="bg-orange-500 text-white font-bold px-6 py-3 rounded-xl">
            Отследить заказ
          </button>
          <button onClick={() => appCtx?.setGuestPage('home')} className="text-zinc-400 text-sm font-medium hover:text-white transition-colors">
            На главную {countdown > 0 && `(${countdown}с)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function QrPaymentPage() {
  const appCtx = useApp();
  const [qrCode, setQrCode] = useState('');
  const [qrExpiry, setQrExpiry] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const stored = sessionStorage.getItem('pending_qr_payment');
    if (!stored) { setError('Нет информации о платеже'); setLoading(false); return; }

    try {
      const data = JSON.parse(stored);
      setQrCode(data.qrCode);
      setQrExpiry(data.qrExpiry || (Date.now() + 5 * 60 * 1000));
      setLoading(false);
    } catch { setError('Ошибка обработки платежа'); setLoading(false); }
  }, []);

  useEffect(() => {
    if (paid || error || !qrCode) return;
    const stored = sessionStorage.getItem('pending_qr_payment');
    if (!stored) return;
    const data = JSON.parse(stored);

    const poll = async () => {
      try {
        const result = await api.getQrPaymentStatus(data.paymentId);
        if (result.status === 'succeeded' || result.externalStatus === 'CONFIRMED') {
          setPaid(true);
          sessionStorage.removeItem('pending_qr_payment');
          clearInterval(timerRef.current);
          setTimeout(() => appCtx?.setGuestPage('payment-success'), 1000);
        }
      } catch {}
    };
    timerRef.current = setInterval(poll, 3000);
    return () => clearInterval(timerRef.current);
  }, [qrCode, paid, error]);

  const timeLeft = Math.max(0, Math.floor((qrExpiry - Date.now()) / 1000));
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center pb-24">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Формирование QR-кода...</p>
      </div>
    </div>
  );

  if (paid) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center pb-24 px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Оплата получена!</h2>
        <p className="text-zinc-400 text-sm">Перенаправление...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center pb-24 px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <X size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Ошибка</h2>
        <p className="text-zinc-400 text-sm mb-6">{error}</p>
        <button onClick={() => appCtx?.setGuestPage('checkout')} className="bg-orange-500 text-white font-bold px-6 py-3 rounded-xl">
          Вернуться к оформлению
        </button>
      </div>
    </div>
  );

  if (timeLeft <= 0) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center pb-24 px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Время вышло</h2>
        <p className="text-zinc-400 text-sm mb-6">QR-код больше не действителен</p>
        <button onClick={() => appCtx?.setGuestPage('checkout')} className="bg-orange-500 text-white font-bold px-6 py-3 rounded-xl">
          Попробовать снова
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => appCtx?.setGuestPage('checkout')} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors">
          <X size={20} className="text-zinc-400" />
        </button>
        <h3 className="font-bold text-white text-sm">Оплата по QR-коду</h3>
      </div>
      <div className="max-w-md mx-auto px-4 pt-8 text-center">
        <div className="bg-white rounded-2xl p-6 inline-block mb-6 shadow-xl">
          {qrCode.startsWith('<svg') ? (
            <div className="w-64 h-64 mx-auto" dangerouslySetInnerHTML={{ __html: qrCode }} />
          ) : (
            <img src={qrCode} alt="QR-код для оплаты" className="w-64 h-64 mx-auto" />
          )}
        </div>
        <div className={`text-2xl font-bold mb-4 ${timeLeft < 60 ? 'text-red-500' : 'text-zinc-300'}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        <p className="text-zinc-400 text-sm mb-2">Отсканируйте QR-код приложением банка</p>
        <p className="text-zinc-500 text-xs">СБП / SberPay</p>
      </div>
    </div>
  );
}

function BottomNav() {
  const { guestPage, setGuestPage, cart } = useApp();
  const tabs = [
    { id: 'home' as const, icon: Store, label: 'Главная' },
    { id: 'menu' as const, icon: UtensilsCrossed, label: 'Меню' },
    { id: 'cart' as const, icon: ShoppingCart, label: 'Корзина', badge: true },
    { id: 'booking' as const, icon: Calendar, label: 'Бронь' },
    { id: 'games' as const, icon: Gamepad2, label: 'Игры' },
    { id: 'profile' as const, icon: Users, label: 'Профиль' },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-50 safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map(t => {
          const active = guestPage === t.id;
          return (
            <button key={t.id} onClick={() => setGuestPage(t.id)} className={`flex flex-col items-center gap-0.5 px-3 py-1 relative transition-all ${active ? 'text-orange-500' : 'text-zinc-500'}`}>
              <div className={`p-1 rounded-xl transition-all ${active ? 'bg-orange-500/10' : ''}`}>
                <t.icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              </div>
              <span className="text-[10px] font-semibold">{t.label}</span>
              {t.badge && cart.length > 0 && (
                <span className="absolute -top-0.5 right-1 bg-orange-500 text-white text-[9px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold px-1 shadow-lg">
                  {cart.length > 99 ? '99+' : cart.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DodoHeader({ title, showBack, onBack, rightAction }: { title: string; showBack?: boolean; onBack?: () => void; rightAction?: React.ReactNode }) {
  const { setGuestPage, cart } = useApp();
  return (
    <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800">
      <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
        {showBack ? (
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
        ) : <div className="w-10" />}
        <h1 className="text-lg font-extrabold text-white tracking-tight">{title}</h1>
        {rightAction || (
          <button onClick={() => setGuestPage('cart')} className="p-2 -mr-2 relative text-zinc-400 hover:text-white transition-colors">
            <ShoppingCart size={22} />
            {cart.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[9px] min-w-[16px] h-[16px] rounded-full flex items-center justify-center font-bold">
                {cart.length > 9 ? '9+' : cart.length}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function DishCard({ dish, onPress, size = 'normal' }: { dish: Dish; onPress: () => void; size?: 'normal' | 'large' }) {
  const { addToCart, favorites, toggleFavorite } = useApp();
  const { categories } = useMenuData();
  const cat = categories.find((c: any) => c.id === dish.categoryId);

  if (size === 'large') {
    return (
      <div className="bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={onPress}>
        <div className="relative aspect-[16/9] bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center overflow-hidden">
          {dish.imageUrl ? <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" /> : <span className="text-6xl">{cat?.icon || '🍽️'}</span>}
          {dish.isNew && <span className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">НОВИНКА</span>}
          <button onClick={e => { e.stopPropagation(); toggleFavorite(dish.id); }} className="absolute bottom-3 right-3 w-9 h-9 bg-black/60 backdrop-blur rounded-full flex items-center justify-center">
            <Heart size={16} fill={favorites.includes(dish.id) ? '#ef4444' : 'none'} className={favorites.includes(dish.id) ? 'text-red-500' : 'text-zinc-400'} />
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-bold text-white leading-tight">{dish.name}</h4>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star size={12} fill="#f59e0b" className="text-amber-400" />
              <span className="text-xs font-semibold text-zinc-300">{dish.rating}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{dish.description}</p>
          <div className="flex items-center justify-between mt-3">
            <span className="font-extrabold text-lg text-white">от {usePrice()(dish.price)}</span>
            <button onClick={e => { e.stopPropagation(); addToCart(dish, 1); }} className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg shadow-orange-500/20"><Plus size={20} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={onPress}>
      <div className="relative aspect-[4/3] bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
        {dish.imageUrl ? <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" /> : <span className="text-5xl">{cat?.icon || '🍽️'}</span>}
        {dish.isNew && <span className="absolute top-2 left-2 bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">NEW</span>}
        <button onClick={e => { e.stopPropagation(); toggleFavorite(dish.id); }} className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 backdrop-blur rounded-full flex items-center justify-center">
          <Heart size={14} fill={favorites.includes(dish.id) ? '#ef4444' : 'none'} className={favorites.includes(dish.id) ? 'text-red-500' : 'text-zinc-400'} />
        </button>
      </div>
      <div className="p-3">
        <h4 className="font-semibold text-sm text-white leading-tight">{dish.name}</h4>
        <div className="flex items-center gap-1 mt-1.5">
          <Star size={11} fill="#f59e0b" className="text-amber-400" />
          <span className="text-xs font-medium text-zinc-400">{dish.rating}</span>
          <span className="text-xs text-zinc-600 ml-auto">{dish.weight}г</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-base text-white">{usePrice()(dish.price)}</span>
          <button onClick={e => { e.stopPropagation(); addToCart(dish, 1); }} className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white active:scale-90 transition-transform"><Plus size={18} /></button>
        </div>
      </div>
    </div>
  );
}

function HomePage({ onShowLogin, onShowTenantPicker, isLoggedIn }: { onShowLogin?: () => void; onShowTenantPicker?: () => void; isLoggedIn?: boolean }) {
  const { setGuestPage, setSelectedDish, selectedBranch, setSelectedBranch, setMenuCategoryId, setGuestPage: navigate } = useApp();
  const settings = usePublicSettings();
  const branding = useBranding();
  const { dishes, categories, branches, categoryColors } = useMenuData();
  const branch = branches.find((b: any) => b.id === selectedBranch) || branches[0] || { id: 0, name: 'Не выбран', address: '' };
  const popular = dishes.filter((d: any) => d.isPopular).slice(0, 4);
  const freeDelivFrom = settings.free_delivery_from || 1500;
  const [promos, setPromos] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/campaigns').then((data: any) => {
      if (Array.isArray(data)) {
        setPromos(data.filter((c: any) => c.status === 'active').slice(0, 5));
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="pb-20">
      <div className="px-4 pt-4 pb-2 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {branding.common?.logoUrl && <img src={branding.common.logoUrl} onClick={onShowTenantPicker} className="w-10 h-10 rounded-xl object-contain cursor-pointer" />}
            <div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-0.5">
                <Clock size={12} />
                <span>{settings.working_time_start && settings.working_time_end ? `${settings.working_time_start} — ${settings.working_time_end}` : 'Доставка 35-60 мин'}</span>
              </div>
              <h1 onClick={onShowTenantPicker} className="text-2xl font-extrabold text-white tracking-tight cursor-pointer hover:opacity-80">{branding.common?.restaurantName || 'FoodChain'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('support')} className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-400">
              <MessageCircle size={20} />
            </button>
            {!isLoggedIn && (
              <button onClick={onShowLogin} className="px-4 h-10 bg-orange-500 rounded-xl flex items-center gap-2 text-white text-sm font-bold">
                <LogIn size={16} />
                Войти
              </button>
            )}
          </div>
        </div>
        <button onClick={onShowTenantPicker} className="w-full flex items-center gap-3 bg-zinc-900 rounded-2xl px-4 py-3.5 active:scale-[0.99] transition-transform">
          <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Store size={18} className="text-orange-500" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold text-white">{branding.common?.restaurantName || 'Выберите ресторан'}</div>
            <div className="text-xs text-zinc-500">{branch.name && branch.name !== 'Не выбран' ? branch.address || branch.name : 'Нажмите, чтобы выбрать ресторан'}</div>
          </div>
          <ChevronRight size={18} className="text-zinc-600" />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-6">
        {promos.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {promos.map((p, i) => (
              <div key={p.id || i} className="flex-shrink-0 w-64 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-4 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mt-6 -mr-6" />
                <p className="text-white font-extrabold text-sm">{p.name || p.title}</p>
                <p className="text-white/70 text-xs mt-1 line-clamp-2">{p.message || p.description}</p>
                {p.button_text && (
                  <button onClick={() => navigate('menu')} className="mt-2 bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur">
                    {p.button_text}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={() => navigate('menu')} className="w-full flex items-center gap-3 bg-zinc-900 rounded-2xl px-4 py-3.5 active:scale-[0.99] transition-transform">
          <Search size={18} className="text-zinc-500" />
          <span className="text-zinc-500 text-sm">Поиск блюд и категорий...</span>
        </button>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-extrabold text-white">Категории</h3>
            <button onClick={() => navigate('menu')} className="text-xs text-orange-500 font-semibold">Все</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {(categories as any[]).slice(0, 8).map((cat: any) => (
              <button key={cat.id} onClick={() => { setMenuCategoryId(cat.id); navigate('menu'); }} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${categoryColors[cat.id] || 'from-zinc-700 to-zinc-800'} flex items-center justify-center text-2xl shadow-lg overflow-hidden`}>
                  {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" /> : (cat.icon || '📁')}
                </div>
                <span className="text-[11px] font-semibold text-zinc-400 text-center leading-tight w-full line-clamp-2 px-0.5">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Flame size={20} className="text-orange-500" />
              Популярное
            </h3>
            <button onClick={() => navigate('menu')} className="text-xs text-orange-500 font-semibold">Все</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {popular.map((dish: any) => (
              <DishCard key={dish.id} dish={dish} onPress={() => { setSelectedDish(dish); navigate('dish'); }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuPage() {
  const { setGuestPage, setSelectedDish, searchQuery, setSearchQuery, menuCategoryId, setMenuCategoryId } = useApp();
  const { dishes, categories } = useMenuData();
  const [activeCat, setActiveCat] = useState(menuCategoryId || 0);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  let filtered = dishes;
  if (searchQuery) filtered = filtered.filter((d: any) => d.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Group dishes by category
  const grouped = (categories as any[]).map((cat: any) => ({
    ...cat,
    items: filtered.filter((d: any) => d.categoryId === cat.id),
  })).filter(g => g.items.length > 0);

  // Scroll to category section
  const scrollToCat = (catId: number) => {
    setActiveCat(catId);
    setMenuCategoryId(catId);
    if (catId === 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = sectionRefs.current[catId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // IntersectionObserver to auto-switch category tabs on scroll
  useEffect(() => {
    const visibleCats = new Map<number, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = Number(entry.target.getAttribute('data-cat-id'));
        if (entry.isIntersecting) {
          visibleCats.set(id, entry.intersectionRatio);
        } else {
          visibleCats.delete(id);
        }
      }
      if (visibleCats.size > 0) {
        let bestId = 0, bestRatio = 0;
        for (const [id, ratio] of visibleCats) {
          if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
        }
        if (bestId > 0) setActiveCat(bestId);
      }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-80px 0px -40% 0px' });

    for (const cat of (categories as any[])) {
      const el = sectionRefs.current[cat.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories, filtered]);

  // Scroll tabs horizontally to keep active tab visible
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeBtn = tabsRef.current.querySelector(`[data-cat-idx="${activeCat}"]`) as HTMLElement | null;
    if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeCat]);

  // Scroll to pre-selected category on mount
  useEffect(() => {
    if (menuCategoryId > 0) {
      const el = sectionRefs.current[menuCategoryId];
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, []);

  return (
    <div className="pb-20" ref={containerRef}>
      <DodoHeader title="Меню" />
      <div className="max-w-lg mx-auto px-4 pt-3">
        <div className="sticky top-14 z-30 bg-zinc-950 pb-3 space-y-3">
          <div className="flex items-center gap-2 bg-zinc-900 rounded-xl px-3 py-2.5 ring-1 ring-zinc-800">
            <Search size={18} className="text-zinc-500 flex-shrink-0" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Найти блюдо..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" />
            {searchQuery && <button onClick={() => setSearchQuery('')}><X size={16} className="text-zinc-500" /></button>}
          </div>

          <div ref={tabsRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button data-cat-idx="0" onClick={() => scrollToCat(0)} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap font-semibold transition-all ${activeCat === 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-zinc-900 text-zinc-400'}`}>Всё меню</button>
            {grouped.map((g: any) => (
              <button key={g.id} data-cat-idx={g.id} onClick={() => scrollToCat(g.id)} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap font-semibold transition-all ${activeCat === g.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-zinc-900 text-zinc-400'}`}>{g.name}</button>
            ))}
          </div>
        </div>

        {grouped.map((g: any) => (
          <div key={g.id} ref={el => { sectionRefs.current[g.id] = el; }} data-cat-id={g.id}>
            <h3 className="text-sm font-bold text-zinc-400 mb-3 mt-4 flex items-center gap-2">{g.imageUrl ? <img src={g.imageUrl} alt="" className="w-6 h-6 rounded-lg object-cover" /> : (g.icon || '📁')} {g.name}</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {g.items.map((dish: any) => (
                <DishCard key={dish.id} dish={dish} onPress={() => { setSelectedDish(dish); setGuestPage('dish'); }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DishPage() {
  const { selectedDish, setGuestPage, addToCart } = useApp();
  const [qty, setQty] = useState(1);
  if (!selectedDish) return null;
  const dish = selectedDish;
  const multiplier = qty;

  return (
    <div className="pb-24">
      <div className="relative aspect-square bg-zinc-900 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950 z-10" />
        {dish.imageUrl ? <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" /> : <span className="text-[120px] opacity-80">🍽️</span>}
        <button onClick={() => setGuestPage('menu')} className="absolute top-4 left-4 z-20 w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-white active:scale-90 transition-transform">
          <ChevronLeft size={24} />
        </button>
        <button onClick={() => setGuestPage('cart')} className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-white active:scale-90 transition-transform">
          <ShoppingCart size={20} />
        </button>
      </div>
      <div className="max-w-lg mx-auto px-4 -mt-8 relative z-20">
        <div className="bg-zinc-900 rounded-3xl p-5 shadow-xl space-y-4 ring-1 ring-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-white">{dish.name}</h1>
              {dish.weight > 0 && <span className="text-xs text-zinc-500 mt-1 block">{dish.weight}г</span>}
              <p className="text-xs text-zinc-500 mt-1">{dish.description}</p>
            </div>
            <div className="flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded-lg flex-shrink-0">
              <Star size={14} fill="#f59e0b" className="text-amber-400" />
              <span className="text-sm font-bold text-zinc-300">{dish.rating}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-zinc-800/50 rounded-xl py-3">
              <p className="text-lg font-extrabold text-white">{Math.round(dish.calories * multiplier)}</p>
              <p className="text-[10px] font-medium text-zinc-500">Ккал</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl py-3">
              <p className="text-lg font-extrabold text-white">{Math.round(dish.proteins * multiplier)}г</p>
              <p className="text-[10px] font-medium text-zinc-500">Белки</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl py-3">
              <p className="text-lg font-extrabold text-white">{Math.round(dish.fats * multiplier)}г</p>
              <p className="text-[10px] font-medium text-zinc-500">Жиры</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl py-3">
              <p className="text-lg font-extrabold text-white">{Math.round(dish.carbs * multiplier)}г</p>
              <p className="text-[10px] font-medium text-zinc-500">Углеводы</p>
            </div>
          </div>
        </div>
      </div>
      <div className="fixed bottom-16 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl p-4 border-t border-zinc-800">
        <div className="flex gap-3 max-w-lg mx-auto">
          <div className="flex items-center bg-zinc-800 rounded-xl">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 text-zinc-400 active:text-white transition-colors"><Minus size={18} /></button>
            <span className="font-bold text-white w-8 text-center">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="p-3 text-zinc-400 active:text-white transition-colors"><Plus size={18} /></button>
          </div>
          <button onClick={() => { addToCart(dish, qty); setGuestPage('menu'); }} className="flex-1 bg-orange-500 text-white font-extrabold rounded-xl py-3 active:scale-[0.98] transition-transform shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
            В корзину <span className="text-white/80">·</span> {usePrice()(dish.price * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartPage() {
  const { cart, updateCartQty, removeFromCart, cartTotal, setGuestPage, clearCart, promoCode, setPromoCode, promoDiscount, applyPromo } = useApp();
  const settings = usePublicSettings();
  const { categories } = useMenuData();
  const freeDelivFrom = settings.free_delivery_from || 0;
  const remaining = freeDelivFrom > 0 ? Math.max(0, freeDelivFrom - cartTotal) : 0;
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  if (cart.length === 0) return (
    <div className="pb-20 text-center pt-32">
      <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-4">
        <ShoppingCart size={36} className="text-zinc-600" />
      </div>
      <p className="text-zinc-500 font-semibold">Корзина пуста</p>
      <p className="text-xs text-zinc-600 mt-1">Добавьте блюда из меню</p>
      <button onClick={() => setGuestPage('menu')} className="mt-6 bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl">В меню</button>
    </div>
  );

  return (
    <div className="pb-36">
      <DodoHeader title="Корзина" />
      <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">
        {cart.map(item => (
          <div key={item.dish.id} className="bg-zinc-900 rounded-2xl p-4 flex gap-3 ring-1 ring-zinc-800">
            <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl overflow-hidden">
              {item.dish.imageUrl ? <img src={item.dish.imageUrl} alt={item.dish.name} className="w-full h-full object-cover" /> : ((categories as any[]).find((c: any) => c.id === item.dish.categoryId)?.icon || '🍽️')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-semibold text-sm text-white truncate">{item.dish.name}</h4>
                <button onClick={() => removeFromCart(item.dish.id)} className="p-1 flex-shrink-0">
                  <Trash2 size={14} className="text-zinc-600 hover:text-red-500 transition-colors" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 bg-zinc-800 rounded-lg">
                  <button onClick={() => updateCartQty(item.dish.id, item.quantity - 1)} className="p-1.5 text-zinc-400 active:text-white"><Minus size={14} /></button>
                  <span className="text-sm font-bold text-white w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateCartQty(item.dish.id, item.quantity + 1)} className="p-1.5 text-zinc-400 active:text-white"><Plus size={14} /></button>
                </div>
                <span className="font-extrabold text-white">{usePrice()(item.totalPrice)}</span>
              </div>
            </div>
          </div>
        ))}

        <div className="bg-zinc-900 rounded-2xl p-3 ring-1 ring-zinc-800 flex items-center gap-2">
          <input value={promoCode} onChange={e => { setPromoCode(e.target.value); setPromoApplied(false); }} placeholder="Промокод" className="flex-1 bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
          <button onClick={async () => { await applyPromo(); setPromoApplied(true); }} className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600">Применить</button>
        </div>
        {promoApplied && promoDiscount > 0 && (
          <div className="text-xs text-green-400 font-semibold text-center">Скидка по промокоду: {usePrice()(promoDiscount)}</div>
        )}
        {promoApplied && promoDiscount === 0 && promoCode && (
          <div className="text-xs text-red-400 font-semibold text-center">Промокод недействителен</div>
        )}
      </div>
      <div className="fixed bottom-16 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl p-4 border-t border-zinc-800">
        <div className="max-w-lg mx-auto w-full">
          {freeDelivFrom > 0 && remaining > 0 && (
            <div className="mb-3 px-1">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>До бесплатной доставки осталось</span>
                <span className="text-orange-400 font-semibold">{usePrice()(remaining)}</span>
              </div>
              <div className="bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-orange-500 rounded-full h-full transition-all" style={{ width: `${Math.min(100, (cartTotal / freeDelivFrom) * 100)}%` }} />
              </div>
            </div>
          )}
          {freeDelivFrom > 0 && remaining <= 0 && cartTotal > 0 && (
            <div className="mb-3 px-1 text-xs text-green-400 font-semibold">Бесплатная доставка!</div>
          )}
          {promoDiscount > 0 && (
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-xs text-zinc-500">Скидка</span>
              <span className="text-xs text-green-400">-{usePrice()(promoDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-sm text-zinc-400">Итого</span>
            <span className="text-xl font-extrabold text-white">{usePrice()(Math.max(0, cartTotal - promoDiscount))}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowClearConfirm(true)} className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-500 active:scale-90 transition-all flex-shrink-0" title="Очистить корзину">
              <Trash2 size={20} />
            </button>
            <button onClick={() => setGuestPage('checkout')} className="flex-1 bg-orange-500 text-white font-extrabold py-3.5 rounded-xl active:scale-[0.99] transition-transform shadow-lg shadow-orange-500/20">
              Оформить заказ
            </button>
          </div>
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-zinc-900 rounded-3xl p-6 max-w-sm w-full ring-1 ring-zinc-800" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-2">Очистить корзину?</h3>
            <p className="text-sm text-zinc-400 text-center mb-6">Все выбранные блюда будут удалены из корзины</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-xl text-sm">Отмена</button>
              <button onClick={() => { clearCart(); setShowClearConfirm(false); }} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl text-sm">Очистить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckoutPage() {
  const { cartTotal, clearCart, setGuestPage, registeredUsers, cart, bonusBalance, promoDiscount, promoCode } = useApp();
  const settings = usePublicSettings();
  const storedUser = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
  const found = registeredUsers.find(u => u && u.phone === storedUser.phone);
  const currentUser = found ? { ...found, name: storedUser.name || found.name, phone: storedUser.phone || found.phone } : (storedUser.phone ? { name: storedUser.name || 'Гость', phone: storedUser.phone, id: storedUser.id || storedUser.userId } : undefined);
  const userId = currentUser?.id || storedUser.userId || storedUser.id;
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [apartment, setApartment] = useState('');
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [intercom, setIntercom] = useState('');
  const [addressComment, setAddressComment] = useState('');
  const [pickupPoint, setPickupPoint] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | number | null>(null);
  const [placed, setPlaced] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bonusInfo, setBonusInfo] = useState<any>(null);
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusLoading, setBonusLoading] = useState(false);

  const deliveryCost = orderType === 'delivery' ? (settings.delivery_cost || 0) : 0;
  const freeDelivFrom = settings.free_delivery_from || 0;
  const isFreeDelivery = orderType === 'delivery' && freeDelivFrom > 0 && cartTotal >= freeDelivFrom;
  const actualDeliveryCost = isFreeDelivery ? 0 : deliveryCost;
  const bonusDiscount = useBonuses && bonusInfo ? Math.floor(Math.min(bonusInfo.maxDiscount, bonusInfo.availableBonus)) : 0;
  const cartAfterPromo = Math.max(0, cartTotal - promoDiscount);
  const totalWithDelivery = cartAfterPromo + actualDeliveryCost - bonusDiscount;

  useEffect(() => {
    api.getActivePaymentMethods().then(methods => {
      setPaymentMethods(methods);
      if (methods.length > 0) setSelectedPaymentId(methods[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (userId && bonusBalance > 0) {
      setBonusLoading(true);
      api.calculateBonusDiscount(userId, cartTotal).then(info => {
        setBonusInfo(info);
        if (!info.canUseBonuses) setUseBonuses(false);
      }).catch(() => {}).finally(() => setBonusLoading(false));
    }
  }, [userId, cartTotal, bonusBalance]);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setError('Корзина пуста. Добавьте блюда в корзину');
      return;
    }
    if (orderType === 'delivery' && !address) {
      setError('Укажите адрес доставки');
      return;
    }
    if (orderType === 'delivery' && !/\d/.test(address)) {
      setError('Укажите номер дома');
      return;
    }
    setError('');
    setSubmitting(true);
    const userId = currentUser?.id || Date.now() % 100000;
    const userName = currentUser?.name || storedUser.name || 'Гость';
    const userPhone = currentUser?.phone || storedUser.phone || '';
    const items = cart.map(i => ({
      dishId: i.dish.id,
      name: i.dish.name,
      price: i.dish.price,
      quantity: i.quantity,
      options: Object.entries(i.selectedOptions).flatMap(([, optIds]) =>
        optIds.map(oid => i.dish.customizations?.find(c => c.options.find(o => o.id === oid))?.options.find(o => o.id === oid)?.name || '')
      ).filter(Boolean),
    }));
    const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentId);
    const fullAddress = orderType === 'delivery'
      ? `${address}, кв ${apartment || '—'}, подъезд ${entrance || '—'}, этаж ${floor || '—'}, домофон ${intercom || '—'}${addressComment ? `. Комментарий: ${addressComment}` : ''}`
      : pickupPoint?.address || '';

    try {
      const bonusToUse = useBonuses && bonusInfo ? Math.min(bonusInfo.maxDiscount, bonusInfo.availableBonus) : 0;
      const order = await api.createOrder({
        user_id: userId,
        user_name: userName,
        user_phone: userPhone,
        address: fullAddress,
        items,
        total: cartAfterPromo,
        payment_method: selectedMethod?.key || 'cash',
        type: orderType,
        bonus_used: Math.round(bonusToUse),
        promo_code: promoCode || undefined,
      });
      setLastOrderId(order.id);

      const isQrPayment = selectedMethod?.key === 'sbp_qr' || selectedMethod?.key === 'sber_qr';
      const isOnlinePayment = selectedMethod?.key === 'online' || selectedMethod?.key?.includes('_card') || selectedMethod?.key?.includes('_sbp');

      if (isQrPayment) {
        const qrType = selectedMethod.key === 'sbp_qr' ? 'sbp' : 'sber';
        try {
          const qrResult = await api.createQrPayment({
            orderId: order.id,
            amount: totalWithDelivery,
            description: `Заказ #${order.id}`,
            qrType,
          });
          if (qrResult.ok && qrResult.qrCode) {
            sessionStorage.setItem('pending_qr_payment', JSON.stringify({
              paymentId: qrResult.paymentId || order.id,
              qrCode: qrResult.qrCode,
              qrExpiry: qrResult.expiryDate || (Date.now() + 5 * 60 * 1000),
              orderId: order.id,
            }));
            clearCart();
            setPlaced(false);
            setSubmitting(false);
            setGuestPage('qr-payment');
            return;
          } else {
            setError(qrResult.error || 'Ошибка создания QR-кода');
            setSubmitting(false);
            return;
          }
        } catch (e: any) {
          setError(e.message || 'Ошибка создания QR-кода');
          setSubmitting(false);
          return;
        }
      }

      if (isOnlinePayment) {
        const provider = selectedMethod.key.includes('_') ? selectedMethod.key.split('_')[0] : 'yookassa';
        const paymentMethod = selectedMethod.key.includes('_sbp') ? 'sbp' : 'card';
        const returnUrl = window.location.origin + '/guest';
        const paymentResult = await api.createPayment({
          orderId: order.id,
          amount: totalWithDelivery,
          description: `Заказ #${order.id}`,
          returnUrl,
          paymentMethod,
          provider,
        });

        if (paymentResult.ok && paymentResult.confirmationUrl) {
          sessionStorage.setItem('pending_payment', JSON.stringify({
            paymentId: paymentResult.paymentId,
            confirmationUrl: paymentResult.confirmationUrl,
            orderId: order.id,
          }));
          clearCart();
          setPlaced(false);
          setSubmitting(false);
          setGuestPage('payment');
          return;
        } else {
          setError(paymentResult.error || 'Ошибка создания платежа');
          setSubmitting(false);
          return;
        }
      }

      setPlaced(true);
      clearCart();
    } catch (e: any) {
      setError(e.message || 'Ошибка при оформлении заказа');
    }
    setSubmitting(false);
  };

  useEffect(() => {
    if (placed) {
      const timer = setTimeout(() => setGuestPage('order-tracking'), 3000);
      return () => clearTimeout(timer);
    }
  }, [placed]);

  if (placed) return (
    <div className="pb-20 text-center pt-32">
      <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
        <Package size={36} className="text-green-500" />
      </div>
      <h2 className="text-xl font-extrabold text-white">Заказ #{lastOrderId} оформлен!</h2>
      <p className="text-zinc-500 text-sm mt-1">Скоро с вами свяжется оператор</p>
      {lastOrderId && (
        <p className="text-xs text-zinc-600 mt-2">Номер заказа: #{lastOrderId}</p>
      )}
      <div className="flex flex-col gap-3 mt-6 max-w-xs mx-auto">
        <button onClick={() => { setGuestPage('order-tracking'); }} className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl">Отследить заказ</button>
      </div>
    </div>
  );

  const paymentIcons: Record<string, string> = {
    cash: '💵',
    card: '💳',
    online: '🌐',
    in_venue: '🏪',
    sbp_qr: '📱',
    sber_qr: '🏦',
  };

  return (
    <div className="pb-24">
      <DodoHeader title="Оформление" showBack onBack={() => setGuestPage('cart')} />
      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">
        <div className="bg-zinc-900 rounded-2xl p-1.5 flex ring-1 ring-zinc-800">
          <button onClick={() => setOrderType('delivery')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${orderType === 'delivery' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-zinc-500'}`}>🚗 Доставка</button>
          <button onClick={() => setOrderType('pickup')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${orderType === 'pickup' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-zinc-500'}`}>🏪 Самовынос</button>
        </div>

        {orderType === 'delivery' && (
          <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 space-y-3">
            <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Адрес доставки</p>
            <AddressInput value={address} onChange={v => { setAddress(v); setError(''); }} placeholder="Улица, дом" className="mb-2" />
            <div className="grid grid-cols-2 gap-2">
              <input value={apartment} onChange={e => setApartment(e.target.value)} placeholder="Квартира/офис" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
              <input value={entrance} onChange={e => setEntrance(e.target.value)} placeholder="Подъезд" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
              <input value={floor} onChange={e => setFloor(e.target.value)} placeholder="Этаж" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
              <input value={intercom} onChange={e => setIntercom(e.target.value)} placeholder="Домофон" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            </div>
            <input value={addressComment} onChange={e => setAddressComment(e.target.value)} placeholder="Комментарий курьеру" className="w-full bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
          </div>
        )}

        {orderType === 'pickup' && (
          <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Точка самовывоза</p>
            <PickupPointSelector selectedId={pickupPoint?.id} onSelect={setPickupPoint} />
          </div>
        )}

        {/* Bonus Section */}
        {bonusInfo?.canUseBonuses && (
          <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setUseBonuses(!useBonuses)} className={`w-11 h-6 rounded-full transition-all relative ${useBonuses ? 'bg-orange-500' : 'bg-zinc-700'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${useBonuses ? 'left-6' : 'left-1'}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Списать бонусы</p>
                <p className="text-xs text-zinc-500">{bonusInfo.availableBonus} баллов доступно</p>
              </div>
              {useBonuses && <span className="text-sm font-bold text-orange-500">-{usePrice()(bonusDiscount)}</span>}
            </label>
          </div>
        )}

        <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
          <p className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wider">Способ оплаты</p>
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-zinc-500">Способы оплаты не настроены</p>
          ) : (
            <div className="space-y-2">
              {paymentMethods.map(m => (
                <label key={m.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedPaymentId === m.id ? 'bg-orange-500/10 ring-1 ring-orange-500' : 'bg-zinc-800 ring-1 ring-zinc-700 hover:ring-zinc-500'}`}>
                  <input type="radio" name="payment" checked={selectedPaymentId === m.id} onChange={() => setSelectedPaymentId(m.id)} className="sr-only" />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPaymentId === m.id ? 'border-orange-500' : 'border-zinc-500'}`}>
                    {selectedPaymentId === m.id && <div className="w-2.5 h-2.5 bg-orange-500 rounded-full" />}
                  </div>
                  <span className="text-lg">{paymentIcons[m.key] || '💳'}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <p className="text-xs text-zinc-500">{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 text-sm text-red-400 text-center">{error}</div>
        )}

        <button
          onClick={handlePlaceOrder}
          disabled={submitting}
          className="w-full bg-orange-500 text-white font-extrabold py-4 rounded-xl active:scale-[0.99] transition-transform shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Оформление...</>
          ) : (
            <>{useBonuses && bonusDiscount > 0 ? `Оплатить ${usePrice()(totalWithDelivery)} (скидка ${usePrice()(bonusDiscount)})` : `Оплатить ${usePrice()(totalWithDelivery)}`}</>
          )}
        </button>
      </div>
    </div>
  );
}

function ProfilePage({ onLogout }: { onLogout: () => void }) {
  const ctx = useApp();
  if (!ctx) return <div className="p-4 text-red-500">Context error</div>;
  const { setGuestPage, registeredUsers, favorites, orders, bonusBalance, setBonusBalance } = ctx;
  const settings = usePublicSettings();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [bonusData, setBonusData] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const meRes = await api.getMe();
        if (meRes?.user) {
          setProfileUser(meRes.user);
          const guest = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
          Object.assign(guest, meRes.user);
          sessionStorage.setItem('foodchain_guest_user', JSON.stringify(guest));
          const uid = meRes.user.id;
          api.getGuestBonusInfo(uid).then(d => {
            setBonusData(d);
            setBonusBalance(d.balance || 0);
          }).catch(() => {});
          return;
        }
      } catch {}
      const storedUser = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
      setProfileUser(storedUser);
      const uid = storedUser.id || storedUser.userId;
      if (uid) {
        api.getGuestBonusInfo(uid).then(d => {
          setBonusData(d);
          setBonusBalance(d.balance || 0);
        }).catch(() => {});
      }
    };
    loadProfile();
  }, []);

  const initialPts = settings.initial_points || 0;
  const level = bonusData?.level || 'новичок';
  const levelColors: Record<string, string> = {
    'новичок': 'text-zinc-400', 'бронза': 'text-amber-600',
    'серебро': 'text-zinc-300', 'золото': 'text-amber-400', 'платина': 'text-purple-400',
  };
  const levelColor = levelColors[level.toLowerCase()] || 'text-zinc-400';
  const nextLevel = bonusData?.nextLevel || null;
  const progress = bonusData?.progress || 0;

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 px-4 pt-6 pb-8 border-b border-zinc-800">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white shadow-lg shadow-orange-500/20">
                {profileUser?.name ? profileUser.name[0].toUpperCase() : '👤'}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">{profileUser?.name || 'Гость'}</h2>
                <p className="text-sm text-zinc-500">{profileUser?.phone || ''}</p>
              </div>
            </div>
            <button onClick={() => setGuestPage('settings')} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
              <Settings size={20} />
            </button>
          </div>
          <div className="bg-zinc-800/50 rounded-2xl p-3 flex items-center gap-3">
            <Award size={24} className="text-orange-500" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{bonusBalance} баллов</span>
                <span className={`text-xs font-semibold ${levelColor}`}>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
              </div>
              {nextLevel && (
                <div className="mt-1.5 bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-orange-500 rounded-full h-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
            <ChevronRight size={16} className="text-zinc-600" onClick={() => setGuestPage('loyalty')} />
          </div>
        </div>
      </div>
      <div className="px-4 -mt-3 space-y-2 max-w-lg mx-auto">
        <div className="grid grid-cols-2 gap-2">
          <QuickAction icon={Truck} label={`${orders.length} заказов`} onClick={() => setGuestPage('orders')} />
          <QuickAction icon={BookHeart} label={`${favorites.length} в избранном`} onClick={() => setGuestPage('favorites')} />
          <QuickAction icon={MapPinned} label="Адреса" onClick={() => setGuestPage('addresses')} />
          <QuickAction icon={Ticket} label="Купоны" onClick={() => setGuestPage('coupons')} />
        </div>
        <MenuItem icon={RotateCcw} label="Повторить заказ" onClick={() => setGuestPage('repeat-order')} />
        <MenuItem icon={Gamepad2} label="Мини-игра" onClick={() => setGuestPage('mini-game')} />
        <MenuItem icon={Star} label="Мои отзывы" onClick={() => setGuestPage('reviews')} />
        <MenuItem icon={MessageCircle} label="Чат с поддержкой" onClick={() => setGuestPage('support-chat')} />
        <div className="pt-4">
          <button onClick={onLogout} className="w-full flex items-center gap-3 bg-red-500/10 text-red-400 p-4 rounded-2xl font-semibold text-sm active:scale-[0.99] transition-transform">
            <LogOut size={18} /> Выйти
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="bg-zinc-900 rounded-2xl p-4 text-center active:scale-[0.98] transition-transform ring-1 ring-zinc-800">
      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-2">
        <Icon size={20} className="text-zinc-400" />
      </div>
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
    </button>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 bg-zinc-900 p-4 rounded-2xl active:scale-[0.99] transition-transform ring-1 ring-zinc-800">
      <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center">
        <Icon size={18} className="text-zinc-400" />
      </div>
      <span className="flex-1 text-left text-sm font-semibold text-white">{label}</span>
      <ChevronRight size={18} className="text-zinc-600" />
    </button>
  );
}

function BookingPage() {
  const { setGuestPage, addBooking, addNotification } = useApp();
  const [form, setForm] = useState({ name: '', phone: '', date: '', time: '', guests: 2 });
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return (
    <div className="pb-20 text-center pt-32">
      <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
        <Calendar size={36} className="text-green-500" />
      </div>
      <h2 className="text-xl font-extrabold text-white">Столик забронирован!</h2>
      <p className="text-zinc-500 text-sm mt-1">Ждём вас в гости</p>
      <button onClick={() => setGuestPage('home')} className="mt-8 bg-orange-500 text-white font-bold px-8 py-3 rounded-xl">На главную</button>
    </div>
  );

  return (
    <div className="pb-20">
      <DodoHeader title="Бронирование" />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="bg-zinc-900 rounded-2xl p-5 space-y-4 ring-1 ring-zinc-800">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Имя</p>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ваше имя" className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none ring-1 ring-zinc-700 focus:ring-orange-500 transition-all" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Телефон</p>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+7 (999) 000-00-00" className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none ring-1 ring-zinc-700 focus:ring-orange-500 transition-all" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Дата</p>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none ring-1 ring-zinc-700 focus:ring-orange-500 transition-all" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Время</p>
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none ring-1 ring-zinc-700 focus:ring-orange-500 transition-all" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Гостей</p>
            <div className="flex items-center gap-3 bg-zinc-800 rounded-xl px-4 py-2.5 ring-1 ring-zinc-700">
              <button onClick={() => setForm({ ...form, guests: Math.max(1, form.guests - 1) })} className="p-1 text-zinc-400"><Minus size={16} /></button>
              <span className="flex-1 text-center font-bold text-white">{form.guests}</span>
              <button onClick={() => setForm({ ...form, guests: Math.min(20, form.guests + 1) })} className="p-1 text-zinc-400"><Plus size={16} /></button>
            </div>
          </div>
        </div>
        <button onClick={() => {
          const book = { id: Date.now() % 100000, userId: 0, userName: form.name, userPhone: form.phone, branchId: 1, date: form.date, time: form.time, duration: 2, guestCount: form.guests, tableId: 0, tableName: 'Любой', status: 'pending' as const, deposit: 0, createdAt: new Date().toISOString() };
          addBooking(book);
          addNotification({ type: 'booking', title: 'Новая бронь', body: `${form.name} — ${form.date} ${form.time}, ${form.guests} гостей`, link: 'bookings' });
          setSubmitted(true);
        }} className="w-full bg-orange-500 text-white font-extrabold py-3.5 rounded-xl active:scale-[0.99] transition-transform shadow-lg shadow-orange-500/20">Забронировать</button>
      </div>
    </div>
  );
}

function OrdersPage() {
  const { orders, setGuestPage } = useApp();
  const userOrders = orders.slice(0, 10);
  return (
    <div className="pb-20">
      <DodoHeader title="Мои заказы" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {userOrders.length === 0 && (
          <div className="text-center pt-16">
            <Package size={48} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 font-semibold">У вас ещё нет заказов</p>
          </div>
        )}
        {userOrders.map(order => (
          <div key={order.id} className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <Package size={18} className="text-orange-500" />
                </div>
                <div>
                  <span className="font-bold text-white">#{order.id}</span>
                  <p className="text-xs text-zinc-500">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-extrabold text-white">{usePrice()(order.total)}</span>
                <p className="text-xs text-zinc-500">{order.address || 'Самовынос'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoyaltyPage() {
  const { bonusBalance, setBonusBalance, setGuestPage } = useApp();
  const [data, setData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'history'>('overview');

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
    const userId = stored.userId || stored.id;
    if (!userId) { setLoading(false); return; }
    api.getGuestBonusInfo(userId).then(d => {
      setData(d);
      setBonusBalance(d.balance || 0);
    }).catch(() => {}).finally(() => setLoading(false));
    api.getGuestBonusTransactions(userId).then(r => {
      setTransactions(r.transactions || []);
    }).catch(() => {});
  }, []);

  const levelColors: Record<string, string> = {
    'новичок': 'text-zinc-400 bg-zinc-400/10',
    'бронза': 'text-amber-600 bg-amber-600/10',
    'серебро': 'text-zinc-300 bg-zinc-300/10',
    'золото': 'text-amber-400 bg-amber-400/10',
    'платина': 'text-purple-400 bg-purple-400/10',
  };

  if (loading) return (
    <div className="pb-20">
      <DodoHeader title="Лояльность" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-10 text-center text-zinc-500">Загрузка...</div>
    </div>
  );

  return (
    <div className="pb-20">
      <DodoHeader title="Программа лояльности" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mt-8 -mr-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -mb-6 -ml-6" />
          <Award size={36} className="mb-3" />
          <p className="text-4xl font-extrabold">{data?.balance || 0}</p>
          <p className="text-white/70 text-sm mt-1">бонусных баллов</p>
          <p className="text-xs text-white/50 mt-1">Всего начислено: {data?.lifetimeEarned || 0} • Потрачено: {data?.lifetimeSpent || 0}</p>
        </div>

        {/* Level Card */}
        {data?.level && (
          <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ваш уровень</p>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${levelColors[data.level.toLowerCase()] || 'text-zinc-400 bg-zinc-400/10'}`}>
                {data.level.charAt(0).toUpperCase() + data.level.slice(1)}
              </span>
            </div>
            {data.nextLevel ? (
              <>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-zinc-400">До уровня «{data.nextLevel.name}»</span>
                  <span className="text-zinc-500">нужно {usePrice()(Math.max(0, data.nextLevel.minSpent - data.totalSpent))}</span>
                </div>
                <div className="bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-full h-full transition-all duration-500" style={{ width: `${data.progress || 0}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-400">Вы достигли максимального уровня!</p>
            )}
            <p className="text-xs text-zinc-500 mt-2">Сумма заказов: {usePrice()(data?.totalSpent || 0)}</p>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Как это работает</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500/10 rounded-xl flex items-center justify-center text-sm">🛒</div>
              <span className="text-sm text-zinc-400">{data?.bonusPercent || 5}% от суммы заказа — бонусами</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500/10 rounded-xl flex items-center justify-center text-sm">💳</div>
              <span className="text-sm text-zinc-400">Можно оплатить до {data?.maxWriteOffPercent || 50}% заказа бонусами</span>
            </div>
            {data?.burnDays > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500/10 rounded-xl flex items-center justify-center text-sm">🔥</div>
                <span className="text-sm text-zinc-400">Бонусы сгорают через {data.burnDays} дней без активности</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs: Overview / History */}
        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 ring-1 ring-zinc-800">
          <button onClick={() => setTab('overview')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'overview' ? 'bg-orange-500 text-white' : 'text-zinc-500'}`}>Обзор</button>
          <button onClick={() => setTab('history')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'history' ? 'bg-orange-500 text-white' : 'text-zinc-500'}`}>История</button>
        </div>

        {tab === 'history' && (
          <div className="bg-zinc-900 rounded-2xl ring-1 ring-zinc-800 overflow-hidden">
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-sm">История операций пуста</div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${tx.type === 'earned' ? 'bg-green-500/10' : tx.type === 'burn' ? 'bg-red-500/10' : 'bg-orange-500/10'}`}>
                        {tx.type === 'earned' ? '➕' : tx.type === 'burn' ? '🔥' : '➖'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{tx.description || (tx.type === 'earned' ? 'Начисление' : tx.type === 'burn' ? 'Сгорание' : 'Списание')}</p>
                        <p className="text-xs text-zinc-500">{new Date(tx.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <span className={`font-extrabold text-sm ${tx.type === 'earned' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.type === 'earned' ? '+' : '-'}{usePrice()(Math.abs(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'overview' && (
          <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Уровни лояльности</p>
            <div className="space-y-2">
              {[
                { name: 'Новичок', min: '0₽', percent: '5%', color: 'text-zinc-400' },
                { name: 'Бронза', min: '5 000₽', percent: '7%', color: 'text-amber-600' },
                { name: 'Серебро', min: '20 000₽', percent: '10%', color: 'text-zinc-300' },
                { name: 'Золото', min: '50 000₽', percent: '15%', color: 'text-amber-400' },
                { name: 'Платина', min: '100 000₽', percent: '20%', color: 'text-purple-400' },
              ].map((lvl, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${lvl.color}`}>{lvl.name}</span>
                    <span className="text-xs text-zinc-600">от {lvl.min}</span>
                  </div>
                  <span className="text-xs font-semibold text-orange-500">{lvl.percent} бонусов</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewsPage() {
  const { setGuestPage, reviews: allReviews, addReview } = useApp();
  const { dishes, categories } = useMenuData();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ dishId: 0, rating: 5, text: '', photoUrl: '' });
  const userReviews = allReviews.filter(r => r.userId === 1);
  const availableDishes = dishes.filter((d: any) => d.id % 3 === 0).slice(0, 5);

  const handleSubmit = () => {
    if (!form.text || !form.dishId) return;
    const dish = dishes.find((d: any) => d.id === form.dishId);
    addReview({ userId: 1, userName: 'Вы', dishId: form.dishId, dishName: dish?.name || '', rating: form.rating, text: form.text, photoUrl: form.photoUrl || undefined, source: 'mobile_app', branchId: 1, branchName: 'Центр' });
    setForm({ dishId: 0, rating: 5, text: '', photoUrl: '' });
    setShowForm(false);
  };

  return (
    <div className="pb-20">
      <DodoHeader title="Мои отзывы" showBack onBack={() => setGuestPage('profile')} rightAction={
        <button onClick={() => setShowForm(!showForm)} className="p-2 -mr-2 text-orange-500"><Edit3 size={20} /></button>
      } />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {showForm && (
          <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 space-y-3">
            <select value={form.dishId} onChange={e => setForm({ ...form, dishId: +e.target.value })} className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700">
              <option value={0}>Выберите блюдо</option>
              {availableDishes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setForm({ ...form, rating: s })} className={`p-2 transition-all ${s <= form.rating ? 'scale-110' : 'opacity-40'}`}>
                  <Star size={28} fill={s <= form.rating ? '#f59e0b' : 'none'} className="text-amber-400" />
                </button>
              ))}
            </div>
            <textarea value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="Ваш отзыв..." className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 min-h-[80px] resize-none placeholder-zinc-600" />
            <input value={form.photoUrl} onChange={e => setForm({ ...form, photoUrl: e.target.value })} placeholder="Ссылка на фото (необязательно)" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <button onClick={handleSubmit} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl">Оставить отзыв</button>
          </div>
        )}
        {userReviews.length === 0 && !showForm && (
          <div className="text-center pt-12">
            <Star size={48} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 font-semibold">У вас ещё нет отзывов</p>
            <button onClick={() => setShowForm(true)} className="mt-4 bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl">Написать отзыв</button>
          </div>
        )}
        {userReviews.map(review => {
          const cat = (categories as any[]).find((c: any) => c.id === (dishes as any[]).find((d: any) => d.id === review.dishId)?.categoryId);
          return (
            <div key={review.id} className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{cat?.icon || '🍽️'}</span>
                <div>
                  <p className="font-semibold text-sm text-white">{review.dishName}</p>
                  <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill={i < review.rating ? '#f59e0b' : 'none'} className="text-amber-400" />)}</div>
                </div>
              </div>
              <p className="text-sm text-zinc-400">{review.text}</p>
              {review.photoUrl && <div className="mt-2 bg-zinc-800 rounded-xl h-24 flex items-center justify-center text-zinc-600"><ImageIcon size={24} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SupportChatPage() {
  const { setGuestPage, guestPage } = useApp();
  const user = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
  const senderName = user.name || user.phone || 'Гость';
  const senderPhone = user.phone || '';
  const [chatId, setChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [waiterTyping, setWaiterTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const chatIdRef = useRef<number | null>(null);
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const initChat = async () => {
      try {
        const chats = await api.getChats({ status: 'all', tenant_id: 1 });
        if (cancelled) return null;
        let myChat = chats.find((c: any) => c.guestPhone === senderPhone || c.guestName === senderName);
        if (myChat) {
          if (myChat.status === 'closed') {
            myChat = await api.reopenChat(myChat.id);
          }
          setChatId(myChat.id);
          ws?.send(JSON.stringify({ type: 'subscribe:chat', chatId: myChat.id }));
          const msgs = await api.getChatMessages(myChat.id);
          if (!cancelled) {
            setMessages(msgs.map((m: any) => ({
              id: m.id, fromUser: m.senderType === 'guest', text: m.message || '',
              timestamp: m.createdAt || new Date().toISOString(), isRead: m.isRead || false,
              fileUrl: m.fileUrl || '',
            } as SupportMessage)));
          }
        } else {
          const chat = await api.createChat({ guest_name: senderName, guest_phone: senderPhone });
          setChatId(chat.id);
          ws?.send(JSON.stringify({ type: 'subscribe:chat', chatId: chat.id }));
        }
      } catch {} finally { if (!cancelled) setLoading(false); }
    };

    const connect = () => {
      const apiBase = localStorage.getItem('foodchain_api_url') || 'http://localhost:4000';
      const wsUrl = apiBase.replace(/^http/, 'ws');
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        if (cancelled) { ws?.close(); return; }
        initChat();
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const currentId = chatIdRef.current;
          if (data.type === 'chat:message' && data.chatId === currentId) {
            const m = data.message;
            setMessages(prev => {
              if (prev.some(x => x.id === m.id)) return prev;
              return [...prev, { id: m.id, fromUser: m.senderType === 'guest', text: m.message || '', timestamp: m.createdAt, isRead: m.isRead, fileUrl: m.fileUrl || '' }];
            });
          }
          if (data.type === 'chat:typing' && data.chatId === currentId && data.senderType === 'waiter') {
            setWaiterTyping(true);
            clearTimeout((window as any).__waiterTypingTimer);
            (window as any).__waiterTypingTimer = setTimeout(() => setWaiterTyping(false), 3000);
          }
          if (data.type === 'chat:closed' && data.data?.id === currentId) {
            setMessages(prev => [...prev, { id: Date.now(), fromUser: false, text: 'Чат закрыт. Спасибо за обращение!', timestamp: new Date().toISOString(), isRead: true }]);
          }
        } catch {}
      };
      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => { ws?.close(); };
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      ws?.close();
      clearTimeout((window as any).__waiterTypingTimer);
    };
  }, []);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages, waiterTyping]);

  const send = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    const msgText = text;
    const textToSend = text;
    setText('');
    setFile(null);
    try {
      let fileUrl = '';
      if (file) {
        const upload = await api.uploadChatFile(file);
        fileUrl = upload.url;
      }
      const saved = await api.sendChatMessage(chatId!, {
        sender_type: 'guest', sender_name: senderName, message: textToSend, file_url: fileUrl,
      });
      setMessages(prev => [...prev, { id: saved.id, fromUser: true, text: saved.message || '', timestamp: saved.createdAt, isRead: true, fileUrl: saved.fileUrl || '' }]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now(), fromUser: true, text: msgText, timestamp: new Date().toISOString(), isRead: true }]);
    } finally { setSending(false); }
  };

  const pickFile = () => fileRef.current?.click();

  if (loading) {
    return (
      <div className="pb-20">
        <DodoHeader title="Чат с поддержкой" showBack onBack={() => setGuestPage('profile')} />
        <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <DodoHeader title="Чат с поддержкой" showBack onBack={() => setGuestPage('profile')} />
      <div ref={chatRef} className="max-w-lg mx-auto px-4 pt-4 space-y-3 overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
        {messages.length === 0 && (
          <div className="text-center py-10 text-zinc-500 text-sm">Напишите нам — мы поможем!</div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.fromUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.fromUser ? 'bg-orange-500 text-white rounded-br-md' : 'bg-zinc-800 text-zinc-300 rounded-bl-md'}`}>
              {m.fileUrl && <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-40 object-cover" />}
              {m.text && <p className="text-sm">{m.text}</p>}
              <div className={`flex items-center gap-1.5 mt-1 ${m.fromUser ? 'justify-end' : 'justify-start'}`}>
                <span className={`text-[10px] ${m.fromUser ? 'text-white/50' : 'text-zinc-500'}`}>
                  {new Date(m.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {m.fromUser && (
                  <span className="text-[10px] text-white/50">{m.isRead ? '✓✓' : '✓'}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {waiterTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 text-zinc-400 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm italic">Официант набирает текст...</div>
          </div>
        )}
      </div>
      <div className="fixed bottom-16 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl p-3 border-t border-zinc-800">
        <div className="flex gap-2 max-w-lg mx-auto">
          {file && (
            <div className="absolute bottom-16 left-3 right-3 max-w-lg mx-auto bg-zinc-800 rounded-xl p-2 flex items-center gap-2">
              <span className="text-xs text-zinc-400 truncate flex-1">{file.name}</span>
              <button onClick={() => setFile(null)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
            </div>
          )}
          <button onClick={pickFile} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 text-zinc-400 hover:text-white"><ImageIcon size={18} /></button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !sending && send()} placeholder="Напишите сообщение..." className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none ring-1 ring-zinc-700 focus:ring-orange-500 placeholder-zinc-600" />
          <button onClick={send} disabled={sending || (!text.trim() && !file)} className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50">
            {sending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function FavoritesPage() {
  const { setGuestPage, favorites, toggleFavorite } = useApp();
  const { dishes } = useMenuData();
  const favDishes = dishes.filter((d: any) => favorites.includes(d.id));

  return (
    <div className="pb-20">
      <DodoHeader title="Избранное" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-4">
        {favDishes.length === 0 ? (
          <div className="text-center pt-16">
            <Heart size={48} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 font-semibold">В избранном пока пусто</p>
            <button onClick={() => setGuestPage('menu')} className="mt-4 bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl">В меню</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {favDishes.map(dish => (
              <DishCard key={dish.id} dish={dish} onPress={() => { useApp().setSelectedDish(dish); setGuestPage('dish'); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddressesPage() {
  const { setGuestPage } = useApp();
  const [addresses, setAddresses] = useState<SavedAddress[]>(() => {
    try { return JSON.parse(localStorage.getItem('foodchain_addresses') || '[]'); } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<SavedAddress>>({ label: 'Дом', address: '', apartment: '' });

  const save = () => {
    if (!form.address) return;
    const newAddr: SavedAddress = { id: Date.now(), label: (form.label as SavedAddress['label']) || 'Дом', address: form.address, apartment: form.apartment, isDefault: addresses.length === 0 };
    const updated = [...addresses, newAddr];
    setAddresses(updated);
    localStorage.setItem('foodchain_addresses', JSON.stringify(updated));
    setForm({ label: 'Дом', address: '', apartment: '' });
    setShowForm(false);
  };

  const remove = (id: number) => {
    const updated = addresses.filter(a => a.id !== id);
    setAddresses(updated);
    localStorage.setItem('foodchain_addresses', JSON.stringify(updated));
  };

  return (
    <div className="pb-20">
      <DodoHeader title="Мои адреса" showBack onBack={() => setGuestPage('profile')} rightAction={
        <button onClick={() => setShowForm(!showForm)} className="p-2 -mr-2 text-orange-500"><Plus size={20} /></button>
      } />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {showForm && (
          <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 space-y-3">
            <div className="flex gap-2">
              {(['Дом', 'Работа', 'Другое'] as const).map(l => (
                <button key={l} onClick={() => setForm({ ...form, label: l })} className={`flex-1 py-2 rounded-xl text-xs font-bold ${form.label === l ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>{l === 'Дом' ? '🏠' : l === 'Работа' ? '💼' : '📍'} {l}</button>
              ))}
            </div>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Улица, дом" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <input value={form.apartment || ''} onChange={e => setForm({ ...form, apartment: e.target.value })} placeholder="Квартира" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 placeholder-zinc-600" />
            <button onClick={save} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl">Сохранить</button>
          </div>
        )}
        {addresses.length === 0 && !showForm && (
          <div className="text-center pt-16">
            <MapPinned size={48} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 font-semibold">Нет сохранённых адресов</p>
          </div>
        )}
        {addresses.map(addr => (
          <div key={addr.id} className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-lg">
              {addr.label === 'Дом' ? '🏠' : addr.label === 'Работа' ? '💼' : '📍'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white">{addr.label}</span>
                {addr.isDefault && <span className="text-[10px] bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full font-bold">ОСНОВНОЙ</span>}
              </div>
              <p className="text-xs text-zinc-500 truncate">{addr.address}{addr.apartment ? `, кв ${addr.apartment}` : ''}</p>
            </div>
            <button onClick={() => remove(addr.id)} className="p-2 text-zinc-600 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CouponsPage() {
  const { setGuestPage } = useApp();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPromocodes().then(data => {
      setCoupons(Array.isArray(data) ? data : []);
    }).catch(() => setCoupons([])).finally(() => setLoading(false));
  }, []);

  const gradientColors = ['from-orange-500 to-red-500', 'from-purple-500 to-pink-500', 'from-green-500 to-emerald-500', 'from-blue-500 to-cyan-500', 'from-amber-500 to-yellow-500'];

  return (
    <div className="pb-20">
      <DodoHeader title="Купоны и акции" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {loading && <div className="text-center py-12 text-zinc-500">Загрузка...</div>}
        {!loading && coupons.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <BadgePercent size={48} className="mx-auto mb-4 opacity-30" />
            <p>Нет доступных промокодов</p>
          </div>
        )}
        {coupons.map((c: any, i: number) => {
          const discount = c.type === 'percent' ? `${c.value}%` : `${usePrice()(c.value)}`;
          const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
          return (
            <div key={c.id || i} className={`bg-gradient-to-br ${gradientColors[i % gradientColors.length]} rounded-2xl p-5 relative overflow-hidden ${isExpired ? 'opacity-50' : ''}`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mt-6 -mr-6" />
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BadgePercent size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-white">{c.code}</h3>
                  <p className="text-white/70 text-xs mt-0.5">{c.min_order ? `Мин. заказ ${usePrice()(c.min_order)}` : 'Без мин. заказа'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-lg">{c.code}</span>
                    <span className="text-white font-bold">{discount}</span>
                  </div>
                  {c.expires_at && <p className="text-white/50 text-[10px] mt-2">До {new Date(c.expires_at).toLocaleDateString('ru-RU')}</p>}
                </div>
                {isExpired && <span className="text-white/60 text-xs font-bold">ИСТЕК</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniGamePage() {
  const { setGuestPage } = useApp();
  const [boxes, setBoxes] = useState<{ id: number; x: number; y: number }[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gameRef = useRef<HTMLDivElement>(null);
  const [topScores] = useState<GameScore[]>([{ score: 15, date: '2026-06-01' }, { score: 12, date: '2026-05-28' }]);

  const dropBox = () => {
    if (gameOver) return;
    const newBox = { id: Date.now(), x: Math.random() * 80 + 10, y: 0 };
    const updated = [...boxes, newBox];
    setBoxes(updated);
    setScore(s => s + 1);
    if (updated.length > 8) { setGameOver(true); return; }
    setTimeout(() => {
      setBoxes(prev => prev.filter(b => b.id !== newBox.id));
    }, 2000);
  };

  const restart = () => {
    setBoxes([]);
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="pb-20">
      <DodoHeader title="Мини-игра" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3 ring-1 ring-zinc-800">
          <span className="text-zinc-400 text-sm font-medium">Счёт: <span className="text-white font-bold">{score}</span></span>
          <button onClick={restart} className="text-orange-500 text-sm font-bold">Заново</button>
        </div>
        <div ref={gameRef} className="bg-zinc-900 rounded-2xl h-[400px] relative overflow-hidden ring-1 ring-zinc-800" onClick={dropBox}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Gamepad2 size={48} className="text-zinc-800" />
          </div>
          {boxes.map(box => (
            <div key={box.id} className="absolute animate-bounce" style={{ left: `${box.x}%`, bottom: `${box.y}%` }}>
              <span className="text-3xl">📦</span>
            </div>
          ))}
          {gameOver && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
              <p className="text-2xl font-extrabold text-white mb-2">Игра окончена!</p>
              <p className="text-zinc-400 mb-4">Счёт: {score}</p>
              <button onClick={restart} className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl">Ещё раз</button>
            </div>
          )}
          <p className="absolute bottom-4 left-0 right-0 text-center text-zinc-600 text-xs">Тапайте, чтобы собрать коробки! 📦</p>
        </div>
        {topScores.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Рекорды</p>
            {topScores.map((s, i) => (
              <div key={i} className="flex justify-between text-sm py-1"><span className="text-zinc-400">{i + 1}. {new Date(s.date).toLocaleDateString('ru-RU')}</span><span className="text-white font-bold">{s.score}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPage() {
  const { setGuestPage } = useApp();
  const [saved, setSaved] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const guest = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
      const phone = guest.phone || '';
      const savedSettings = phone ? localStorage.getItem('foodchain_settings_' + phone) : null;
      if (savedSettings) return { ...JSON.parse(savedSettings) };
      return { name: guest.name || '', phone: guest.phone || '', email: guest.email || '', birthday: guest.birthday || '', avatar: guest.avatar || '', notificationsEnabled: true, smsEnabled: false };
    } catch { return { name: '', phone: '', email: '', birthday: '', avatar: '', notificationsEnabled: true, smsEnabled: false }; }
  });

  useEffect(() => {
    api.getMe().then(res => {
      if (res.user) {
        setSettings(prev => ({
          ...prev,
          name: res.user.name || prev.name,
          phone: res.user.phone || prev.phone,
          email: res.user.email || prev.email,
          birthday: res.user.birthday || prev.birthday,
        }));
        const guest = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
        Object.assign(guest, res.user);
        sessionStorage.setItem('foodchain_guest_user', JSON.stringify(guest));
      }
    }).catch(() => {}).finally(() => setLoadingProfile(false));
  }, []);

  const update = (key: keyof UserSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    try {
      const phone = settings.phone;
      if (phone) {
        localStorage.setItem('foodchain_settings_' + phone, JSON.stringify(settings));
      }
      try {
        const guest = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
        Object.assign(guest, settings);
        sessionStorage.setItem('foodchain_guest_user', JSON.stringify(guest));
      } catch {}
      api.updateProfile({ name: settings.name, email: settings.email, birthday: settings.birthday }).catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="pb-20">
      <DodoHeader title="Настройки" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800 space-y-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Личные данные</p>
          <div className="space-y-1">
            <p className="text-[11px] text-zinc-600 font-medium">Имя</p>
            <input value={settings.name} onChange={e => update('name', e.target.value)} className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 focus:ring-orange-500" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-zinc-600 font-medium">Телефон</p>
            <input value={settings.phone} onChange={e => update('phone', e.target.value)} className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 focus:ring-orange-500" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-zinc-600 font-medium">Email</p>
            <input value={settings.email} onChange={e => update('email', e.target.value)} className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700 focus:ring-orange-500" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-zinc-600 font-medium">Дата рождения</p>
            <input type="date" value={settings.birthday} onChange={e => update('birthday', e.target.value)} className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none ring-1 ring-zinc-700" />
          </div>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800 space-y-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Уведомления</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><Bell size={18} className="text-zinc-400" /><span className="text-sm text-white">Push-уведомления</span></div>
            <button onClick={() => update('notificationsEnabled', !settings.notificationsEnabled)} className={`w-12 h-6 rounded-full transition-colors ${settings.notificationsEnabled ? 'bg-orange-500' : 'bg-zinc-700'} relative`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings.notificationsEnabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><Smartphone size={18} className="text-zinc-400" /><span className="text-sm text-white">SMS-рассылка</span></div>
            <button onClick={() => update('smsEnabled', !settings.smsEnabled)} className={`w-12 h-6 rounded-full transition-colors ${settings.smsEnabled ? 'bg-orange-500' : 'bg-zinc-700'} relative`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings.smsEnabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
        <button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
          {saved ? '✓ Сохранено' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

function OrderChecklistPage() {
  const { setGuestPage, orders } = useApp();
  const latestOrder = orders[0];
  const steps = [
    { key: 'new', label: 'Заказ принят', time: latestOrder?.createdAt },
    { key: 'confirmed', label: 'Подтверждён', time: latestOrder?.statusHistory?.find(h => h.status === 'confirmed')?.at },
    { key: 'preparing', label: 'Готовится', time: latestOrder?.statusHistory?.find(h => h.status === 'preparing')?.at },
    { key: 'ready', label: 'Готов к выдаче', time: latestOrder?.statusHistory?.find(h => h.status === 'ready')?.at },
    { key: 'assigned', label: 'Назначен курьер', time: latestOrder?.statusHistory?.find(h => h.status === 'assigned')?.at },
    { key: 'en_route', label: 'В пути', time: latestOrder?.statusHistory?.find(h => h.status === 'en_route')?.at },
    { key: 'delivered', label: 'Доставлен', time: latestOrder?.statusHistory?.find(h => h.status === 'delivered')?.at },
  ];
  const currentIdx = steps.findIndex(s => s.key === latestOrder?.status) + 1;

  return (
    <div className="pb-20">
      <DodoHeader title="Статус заказа" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-4">
        {!latestOrder ? (
          <div className="text-center pt-16">
            <CheckCircle2 size={48} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 font-semibold">Нет активных заказов</p>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl p-5 ring-1 ring-zinc-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Package size={24} className="text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-white">Заказ #{latestOrder.id}</h3>
                <p className="text-xs text-zinc-500">{usePrice()(latestOrder.total)} • {latestOrder.address || 'Самовынос'}</p>
              </div>
            </div>
            <div className="space-y-0">
              {steps.map((step, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx - 1;
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center w-6">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${done ? 'bg-orange-500' : active ? 'bg-orange-500/30 ring-2 ring-orange-500' : 'bg-zinc-800'}`}>
                        {done ? <CheckCircle2 size={14} className="text-white" /> : active ? <Circle size={14} className="text-orange-500" /> : <Circle size={14} className="text-zinc-600" />}
                      </div>
                      {i < steps.length - 1 && <div className={`w-0.5 h-8 ${done ? 'bg-orange-500' : 'bg-zinc-800'}`} />}
                    </div>
                    <div className={`pb-6 ${done ? 'opacity-100' : active ? 'opacity-100' : 'opacity-40'}`}>
                      <p className={`text-sm font-semibold ${done || active ? 'text-white' : 'text-zinc-500'}`}>{step.label}</p>
                      {step.time && <p className="text-xs text-zinc-600">{new Date(step.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RepeatOrderPage() {
  const { setGuestPage, orders, addToCart, clearCart } = useApp();
  const { dishes } = useMenuData();
  const userOrders = orders.slice(0, 5);

  const repeatOrder = (order: typeof orders[number]) => {
    clearCart();
    order.items.forEach((item: any) => {
      const dish = dishes.find((d: any) => d.id === item.dishId);
      if (dish) addToCart(dish, item.quantity || 1);
    });
    setGuestPage('cart');
  };

  return (
    <div className="pb-20">
      <DodoHeader title="Повторить заказ" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {userOrders.length === 0 ? (
          <div className="text-center pt-16">
            <RotateCcw size={48} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 font-semibold">Нет заказов для повторения</p>
          </div>
        ) : userOrders.map(order => (
          <div key={order.id} className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-zinc-500" />
                <span className="font-bold text-white">#{order.id}</span>
                <span className="text-xs text-zinc-500">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
              <span className="font-bold text-white">{usePrice()(order.total)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {order.items.map((item, i) => (
                <span key={i} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">{item.name}</span>
              ))}
            </div>
            <button onClick={() => repeatOrder(order)} className="w-full bg-zinc-800 text-orange-500 font-bold py-2.5 rounded-xl text-sm">Повторить</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupportPage() {
  const { setGuestPage } = useApp();
  const settings = usePublicSettings();
  const phone = settings.phone || '+7 (999) 123-45-67';
  const address = settings.address || 'г. Москва, ул. Тверская, 1';
  const contactItems = [
    { icon: '📞', title: 'Телефон', desc: phone },
    { icon: '📧', title: 'Email', desc: settings.email || '-' },
    { icon: '📍', title: 'Адрес', desc: address },
  ];
  return (
    <div className="pb-20">
      <DodoHeader title="Поддержка" showBack onBack={() => setGuestPage('profile')} />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        <button onClick={() => setGuestPage('support-chat')} className="w-full bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 flex items-center gap-3 active:scale-[0.99]">
          <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center"><MessageCircle size={24} className="text-orange-500" /></div>
          <div className="flex-1 text-left"><p className="font-semibold text-white text-sm">Чат с поддержкой</p><p className="text-xs text-zinc-500">Ответим за 5 минут</p></div>
          <ChevronRight size={18} className="text-zinc-600" />
        </button>
        {contactItems.map((item, i) => (
          <div key={i} className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800 flex items-center gap-3">
            <span className="text-2xl">{item.icon}</span>
            <div><p className="font-semibold text-white text-sm">{item.title}</p><p className="text-xs text-zinc-500">{item.desc}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TRACK_LABELS: Record<string, string> = {
  new: 'Новый', confirmed: 'Принят', preparing: 'Готовится', ready: 'Готов к выдаче',
  assigned: 'Назначен курьеру', en_route: 'В пути', delivered: 'Доставлен', cancelled: 'Отменён',
};

const STATUS_STEPS = [
  { key: 'new', label: 'Новый', icon: '📝' },
  { key: 'confirmed', label: 'Принят', icon: '✅' },
  { key: 'preparing', label: 'Готовится', icon: '👨‍🍳' },
  { key: 'ready', label: 'Готов к выдаче', icon: '📦' },
  { key: 'assigned', label: 'Назначен курьер', icon: '👤' },
  { key: 'en_route', label: 'В пути', icon: '🚗' },
  { key: 'delivered', label: 'Доставлен', icon: '🎉' },
];

function CourierMapUpdater({ courierLocation }: { courierLocation: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (courierLocation) {
      map.setView([courierLocation.lat, courierLocation.lng], 14, { animate: true });
    }
  }, [courierLocation, map]);
  return null;
}

function OrderTrackingPage() {
  const { setGuestPage } = useApp();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tracking, setTracking] = useState<any>(null);
  const ordersRef = useRef<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const setOrdersIfChanged = (next: any[]) => {
    const prev = ordersRef.current;
    if (prev.length !== next.length) {
      ordersRef.current = next;
      setOrders(next);
      return;
    }
    for (let i = 0; i < prev.length; i++) {
      if (JSON.stringify(prev[i]) !== JSON.stringify(next[i])) {
        ordersRef.current = next;
        setOrders(next);
        return;
      }
    }
  };

  const order = selectedId ? orders.find(o => o.id === selectedId) : orders[0];
  const activeStepIdx = order ? ['new', 'confirmed', 'preparing', 'ready', 'assigned', 'en_route', 'delivered'].indexOf(order.status) : -1;

  const getStatusTime = (key: string) => {
    if (!order?.statusHistory) return null;
    const e = order.statusHistory.find((h: any) => h.status === key);
    if (!e) return null;
    return new Date(e.createdAt || e.at || e.created_at).toLocaleString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  const loadTracking = async (orderId: number) => {
    try {
      const data = await api.getOrderTracking(orderId);
      setTracking(data);
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    const user = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
    if (user.phone) {
      api.getOrdersTrack(user.phone).then(data => {
        if (cancelled) return;
        setOrdersIfChanged(data);
        setLoaded(true);
      }).catch(() => { if (!cancelled) setLoaded(true); });
    } else {
      setLoaded(true);
    }
    const interval = setInterval(() => {
      const u = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
      if (u.phone) api.getOrdersTrack(u.phone).then(data => setOrdersIfChanged(data)).catch(() => {});
    }, 3000);
    const unsub = api.onEvent('order:update', (o: any) => {
      setOrders(prev => {
        const exists = prev.find(x => x.id === o.id);
        const unchanged = exists && JSON.stringify(exists) === JSON.stringify(o);
        if (unchanged) return prev;
        const next = exists ? prev.map(x => x.id === o.id ? o : x) : [o, ...prev];
        ordersRef.current = next;
        return next;
      });
    });
    return () => { cancelled = true; clearInterval(interval); unsub(); };
  }, []);

  // Load tracking details when order changes
  useEffect(() => {
    if (order?.id) {
      loadTracking(order.id);
      const trackInterval = setInterval(() => loadTracking(order.id), 5000);
      return () => clearInterval(trackInterval);
    }
  }, [order?.id]);

  // WebSocket for real-time courier location with auto-reconnect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const connect = () => {
      const apiBase = localStorage.getItem('foodchain_api_url') || 'http://localhost:4000';
      const wsUrl = apiBase.replace(/^http/, 'ws');
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        if (cancelled) { ws?.close(); return; }
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'courier:location' && order?.courierId && data.courierId === order.courierId) {
            setTracking((prev: any) => prev ? { ...prev, courierLocation: { lat: data.latitude, lng: data.longitude, updatedAt: data.updatedAt } } : prev);
          }
        } catch {}
      };
      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => { ws?.close(); };
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [order?.courierId]);

  const handleOpenChat = () => {
    if (order) {
      localStorage.setItem('cgchat_order_id', String(order.id));
      setGuestPage('courier-chat');
    }
  };

  const isActiveDelivery = order && (order.status === 'assigned' || order.status === 'en_route');
  const courierLoc = tracking?.courierLocation;
  const restaurantLoc = tracking?.restaurantLocation;

  if (!loaded) {
    return (
      <div className="pb-20">
        <DodoHeader title="Мои заказы" showBack onBack={() => setGuestPage('profile')} />
        <div className="text-center pt-32 max-w-lg mx-auto">
          <span className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin inline-block" />
          <p className="text-zinc-500 mt-4 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="pb-20">
        <DodoHeader title="Мои заказы" showBack onBack={() => setGuestPage('profile')} />
        <div className="text-center pt-24 max-w-lg mx-auto">
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-4 ring-1 ring-zinc-800">
            <Truck size={36} className="text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-semibold">У вас пока нет заказов</p>
          <button onClick={() => setGuestPage('menu')} className="mt-6 bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl transition-colors">В меню</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <DodoHeader title="Мои заказы" showBack onBack={() => setGuestPage('profile')} />

      {orders.length > 1 && (
        <div className="flex gap-2 max-w-lg mx-auto px-4 pt-4 overflow-x-auto pb-2">
          {orders.map(o => (
            <button key={o.id} onClick={() => setSelectedId(o.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${(selectedId === o.id || (!selectedId && orders[0]?.id === o.id)) ? 'bg-orange-500 text-white shadow-lg' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
              #{o.id}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 pb-24">

        {/* ─── Order Card ─── */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-3xl p-6 ring-1 ring-zinc-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] text-zinc-500 mb-0.5">Заказ</p>
              <h2 className="font-extrabold text-white text-2xl tracking-tight">#{order.id}</h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">{new Date(order.createdAt || order.created_at).toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-orange-500">{usePrice()(order.total)}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{order.isPaid ? 'Оплачено' : 'Ожидает оплаты'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full font-medium">
              {order.type === 'delivery' ? 'Доставка' : order.type === 'pickup' ? 'Самовывоз' : 'В зале'}
            </span>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
              order.status === 'delivered' ? 'bg-green-900/40 text-green-400' :
              order.status === 'cancelled' ? 'bg-red-900/40 text-red-400' :
              order.status === 'en_route' || order.status === 'assigned' ? 'bg-blue-900/40 text-blue-400' :
              'bg-amber-900/40 text-amber-400'
            }`}>
              {TRACK_LABELS[order.status] || order.status}
            </span>
          </div>

          <div className="bg-zinc-800/50 rounded-2xl p-4 mb-3">
            {order.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-1 text-sm">
                <span className="text-zinc-300">{item.name} <span className="text-zinc-500">×{item.quantity}</span></span>
                <span className="text-zinc-100 font-medium">{usePrice()(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-zinc-700 mt-2 pt-2 flex justify-between text-white font-bold">
              <span>Итого</span><span className="text-orange-500">{usePrice()(order.total)}</span>
            </div>
          </div>

          {order.address && (
            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mb-2">
              <MapPin size={12} className="text-zinc-500 shrink-0" /> {order.address}
            </p>
          )}

          {order.comment && (
            <p className="text-xs text-zinc-500 italic mb-2">{order.comment}</p>
          )}
        </div>

        {/* ─── Map ─── */}
        {(isActiveDelivery || restaurantLoc) && (
          <div className="bg-zinc-900 rounded-3xl ring-1 ring-zinc-800 shadow-xl overflow-hidden" style={{ height: 240 }}>
            <MapContainer center={[55.751244, 37.618423]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} className="z-0">
              <TileLayer
                url="https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ru_RU"
                attribution="&copy; Яндекс"
              />
              <CourierMapUpdater courierLocation={courierLoc} />
              {restaurantLoc && (
                <Marker position={[restaurantLoc.lat, restaurantLoc.lng]}>
                  <Popup>Ресторан</Popup>
                </Marker>
              )}
              {courierLoc && isActiveDelivery && (
                <Marker position={[courierLoc.lat, courierLoc.lng]}>
                  <Popup>Курьер</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        )}

        {/* ─── Courier Info ─── */}
        {order.courierName && (
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-3xl p-5 ring-1 ring-zinc-800 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0">
                  {order.courierName[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{order.courierName}</p>
                  <p className="text-[10px] text-zinc-500">Ваш курьер</p>
                  {tracking?.distance && (
                    <p className="text-[10px] text-zinc-400 mt-0.5">{tracking.distance} км &middot; ~{tracking.eta} мин</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {isActiveDelivery && (
                  <button onClick={handleOpenChat} className="w-11 h-11 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-all active:scale-90">
                    <MessageCircle size={20} className="text-white" />
                  </button>
                )}
                <a href={`tel:${order.courierPhone}`} className="w-11 h-11 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-all active:scale-90">
                  <Phone size={20} className="text-white" />
                </a>
              </div>
            </div>

            {isActiveDelivery && (
              <button onClick={handleOpenChat}
                className="w-full mt-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium py-2.5 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                <MessageCircle size={16} /> Чат с курьером
              </button>
            )}

            {order.status === 'en_route' && (
              <div className="mt-3 bg-blue-900/20 rounded-xl px-4 py-2.5 text-center">
                <p className="text-xs text-blue-400 font-medium">
                  {tracking?.eta ? `Курьер будет через ~${tracking.eta} мин` : 'Курьер уже в пути!'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Status Timeline ─── */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-3xl p-6 ring-1 ring-zinc-800 shadow-xl">
          <h3 className="font-bold text-white text-sm mb-5">Статус заказа</h3>
          <div className="space-y-0">
            {STATUS_STEPS.map((step, i) => {
              const done = i < activeStepIdx;
              const active = i === activeStepIdx;
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                      done ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' :
                      active ? 'bg-orange-500 text-white ring-4 ring-orange-500/30 animate-pulse shadow-lg shadow-orange-500/20' :
                      'bg-zinc-800 text-zinc-600'
                    }`}>
                      {done ? '✓' : step.icon}
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`w-0.5 h-7 ${done ? 'bg-green-500' : active ? 'bg-orange-500' : 'bg-zinc-800'}`} />
                    )}
                  </div>
                  <div className={`pb-5 ${done || active ? 'opacity-100' : 'opacity-40'}`}>
                    <p className={`text-sm font-semibold ${done ? 'text-green-400' : active ? 'text-white' : 'text-zinc-600'}`}>
                      {step.label}
                    </p>
                    {getStatusTime(step.key) && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">{getStatusTime(step.key)}</p>
                    )}
                    {active && order.status === 'en_route' && (
                      <p className="text-[10px] text-orange-400/70 mt-0.5">Курьер уже в пути!</p>
                    )}
                    {active && order.status === 'preparing' && (
                      <p className="text-[10px] text-amber-400/70 mt-0.5">Готовим ваш заказ</p>
                    )}
                    {active && order.status === 'ready' && (
                      <p className="text-[10px] text-purple-400/70 mt-0.5">Ожидает курьера</p>
                    )}
                    {active && order.status === 'assigned' && (
                      <p className="text-[10px] text-indigo-400/70 mt-0.5">Курьер назначен</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {order.status === 'cancelled' && (
            <div className="mt-3 bg-red-500/10 rounded-2xl p-4 text-center ring-1 ring-red-500/20">
              <p className="text-red-400 font-bold text-sm">Заказ отменён</p>
            </div>
          )}

          {order.status === 'delivered' && (
            <div className="mt-3 bg-green-500/10 rounded-2xl p-4 text-center ring-1 ring-green-500/20">
              <p className="text-green-400 font-bold text-sm">Заказ доставлен!</p>
            </div>
          )}
        </div>

        {/* ─── Action Buttons ─── */}
        <div className="space-y-2">
          {order.status === 'delivered' && (
            <>
              <button onClick={() => {
                const user = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
                setGuestPage('reviews');
              }}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20">
                Оставить отзыв
              </button>
              <button onClick={() => {
                localStorage.setItem('repeat_order_items', JSON.stringify(order.items || []));
                setGuestPage('cart');
              }}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                <RotateCcw size={16} /> Повторить заказ
              </button>
            </>
          )}

          <button onClick={() => setGuestPage('support')}
            className="w-full bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 font-medium py-3 rounded-2xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            <MessageCircle size={16} /> Связаться с поддержкой
          </button>
        </div>

      </div>
    </div>
  );
}

function CourierChatPage() {
  const { setGuestPage } = useApp();
  const [messages, setMessages] = useState<any[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [chatClosed, setChatClosed] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);
  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);

  useEffect(() => {
    const orderId = Number(localStorage.getItem('cgchat_order_id') || '0');
    if (!orderId) return;
    let cancelled = false;
    const user = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
    const senderPhone = user.phone || '';
    const senderName = user.name || 'Гость';

    (async () => {
      try {
        const chats = await api.getCourierGuestChats({ order_id: orderId });
        if (cancelled) return;
        let chat = chats.find((c: any) => c.status === 'open');
        if (!chat) { chat = chats[0]; }
        if (chat) {
          setChatId(chat.id);
          setChatClosed(chat.status === 'closed');
          const msgs = await api.getCourierGuestChatMessages(chat.id);
          if (!cancelled) setMessages(msgs);
        }
      } catch (e) { console.error('CG chat init error', e); }
    })();

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const WS_URL = localStorage.getItem('foodchain_api_url')?.replace('http', 'ws')?.replace('/api', '') || 'ws://localhost:4000';
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        if (cancelled) { ws?.close(); return; }
        if (chatIdRef.current && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'subscribe:chat', chatId: chatIdRef.current }));
        }
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'cg-chat:message' && data.chatId === chatIdRef.current) {
            setMessages(prev => prev.some(x => x.id === data.message.id) ? prev : [...prev, data.message]);
          }
          if (data.type === 'cg-chat:closed' && data.data?.id === chatIdRef.current) {
            setChatClosed(true);
          }
        } catch {}
      };
      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => { ws?.close(); };
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  const sendMessage = async () => {
    if ((!text.trim() && !file) || !chatId || sending) return;
    setSending(true);
    const t = text;
    setText('');
    const f = file;
    setFile(null);
    try {
      let fileUrl = '';
      if (f) {
        const formData = new FormData();
        formData.append('file', f);
        const res = await fetch(`${localStorage.getItem('foodchain_api_url') || 'http://localhost:4000'}/api/chats/upload`, { method: 'POST', body: formData });
        const d = await res.json();
        fileUrl = d.url;
      }
      const user = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
      const saved = await api.sendCourierGuestChatMessage(chatId, {
        sender_id: 0, sender_type: 'guest', sender_name: user.name || 'Гость',
        message: t, file_url: fileUrl,
      });
      setMessages(prev => [...prev, saved]);
    } catch (e) { console.error('Send error', e); } finally { setSending(false); }
  };

  const sendLocation = () => {
    if (!navigator.geolocation || !chatId) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setSending(true);
      try {
        const locData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const user = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
        const saved = await api.sendCourierGuestChatMessage(chatId, {
          sender_id: 0, sender_type: 'guest', sender_name: user.name || 'Гость',
          message: '', file_url: '', message_type: 'location', location_data: locData,
        });
        setMessages(prev => [...prev, saved]);
      } catch {} finally { setSending(false); }
    }, () => {}, { enableHighAccuracy: true, timeout: 10000 });
  };

  return (
    <div className="pb-20">
      <DodoHeader title="Чат с курьером" showBack onBack={() => setGuestPage('order-tracking')} />
      <div ref={chatRef} className="max-w-lg mx-auto px-4 pt-4 space-y-3 overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
        {messages.length === 0 && (
          <div className="text-center pt-16 text-zinc-500">
            <MessageCircle size={40} className="mx-auto mb-3 text-zinc-700" />
            <p className="font-semibold">Напишите курьеру</p>
            <p className="text-xs mt-1">Можете уточнить детали доставки</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.senderType === 'guest' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.senderType === 'guest' ? 'bg-orange-500 text-white rounded-br-md' : 'bg-zinc-800 text-zinc-200 rounded-bl-md'}`}>
              {m.fileUrl && <img src={m.fileUrl} className="max-w-full rounded-lg mb-1 max-h-32 object-cover cursor-pointer" onClick={() => window.open(m.fileUrl, '_blank')} />}
              {m.messageType === 'location' && m.locationData ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-1"><MapPin size={16} /><span className="text-sm font-medium">Моё местоположение</span></div>
                  <p className="text-xs opacity-80">{m.locationData.lat.toFixed(6)}, {m.locationData.lng.toFixed(6)}</p>
                  <a href={`https://yandex.ru/maps/?rtext=~${m.locationData.lat},${m.locationData.lng}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline opacity-90">Построить маршрут</a>
                </div>
              ) : m.message ? <p className="text-sm whitespace-pre-wrap">{m.message}</p> : null}
              <p className={`text-[10px] mt-1 ${m.senderType === 'guest' ? 'text-white/60' : 'text-zinc-500'}`}>
                {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {chatClosed && (
          <div className="text-center py-4 text-zinc-500 text-sm">Чат закрыт. Заказ доставлен.</div>
        )}
      </div>
      {!chatClosed && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 p-3">
          <div className="max-w-lg mx-auto">
            {file && (
              <div className="mb-2 bg-zinc-900 rounded-xl p-2 flex items-center gap-2">
                <span className="text-xs text-zinc-400 truncate flex-1">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 text-zinc-400 hover:text-zinc-200">
                <ImageIcon size={18} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              <button onClick={sendLocation} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 text-zinc-400 hover:text-zinc-200" title="Геолокация">
                <MapPin size={18} />
              </button>
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !sending && sendMessage()} placeholder="Сообщение..." className="flex-1 bg-zinc-800 text-white rounded-xl px-4 py-2.5 text-sm outline-none ring-1 ring-zinc-700 focus:ring-orange-500 placeholder-zinc-500" />
              <button onClick={sendMessage} disabled={sending || (!text.trim() && !file)} className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50">
                {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
