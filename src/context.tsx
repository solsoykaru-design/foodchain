import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { CartItem, Dish, GuestPage, AdminPage, UserRole, Order, Booking, Table, PurchaseOrder, Supplier, Review, PickupPoint, PickupPointReview, OrderType, OrderStatus, RegisteredUser, ClientChatMessage, Notification, DeliveryAddress } from './types';
// Fake data removed — all data loaded from API
import { useLowStockNotification } from './useLowStockNotification';
import { changeLanguage } from './i18n';
import { setCurrency as setCurrencyGlobal } from './currency';

function applyFontSize(size: 'small' | 'medium' | 'large') {
  const sizes = { small: '14px', medium: '16px', large: '18px' };
  document.documentElement.style.setProperty('--app-font-size', sizes[size]);
  document.documentElement.style.fontSize = sizes[size];
}
import * as api from './api';

interface AppState {
  mode: 'guest' | 'admin' | 'courier'; setMode: (m: 'guest' | 'admin' | 'courier') => void;
  theme: 'light' | 'dark'; toggleTheme: () => void;
  themeId: string | null; setThemeId: (id: string) => void;
  fontSize: 'small' | 'medium' | 'large'; setFontSize: (s: 'small' | 'medium' | 'large') => void;
  language: string; setLanguage: (lang: string) => void;
  guestPage: GuestPage; setGuestPage: (p: GuestPage) => void;
  adminPage: AdminPage; setAdminPage: (p: AdminPage) => void;
  selectedBranch: number; setSelectedBranch: (b: number) => void;
  cart: CartItem[]; addToCart: (dish: Dish, quantity: number, options?: { [k: number]: number[] }) => void; removeFromCart: (dishId: number) => void; updateCartQty: (dishId: number, quantity: number) => void; clearCart: () => void; cartTotal: number;
  promoCode: string; setPromoCode: (c: string) => void; promoDiscount: number; applyPromo: () => void;
  favorites: number[]; toggleFavorite: (dishId: number) => void;
  selectedDish: Dish | null; setSelectedDish: (d: Dish | null) => void;
  orders: Order[]; updateOrderStatus: (orderId: number, status: Order['status']) => void; updateOrder: (orderId: number, data: Partial<Order>) => void; addOrder: (order: Order) => void;
  bookings: Booking[]; addBooking: (b: Booking) => void; updateBookingStatus: (id: number, status: Booking['status']) => void;
  tables: Table[]; updateTableStatus: (id: number, status: Table['status']) => void;
  adminRole: UserRole; setAdminRole: (r: UserRole) => void;
  searchQuery: string; setSearchQuery: (q: string) => void;
  menuCategoryId: number; setMenuCategoryId: (id: number) => void;
  preferredCurrency: string; setPreferredCurrency: (c: string) => void;
  reviews: Review[]; addReview: (r: Omit<Review, 'id' | 'createdAt' | 'isModerated' | 'isVisible'>) => void; approveReview: (id: number) => void; rejectReview: (id: number) => void; replyReview: (id: number, reply: string) => void;
  registeredUsers: RegisteredUser[]; registerUser: (name: string, phone: string, source: RegisteredUser['source']) => void; getNewCustomersCount: (dateFrom: string, dateTo: string) => number; updateUserBonus: (userId: number, amount: number) => void; addAddress: (userId: number, address: DeliveryAddress) => void; updateAddress: (userId: number, addressId: number, data: Partial<DeliveryAddress>) => void; deleteAddress: (userId: number, addressId: number) => void;
  clientChats: Record<number, ClientChatMessage[]>; sendMessageToClient: (userId: number, text: string) => void;
  bonusBalance: number;
  setBonusBalance: (b: number) => void;
  suppliers: Supplier[]; addSupplier: (s: Supplier) => void; updateSupplier: (id: number, data: Partial<Supplier>) => void; deleteSupplier: (id: number) => void;
  pickupPoints: PickupPoint[]; addPickupPoint: (point: PickupPoint) => void; updatePickupPoint: (id: number, data: Partial<PickupPoint>) => void; deletePickupPoint: (id: number) => void; reorderPickupPoint: (id: number, direction: 'up' | 'down') => void; togglePickupPointActive: (id: number) => void;
  pickupPointReviews: PickupPointReview[]; addPickupPointReview: (review: Omit<PickupPointReview, 'id' | 'createdAt' | 'isModerated' | 'isVisible'>) => void; approvePickupPointReview: (id: number) => void; rejectPickupPointReview: (id: number) => void; replyPickupPointReview: (id: number, reply: string) => void;
  purchaseOrders: PurchaseOrder[]; addPurchaseOrder: (po: PurchaseOrder) => void; updatePurchaseOrderStatus: (id: number, status: PurchaseOrder['status']) => void; deletePurchaseOrder: (id: number) => void;
  notifications: Notification[]; unreadCount: number; addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void; markAllRead: () => void; markRead: (id: string) => void; clearNotifications: () => void;
  tenantId: number | null;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const loadLS = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(`foodchain_${key}`); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };

  const [mode, setMode] = useState<'guest' | 'admin' | 'courier'>('guest');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const raw = localStorage.getItem('foodchain_theme');
      if (raw === 'light' || raw === 'dark') return raw;
      if (raw) { const p = JSON.parse(raw); if (p === 'light' || p === 'dark') return p; }
    } catch {}
    return 'dark';
  });
  const [themeId, setThemeIdState] = useState<string | null>(() => loadLS('themeId', 'light'));
  const [fontSize, setFontSizeState] = useState<'small' | 'medium' | 'large'>(() => { const saved = loadLS('fontSize', 'medium'); setTimeout(() => applyFontSize(saved), 0); return saved; });
  const setFontSize = useCallback((s: 'small' | 'medium' | 'large') => { setFontSizeState(s); try { localStorage.setItem('foodchain_fontSize', JSON.stringify(s)); } catch {}; applyFontSize(s); }, []);
  const [guestPage, setGuestPage] = useState<GuestPage>('home');
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard');
  const [selectedBranch, setSelectedBranch] = useState(1);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('foodchain_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [favorites, setFavorites] = useState<number[]>(() => loadLS('favorites', []));
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [ordersState, setOrders] = useState<Order[]>(() => loadLS('orders', []));
  const [bookingsState, setBookings] = useState<Booking[]>(() => loadLS('bookings', []));
  const [tablesState, setTables] = useState<Table[]>(() => loadLS('tables', []));
  const [adminRole, setAdminRole] = useState<UserRole>('superadmin');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuCategoryId, setMenuCategoryId] = useState(0);
  const [preferredCurrency, setPreferredCurrencyState] = useState(() => { try { return JSON.parse(localStorage.getItem('foodchain_currency') || '"RUB"'); } catch { return 'RUB'; } });
  const setPreferredCurrency = useCallback((c: string) => { setPreferredCurrencyState(c); setCurrencyGlobal(c); }, []);
  const [bonusBalance, setBonusBalance] = useState(() => {
    try {
      const stored = localStorage.getItem('foodchain_bonusBalance');
      return stored ? Number(stored) : 0;
    } catch { return 0; }
  });
  const [notifications, setNotifications] = useState<Notification[]>(() => loadLS('notifications', []));
  const [purchaseOrdersState, setPurchaseOrders] = useState<PurchaseOrder[]>(() => loadLS('purchaseOrders', []));
  const [suppliersState, setSuppliers] = useState<Supplier[]>(() => loadLS('suppliers', []));
  const [reviewsState, setReviews] = useState<Review[]>(() => loadLS('reviews', []));
  const [pickupPointsState, setPickupPoints] = useState<PickupPoint[]>(() => loadLS('pickupPoints', []));
  const [pickupPointReviewsState, setPickupPointReviews] = useState<PickupPointReview[]>(() => loadLS('pickupPointReviews', []));
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>(() => loadLS('registeredUsers', []));
  const [clientChats, setClientChats] = useState<Record<number, ClientChatMessage[]>>({});
  const [language, setLanguageState] = useState<string>(() => {
    try { return localStorage.getItem('i18n_lang') || 'ru'; } catch { return 'ru'; }
  });
  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    changeLanguage(lang);
    api.saveLanguage(lang);
  }, []);

  const [tenantId, setTenantId] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem('foodchain_admin_user');
      if (!raw) return null;
      const user = JSON.parse(raw);
      return user.tenantId ?? user.tenant_id ?? null;
    } catch { return null; }
  });

  useEffect(() => { try { localStorage.setItem('foodchain_registeredUsers', JSON.stringify(registeredUsers)); } catch {} }, [registeredUsers]);
  useEffect(() => { try { localStorage.setItem('foodchain_orders', JSON.stringify(ordersState)); } catch {} }, [ordersState]);
  useEffect(() => { try { localStorage.setItem('foodchain_bookings', JSON.stringify(bookingsState)); } catch {} }, [bookingsState]);
  useEffect(() => { try { localStorage.setItem('foodchain_reviews', JSON.stringify(reviewsState)); } catch {} }, [reviewsState]);
  useEffect(() => { try { localStorage.setItem('foodchain_bonusBalance', String(bonusBalance)); } catch {} }, [bonusBalance]);
  useEffect(() => { try { localStorage.setItem('foodchain_cart', JSON.stringify(cart)); } catch {} }, [cart]);
  useEffect(() => { try { localStorage.setItem('foodchain_favorites', JSON.stringify(favorites)); } catch {} }, [favorites]);
  useEffect(() => { try { localStorage.setItem('foodchain_notifications', JSON.stringify(notifications)); } catch {} }, [notifications]);
  useEffect(() => { try { localStorage.setItem('foodchain_purchaseOrders', JSON.stringify(purchaseOrdersState)); } catch {} }, [purchaseOrdersState]);

  // Initialize preferredCurrency from tenant settings
  useEffect(() => {
    import('./api').then(mod => {
      mod.getTenantSettings().then(s => {
        if (s?.base_currency) {
          setPreferredCurrency(s.base_currency);
        }
      }).catch(() => {});
    });
  }, []);
  useEffect(() => { try { localStorage.setItem('foodchain_suppliers', JSON.stringify(suppliersState)); } catch {} }, [suppliersState]);
  useEffect(() => { try { localStorage.setItem('foodchain_pickupPoints', JSON.stringify(pickupPointsState)); } catch {} }, [pickupPointsState]);
  useEffect(() => { try { localStorage.setItem('foodchain_pickupPointReviews', JSON.stringify(pickupPointReviewsState)); } catch {} }, [pickupPointReviewsState]);
  useEffect(() => { try { localStorage.setItem('foodchain_theme', JSON.stringify(theme)); } catch {} }, [theme]);
  useEffect(() => { try { localStorage.setItem('foodchain_themeId', JSON.stringify(themeId)); } catch {} }, [themeId]);

  const toggleTheme = useCallback(() => setTheme(t => t === 'light' ? 'dark' : 'light'), []);
  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    setTheme(id === 'dark' || id === 'cosmic' ? 'dark' : 'light');
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

  const applyPromo = useCallback(async () => {
    if (!promoCode.trim()) { setPromoDiscount(0); return; }
    try {
      const codes = await api.get('/api/promocodes');
      const found = (Array.isArray(codes) ? codes : []).find((c: any) => c.code === promoCode.trim().toUpperCase() && c.isActive !== false);
      if (found) {
        if (found.expires_at && new Date(found.expires_at) < new Date()) {
          setPromoDiscount(0);
          return;
        }
        if (found.min_order && cartTotal < found.min_order) {
          setPromoDiscount(0);
          return;
        }
        if (found.type === 'percent') {
          setPromoDiscount(Math.round(cartTotal * (found.value / 100)));
        } else {
          setPromoDiscount(found.value);
        }
      } else {
        setPromoDiscount(0);
      }
    } catch {
      setPromoDiscount(0);
    }
  }, [promoCode, cartTotal]);

  const toggleFavorite = useCallback((dishId: number) => setFavorites(prev => prev.includes(dishId) ? prev.filter(id => id !== dishId) : [...prev, dishId]), []);

  const addOrder = useCallback((order: Order) => {
    const withHistory: Order = { ...order, pickupCode: order.pickupCode || String(order.id).slice(-4).padStart(4, '0'), statusHistory: order.statusHistory || [{ status: order.status, at: order.createdAt || new Date().toISOString(), note: 'Заказ создан' }] };
    setOrders(prev => [withHistory, ...prev]);
  }, []);

  const updateOrderStatus = useCallback((orderId: number, status: Order['status']) => {
    const now = new Date().toISOString();
    const labels: Record<string, string> = { new: 'Новый', assigned: 'Назначен курьер', accepted: 'Принят курьером', en_route: 'В пути', delivering: 'Доставка', delivered: 'Доставлен', cancelled: 'Отменён' };
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, status, updatedAt: now, statusHistory: [...(o.statusHistory || [{ status: o.status, at: o.createdAt, note: 'Заказ создан' }]), { status, at: now, note: labels[status] }] };
    }));
    setNotifications(prev => [{ id: Math.random().toString(36).slice(2) + Date.now().toString(36), type: 'order' as const, title: `Статус заказа #${orderId}: ${labels[status]}`, body: 'Клиент получил push-уведомление', timestamp: now, isRead: false, meta: { orderId } }, ...prev].slice(0, 50));
  }, []);

  const updateOrder = useCallback((orderId: number, data: Partial<Order>) => setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...data, updatedAt: new Date().toISOString() } : o)), []);

  const addBooking = useCallback((b: Booking) => setBookings(prev => [...prev, b]), []);
  const updateBookingStatus = useCallback((id: number, status: Booking['status']) => setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b)), []);
  const updateTableStatus = useCallback((id: number, status: Table['status']) => setTables(prev => prev.map(t => t.id === id ? { ...t, status } : t)), []);

  const addReview = useCallback((r: Omit<Review, 'id' | 'createdAt' | 'isModerated' | 'isVisible'>) => {
    const newReview: Review = { ...r, id: Date.now(), createdAt: new Date().toISOString(), isModerated: false, isVisible: true };
    setReviews(prev => [newReview, ...prev]);
  }, []);
  const approveReview = useCallback((id: number) => setReviews(prev => prev.map(r => r.id === id ? { ...r, isModerated: true, isVisible: true } : r)), []);
  const rejectReview = useCallback((id: number) => setReviews(prev => prev.map(r => r.id === id ? { ...r, isModerated: true, isVisible: false } : r)), []);
  const replyReview = useCallback((id: number, reply: string) => setReviews(prev => prev.map(r => r.id === id ? { ...r, reply } : r)), []);

  const registerUser = useCallback((name: string, phone: string, source: RegisteredUser['source'], existing?: { id: number; bonusBalance?: number; totalSpent?: number; visitsCount?: number; loyaltyLevel?: string; createdAt?: string }) => {
    if (existing) {
      setRegisteredUsers(prev => {
        const found = prev.find(u => u.phone === phone);
        if (found) return prev;
        const user: RegisteredUser = { id: existing.id, name, phone, email: `${name.toLowerCase().split(' ')[0]}@mail.ru`, birthday: '1990-01-01', registeredAt: existing.createdAt || new Date().toISOString(), source, bonusBalance: existing.bonusBalance || 0, totalSpent: existing.totalSpent || 0, visitsCount: existing.visitsCount || 1, lastVisitAt: new Date().toISOString(), loyaltyLevel: (existing.loyaltyLevel as RegisteredUser['loyaltyLevel']) || 'новичок' };
        return [user, ...prev];
      });
    } else {
      const newUser: RegisteredUser = { id: Date.now() % 100000, name, phone, email: `${name.toLowerCase().split(' ')[0]}@mail.ru`, birthday: '1990-01-01', registeredAt: new Date().toISOString(), source, bonusBalance: 0, totalSpent: 0, visitsCount: 1, lastVisitAt: new Date().toISOString(), loyaltyLevel: 'новичок' };
      setRegisteredUsers(prev => [newUser, ...prev]);
    }
  }, []);

  const getNewCustomersCount = useCallback((dateFrom: string, dateTo: string) => registeredUsers.filter(u => u.registeredAt.slice(0, 10) >= dateFrom && u.registeredAt.slice(0, 10) <= dateTo).length, [registeredUsers]);
  const updateUserBonus = useCallback((userId: number, amount: number) => setRegisteredUsers(prev => prev.map(u => u.id === userId ? { ...u, bonusBalance: Math.max(0, (u.bonusBalance || 0) + amount) } : u)), []);
  const addAddress = useCallback((userId: number, address: DeliveryAddress) => setRegisteredUsers(prev => prev.map(u => {
    if (u.id !== userId) return u;
    const existing = u.addresses || [];
    const newAddr = address.isDefault ? existing.map(a => ({ ...a, isDefault: false })) : existing;
    return { ...u, addresses: [...newAddr, address] };
  })), []);
  const updateAddress = useCallback((userId: number, addressId: number, data: Partial<DeliveryAddress>) => setRegisteredUsers(prev => prev.map(u => {
    if (u.id !== userId) return u; return { ...u, addresses: (u.addresses || []).map(a => a.id === addressId ? { ...a, ...data } : a) };
  })), []);
  const deleteAddress = useCallback((userId: number, addressId: number) => setRegisteredUsers(prev => prev.map(u => {
    if (u.id !== userId) return u; return { ...u, addresses: (u.addresses || []).filter(a => a.id !== addressId) };
  })), []);

  const sendMessageToClient = useCallback((userId: number, text: string) => {
    const msg: ClientChatMessage = { id: Date.now(), fromAdmin: true, text, timestamp: new Date().toISOString(), isRead: false };
    setClientChats(prev => ({ ...prev, [userId]: [...(prev[userId] || []), msg] }));
    setTimeout(() => {
      const reply: ClientChatMessage = { id: Date.now() + 1, fromAdmin: false, text: 'Спасибо! 😊', timestamp: new Date().toISOString(), isRead: false };
      setClientChats(prev => ({ ...prev, [userId]: [...(prev[userId] || []), reply] }));
    }, 3000);
  }, []);

  const addSupplier = useCallback((s: Supplier) => setSuppliers(prev => [...prev, s]), []);
  const updateSupplier = useCallback((id: number, data: Partial<Supplier>) => setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s)), []);
  const deleteSupplier = useCallback((id: number) => setSuppliers(prev => prev.filter(s => s.id !== id)), []);

  const addPickupPoint = useCallback((point: PickupPoint) => setPickupPoints(prev => [...prev, point].sort((a, b) => a.displayOrder - b.displayOrder)), []);
  const updatePickupPoint = useCallback((id: number, data: Partial<PickupPoint>) => setPickupPoints(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p)), []);
  const deletePickupPoint = useCallback((id: number) => setPickupPoints(prev => prev.filter(p => p.id !== id)), []);
  const reorderPickupPoint = useCallback((id: number, direction: 'up' | 'down') => setPickupPoints(prev => {
    const sorted = [...prev].sort((a, b) => a.displayOrder - b.displayOrder);
    const i = sorted.findIndex(p => p.id === id); const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= sorted.length) return prev;
    const a = sorted[i], b = sorted[j]; sorted[i] = { ...b, displayOrder: a.displayOrder }; sorted[j] = { ...a, displayOrder: b.displayOrder };
    return sorted;
  }), []);
  const togglePickupPointActive = useCallback((id: number) => setPickupPoints(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive, updatedAt: new Date().toISOString() } : p)), []);

  const addPickupPointReview = useCallback((review: Omit<PickupPointReview, 'id' | 'createdAt' | 'isModerated' | 'isVisible'>) => {
    const newReview: PickupPointReview = { ...review, id: Date.now(), createdAt: new Date().toISOString(), isModerated: false, isVisible: true };
    setPickupPointReviews(prev => [newReview, ...prev]);
  }, []);
  const approvePickupPointReview = useCallback((id: number) => setPickupPointReviews(prev => prev.map(r => r.id === id ? { ...r, isModerated: true, isVisible: true } : r)), []);
  const rejectPickupPointReview = useCallback((id: number) => setPickupPointReviews(prev => prev.map(r => r.id === id ? { ...r, isModerated: true, isVisible: false } : r)), []);
  const replyPickupPointReview = useCallback((id: number, reply: string) => setPickupPointReviews(prev => prev.map(r => r.id === id ? { ...r, reply } : r)), []);

  const addPurchaseOrder = useCallback((po: PurchaseOrder) => setPurchaseOrders(prev => [po, ...prev]), []);
  const updatePurchaseOrderStatus = useCallback((id: number, status: PurchaseOrder['status']) => setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status, updatedAt: new Date().toISOString() } : po)), []);
  const deletePurchaseOrder = useCallback((id: number) => setPurchaseOrders(prev => prev.filter(po => po.id !== id)), []);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => {
    const full: Notification = { ...n, id: Math.random().toString(36).slice(2) + Date.now().toString(36), timestamp: new Date().toISOString(), isRead: false };
    setNotifications(prev => [full, ...prev].slice(0, 50));
  }, []);
  const markAllRead = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))), []);
  const markRead = useCallback((id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n)), []);
  const clearNotifications = useCallback(() => setNotifications([]), []);

  useLowStockNotification(addNotification);

  return (
    <AppContext.Provider value={{
      mode, setMode, theme, toggleTheme, themeId, setThemeId, fontSize, setFontSize, language, setLanguage, guestPage, setGuestPage, adminPage, setAdminPage,
      selectedBranch, setSelectedBranch, cart, addToCart, removeFromCart, updateCartQty, clearCart, cartTotal,
      promoCode, setPromoCode, promoDiscount, applyPromo, favorites, toggleFavorite,
      selectedDish, setSelectedDish, orders: ordersState, updateOrderStatus, updateOrder, addOrder,
      bookings: bookingsState, addBooking, updateBookingStatus, tables: tablesState, updateTableStatus,
      adminRole, setAdminRole, searchQuery, setSearchQuery, menuCategoryId, setMenuCategoryId, bonusBalance, setBonusBalance, preferredCurrency, setPreferredCurrency,
      reviews: reviewsState, addReview, approveReview, rejectReview, replyReview,
      registeredUsers, registerUser, getNewCustomersCount, updateUserBonus, addAddress, updateAddress, deleteAddress,
      clientChats, sendMessageToClient,
      suppliers: suppliersState, addSupplier, updateSupplier, deleteSupplier,
      pickupPoints: pickupPointsState, addPickupPoint, updatePickupPoint, deletePickupPoint, reorderPickupPoint, togglePickupPointActive,
      pickupPointReviews: pickupPointReviewsState, addPickupPointReview, approvePickupPointReview, rejectPickupPointReview, replyPickupPointReview,
      purchaseOrders: purchaseOrdersState, addPurchaseOrder, updatePurchaseOrderStatus, deletePurchaseOrder,
      notifications, unreadCount: notifications.filter(n => !n.isRead).length, addNotification, markAllRead, markRead, clearNotifications,
      tenantId,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
