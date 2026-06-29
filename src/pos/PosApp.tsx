import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  ShoppingCart, Trash2, Plus, Minus, Search, Settings, History, LogOut,
  Printer, CreditCard, Banknote, QrCode, Receipt, X, Sun, Moon, Maximize2,
  Clock, Users, AlertTriangle, CheckCircle, Unlock, Lock, Save, Percent,
  ClipboardList, LayoutDashboard, Star, UserPlus, FileText, Mic, BarChart3, Sparkles,
  Truck, FileSpreadsheet
} from 'lucide-react';
import * as api from '../api';
import { changeLanguage } from '../i18n';
import { useTranslation } from 'react-i18next';
import OrdersPanel from './components/OrdersPanel';
import PosHallPlan from './components/PosHallPlan';
import PosAggregatorsPanel from './components/PosAggregatorsPanel';
import PosAccountingPanel from './components/PosAccountingPanel';
import PosCrmPanel from './components/PosCrmPanel';

interface Dish {
  id: number;
  name: string;
  price: number;
  categoryId?: number;
  course?: string;
  zone?: string;
  cookTimeMinutes?: number;
}

interface Category {
  id: number;
  name: string;
}

interface PaymentMethod {
  id: number;
  key: string;
  name: string;
  icon: string;
  allowsChange: number;
  requiresTerminal: number;
  isActive: number;
}

interface PosSettings {
  orgName?: string;
  orgInn?: string;
  receiptFooter?: string;
  currencySymbol?: string;
  vatRate?: number;
  pricesIncludeVat?: boolean;
  happyHour?: {
    enabled: boolean;
    start: string;
    end: string;
    discountPercent: number;
  };
}

interface Shift {
  id: number;
  status: string;
  openedAt: string;
  closedAt?: string;
  openedByName?: string;
  closedByName?: string;
  openingBalance?: number;
  closingBalance?: number;
}

interface CartItem {
  id: string;
  dishId: number;
  categoryId?: number;
  name: string;
  price: number;
  quantity: number;
  modifiers: { id: number; name: string; price: number }[];
  comment: string;
  zone?: string;
  course?: string;
  cookTimeMinutes?: number;
  itemDiscount?: number;
  itemDiscountType?: 'percent' | 'amount';
  itemStatus?: 'hold' | 'fired' | 'ready' | 'served' | string;
}

const POS_ROLES = ['admin', 'manager', 'waiter', 'bartender'];
const SHIFT_MANAGER_ROLES = ['admin', 'manager'];
const CURRENCY = '₽';

export default function PosApp() {
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState(localStorage.getItem('fc_token') || '');
  const [user, setUser] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');

  const [shift, setShift] = useState<Shift | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [shiftEmployees, setShiftEmployees] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [openingShift, setOpeningShift] = useState(false);

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<PosSettings>({
    happyHour: { enabled: false, start: '15:00', end: '18:00', discountPercent: 10 },
    vatRate: 20,
    pricesIncludeVat: true,
  });
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'sale' | 'tables' | 'orders' | 'history' | 'settings' | 'analytics' | 'queue' | 'aggregators' | 'accounting' | 'crm'>('tables');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all' | 'fav' | 'combo'>('all');
  const [selectedCourse, setSelectedCourse] = useState<string | 'all'>('all');
  const [menuSort, setMenuSort] = useState<'default' | 'popular' | 'price_asc' | 'price_desc'>('default');
  const [search, setSearch] = useState('');
  const [isListening, setIsListening] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState<number>(1);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [orderComment, setOrderComment] = useState('');
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [showPayment, setShowPayment] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [partialAmount, setPartialAmount] = useState('');
  const [partialMethod, setPartialMethod] = useState('cash');
  const [selectedPayment, setSelectedPayment] = useState<string>('cash');
  const [dishModifiers, setDishModifiers] = useState<Record<number, any[]>>({});
  const [modifierModalDish, setModifierModalDish] = useState<Dish | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<{ id: number; name: string; price: number }[]>([]);
  const [showSplit, setShowSplit] = useState(false);
  const [splitGuests, setSplitGuests] = useState(2);
  const [splitMode, setSplitMode] = useState<'equal' | 'items' | 'amount'>('equal');
  const [splitAssignments, setSplitAssignments] = useState<Record<string, number>>({});
  const [splitAmounts, setSplitAmounts] = useState<number[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [showRemoveReason, setShowRemoveReason] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [itemToRemove, setItemToRemove] = useState<CartItem | null>(null);
  const [showCancelOrder, setShowCancelOrder] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCashDrawer, setShowCashDrawer] = useState(false);
  const [cashOps, setCashOps] = useState<any[]>([]);
  const [cashOpType, setCashOpType] = useState<'deposit' | 'withdrawal' | 'refund'>('deposit');
  const [cashOpAmount, setCashOpAmount] = useState('');
  const [cashOpNote, setCashOpNote] = useState('');
  const [selectedSplit, setSelectedSplit] = useState<any>(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [bonusToUse, setBonusToUse] = useState(0);
  const [serviceFeePercent, setServiceFeePercent] = useState(0);
  const [serviceFeeAmount, setServiceFeeAmount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [queue, setQueue] = useState<{ id: number; name: string; status: 'waiting' | 'called' | 'served'; createdAt: number }[]>([]);
  const [queueName, setQueueName] = useState('');
  const [message, setMessage] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closingBalanceInput, setClosingBalanceInput] = useState('');
  const [reviewOrder, setReviewOrder] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [favourites, setFavourites] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('fc_pos_favs') || '[]'); } catch { return []; }
  });

  const messageTimer = useRef<any>(null);
  const inactivityTimer = useRef<any>(null);
  const cartRef = useRef<CartItem[]>([]);
  const filteredDishesRef = useRef<Dish[]>([]);
  const activeTabRef = useRef<string>('sale');
  const [lockedByInactivity, setLockedByInactivity] = useState(false);
  const AUTO_LOCK_SEC = 30;
  const [showQuickSwitch, setShowQuickSwitch] = useState(false);
  const [switchPin, setSwitchPin] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const showMsg = (text: string) => {
    setMessage(text);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 3000);
  };

  const canManageShift = useMemo(() => {
    if (!user) return false;
    return SHIFT_MANAGER_ROLES.includes(String(user.role).toLowerCase());
  }, [user]);

  const loadShift = useCallback(async () => {
    try {
      const data = await api.request('/api/pos/shifts/current');
      setShift(data.shift || null);
      setOrderCount(data.orderCount || 0);
    } catch (e) { console.error('shift load error', e); }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [d, c, pm, s, t, o, cb, bk] = await Promise.all([
        api.getDishes(),
        api.getMenuCategories(),
        api.request('/api/pos/payment-methods'),
        api.request('/api/pos/settings'),
        api.getTables(),
        api.getOrdersMultiStatus(['new', 'preparing', 'ready', 'paid', 'closed']),
        api.request('/api/pos/combos'),
        api.request(`/api/bookings?date=${today}`),
      ]);
      setDishes(Array.isArray(d) ? d : []);
      setCategories(Array.isArray(c) ? c : []);
      setPaymentMethods(Array.isArray(pm) ? pm : []);
      setSettings(s || {});
      setTables(Array.isArray(t) ? t : []);
      setOrders(Array.isArray(o) ? o : []);
      setCombos(Array.isArray(cb) ? cb : []);
      setBookings(Array.isArray(bk) ? bk : []);
      // Load modifiers for dishes
      if (Array.isArray(d) && d.length > 0) {
        const mods: Record<number, any[]> = {};
        await Promise.all(d.map(async (dish: Dish) => {
          try {
            const list = await api.request(`/api/dish-modifiers/${dish.id}`);
            if (Array.isArray(list) && list.length > 0) mods[dish.id] = list;
          } catch {}
        }));
        setDishModifiers(mods);
      }
    } catch (e) { console.error('POS load error:', e); }
  }, []);

  const loadShiftEmployees = useCallback(async () => {
    if (!shift) return;
    try {
      const data = await api.request(`/api/pos/shifts/${shift.id}/employees`);
      setShiftEmployees(data.employees || []);
    } catch (e) { console.error('employees load error', e); }
  }, [shift]);

  useEffect(() => {
    if (token) {
      api.getMe().then(r => {
        setUser(r.user);
        loadShift();
        loadData();
      }).catch(() => setToken(''));
    }
  }, [token, loadShift, loadData]);

  useEffect(() => {
    if (shift && user) {
      api.request(`/api/pos/shifts/${shift.id}/login`, { method: 'POST' }).catch(() => {});
      loadShiftEmployees();
    }
  }, [shift?.id, user?.id]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const updateCount = () => {
      import('../offline-queue').then(async m => setOfflineQueueCount(await m.getQueueCount())).catch(() => {});
    };
    updateCount();
    const id = setInterval(updateCount, 5000);
    return () => clearInterval(id);
  }, []);

  // Auto-lock after inactivity
  const resetInactivityTimer = useCallback(() => {
    if (lockedByInactivity) return;
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setLockedByInactivity(true);
    }, AUTO_LOCK_SEC * 1000);
  }, [lockedByInactivity]);

  useEffect(() => {
    if (!token || !user) return;
    resetInactivityTimer();
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, resetInactivityTimer));
    return () => {
      clearTimeout(inactivityTimer.current);
      events.forEach(ev => window.removeEventListener(ev, resetInactivityTimer));
    };
  }, [token, user, resetInactivityTimer]);

  const unlockInactivity = () => {
    setLockedByInactivity(false);
    setPin('');
    setLoginError('');
  };

  // Auto-save cart to localStorage
  useEffect(() => {
    if (!token || !user) return;
    const draft = {
      cart, selectedTable, currentOrderId, customerName, orderComment,
      discountValue, discountType, serviceFeePercent, serviceFeeAmount, guestCount,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('fc_pos_draft', JSON.stringify(draft));
  }, [token, user, cart, selectedTable, currentOrderId, customerName, orderComment, discountValue, discountType, serviceFeePercent, serviceFeeAmount, guestCount]);

  // Restore cart draft
  useEffect(() => {
    if (!token || !user || draftLoaded) return;
    try {
      const raw = localStorage.getItem('fc_pos_draft');
      if (!raw) { setDraftLoaded(true); return; }
      const draft = JSON.parse(raw);
      const savedAt = draft.savedAt ? new Date(draft.savedAt) : null;
      if (savedAt && Date.now() - savedAt.getTime() > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('fc_pos_draft');
        setDraftLoaded(true);
        return;
      }
      if (draft.cart && draft.cart.length > 0) {
        setCart(draft.cart);
        setSelectedTable(draft.selectedTable || null);
        setCurrentOrderId(draft.currentOrderId || null);
        setCustomerName(draft.customerName || '');
        setOrderComment(draft.orderComment || '');
        setDiscountValue(draft.discountValue || 0);
        setDiscountType(draft.discountType || 'percent');
        setServiceFeePercent(draft.serviceFeePercent || 0);
        setServiceFeeAmount(draft.serviceFeeAmount || 0);
        setGuestCount(draft.guestCount || 1);
        showMsg('Восстановлен сохранённый чек');
      }
    } catch {}
    setDraftLoaded(true);
  }, [token, user, draftLoaded]);

  // Clear draft helper
  const clearDraft = () => localStorage.removeItem('fc_pos_draft');

  // Auth
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [pending2faToken, setPending2faToken] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoginError('');
    if (!pin.trim()) return;
    try {
      const data = await api.posAuth(pin, twoFactorCode);
      if (data.require2fa) {
        setPending2faToken(data.token);
        setLoginError('Введите код из приложения-аутентификатора');
        return;
      }
      if (data.token) {
        const role = String(data.user?.role || '').toLowerCase();
        if (!POS_ROLES.includes(role)) {
          setLoginError('Доступ запрещён. Вход только для официантов, менеджеров и администраторов.');
          return;
        }
        setToken(data.token);
        setUser(data.user);
        setPin('');
        setTwoFactorCode('');
        setPending2faToken('');
        await loadShift();
        await loadData();
      }
    } catch (e: any) {
      setLoginError(e.message || 'Ошибка входа');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('fc_token');
    setToken('');
    setUser(null);
    setShift(null);
    setCart([]);
  };

  const quickSwitch = async () => {
    setSwitchError('');
    if (!switchPin.trim()) return;
    try {
      const data = await api.posAuth(switchPin);
      if (data.token) {
        const role = String(data.user?.role || '').toLowerCase();
        if (!POS_ROLES.includes(role)) {
          setSwitchError('Доступ запрещён. Вход только для официантов, менеджеров и администраторов.');
          return;
        }
        if (data.user.id === user?.id) {
          setSwitchError('Этот сотрудник уже авторизован');
          return;
        }
        setToken(data.token);
        setUser(data.user);
        setShowQuickSwitch(false);
        setSwitchPin('');
        await loadShift();
        await loadData();
        showMsg(`Сотрудник сменён: ${data.user.username}`);
      }
    } catch (e: any) {
      setSwitchError(e.message || 'Ошибка');
    }
  };

  const openSwitch = () => {
    setSwitchPin('');
    setSwitchError('');
    setShowQuickSwitch(true);
  };

  // Shift actions
  const openShift = async () => {
    if (!canManageShift || openingShift) return;
    setLoginError('');
    setOpeningShift(true);
    try {
      const r = await api.request('/api/pos/shifts/open', {
        method: 'POST', body: JSON.stringify({ openingBalance: 0 })
      });
      setShift(r.shift);
      showMsg('Смена открыта');
      setTimeout(() => loadShift(), 500);
    } catch (e: any) {
      setLoginError(e.message || 'Ошибка открытия смены');
    } finally {
      setOpeningShift(false);
    }
  };

  const closeShift = async () => {
    if (!canManageShift || !shift) return;
    try {
      const r = await api.request(`/api/pos/shifts/${shift.id}/close`, {
        method: 'POST', body: JSON.stringify({ closingBalance: Number(closingBalanceInput) || 0 })
      });
      setShift(null);
      setShowReport(true);
      setReport(r.report);
      setClosingBalanceInput('');
      showMsg('Смена закрыта');
      loadData();
    } catch (e: any) {
      showMsg(e.message);
      setShowCloseConfirm(false);
    }
  };

  const loadXReport = async () => {
    if (!shift) return;
    try {
      const r = await api.request(`/api/pos/shifts/${shift.id}/report`);
      setReport(r.report);
      setShowReport(true);
    } catch (e: any) { showMsg(e.message); }
  };

  const loadCashOps = useCallback(async () => {
    if (!shift) return;
    try {
      const data = await api.request(`/api/pos/cash-drawer/${shift.id}`);
      setCashOps(Array.isArray(data) ? data : []);
    } catch (e: any) { showMsg(e.message); }
  }, [shift]);

  useEffect(() => {
    if (showCashDrawer) loadCashOps();
  }, [showCashDrawer, loadCashOps]);

  useEffect(() => {
    if (!clientPhone || clientPhone.length < 3) { setClientSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.request(`/api/clients?search=${encodeURIComponent(clientPhone)}&limit=5`);
        setClientSearchResults(Array.isArray(res) ? res : []);
      } catch { setClientSearchResults([]); }
    }, 400);
    return () => clearTimeout(t);
  }, [clientPhone]);

  useEffect(() => {
    if (activeTab !== 'sale') return;
    let buffer = '';
    let timer: any;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter') {
        if (buffer.length >= 5) {
          e.preventDefault();
          api.request(`/api/pos/dishes/barcode/${encodeURIComponent(buffer)}`)
            .then(dish => { if (dish?.id) addToCart(dish); else showMsg('Штрихкод не найден'); })
            .catch(() => showMsg('Штрихкод не найден'));
        }
        buffer = '';
      } else if (/^[0-9]$/.test(e.key)) {
        buffer += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buffer = ''; }, 300);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab]);

  const submitCashOp = async () => {
    if (!shift || !cashOpAmount) return;
    try {
      await api.request('/api/pos/cash-drawer', {
        method: 'POST',
        body: JSON.stringify({ shiftId: shift.id, operation: cashOpType, amount: Number(cashOpAmount), note: cashOpNote }),
      });
      showMsg('Операция записана');
      setCashOpAmount(''); setCashOpNote('');
      loadCashOps();
    } catch (e: any) { alert(e.message); }
  };

  // Cart
  const addToCart = (dish: Dish, modifiers?: { id: number; name: string; price: number }[]) => {
    const mods = modifiers || [];
    const modKey = mods.map(m => m.id).sort().join(',');
    setCart(prev => {
      const existing = prev.find(i => i.dishId === dish.id && i.modifiers.map(m => m.id).sort().join(',') === modKey);
      if (existing) {
        return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: `${dish.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, dishId: dish.id, name: dish.name, price: dish.price, quantity: 1, modifiers: mods, comment: '', zone: dish.zone, course: dish.course, cookTimeMinutes: dish.cookTimeMinutes }];
    });
  };

  const addComboToCart = (combo: any) => {
    try {
      const items = typeof combo.items === 'string' ? JSON.parse(combo.items) : combo.items;
      if (!Array.isArray(items)) return;
      items.forEach((item: any) => {
        const dish = dishes.find(d => d.id === (item.dishId || item.dish_id));
        if (dish) addToCart(dish, []);
      });
      showMsg(`Комбо "${combo.name}" добавлено`);
    } catch {}
  };

  const handleDishClick = (dish: Dish) => {
    const mods = dishModifiers[dish.id];
    if (mods && mods.length > 0) {
      setModifierModalDish(dish);
      setSelectedModifiers([]);
    } else {
      addToCart(dish);
    }
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { showMsg('Голосовой ввод не поддерживается браузером'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearch(transcript);
    };
    recognition.onerror = () => { setIsListening(false); showMsg('Ошибка голосового ввода'); };
    recognition.start();
  };

  const startVoiceOrderInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { showMsg('Голосовой ввод не поддерживается браузером'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      parseVoiceOrder(transcript);
    };
    recognition.onerror = () => { setIsListening(false); showMsg('Ошибка голосового ввода'); };
    recognition.start();
  };

  const parseVoiceOrder = (text: string) => {
    // Simple heuristic parser: look for dish names, quantities, and negative modifiers
    const added: string[] = [];
    const parts = text.split(/\s+и\s+|,\s*/);
    parts.forEach(part => {
      const negative = part.match(/без\s+(\S+)/);
      const qtyMatch = part.match(/(\d+)\s+/);
      const qty = qtyMatch ? Number(qtyMatch[1]) : 1;
      const clean = part.replace(/\d+\s+/, '').replace(/без\s+\S+/, '').trim();
      if (!clean) return;
      const match = dishes.find(d => clean.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(clean));
      if (match) {
        const mods: any[] = [];
        if (negative) {
          const modName = negative[1];
          const mod = (dishModifiers[match.id] || []).find((m: any) => m.name.toLowerCase().includes(modName));
          if (mod) mods.push({ ...mod, price: 0 });
        }
        for (let i = 0; i < qty; i++) addToCart(match, mods);
        added.push(`${qty}× ${match.name}`);
      }
    });
    if (added.length) showMsg('Добавлено: ' + added.join(', '));
    else showMsg('Не распознано: ' + text);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };
  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));
  const requestRemoveItem = (item: CartItem) => {
    setItemToRemove(item);
    setRemoveReason('');
    setShowRemoveReason(true);
  };
  const confirmRemoveItem = async () => {
    if (!itemToRemove) return;
    if (currentOrderId && removeReason) {
      try {
        await api.request(`/api/orders/${currentOrderId}/items/${itemToRemove.dishId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'removed', note: removeReason }),
        });
      } catch {}
    }
    setCart(prev => prev.filter(i => i.id !== itemToRemove.id));
    setShowRemoveReason(false);
    setItemToRemove(null);
    showMsg(`Удалено: ${itemToRemove.name}`);
    loadData();
  };

  const cancelCurrentOrder = async () => {
    if (!currentOrderId || !cancelReason.trim()) return;
    try {
      await api.request(`/api/pos/orders/${currentOrderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      showMsg(`Заказ #${currentOrderId} аннулирован`);
      clearCart();
      setShowCancelOrder(false);
      setCancelReason('');
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const repeatOrder = (order: any) => {
    if (!order || !Array.isArray(order.items)) return;
    const repeated: CartItem[] = order.items.map((item: any) => ({
      id: `${item.dishId || item.dish_id || Math.random()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dishId: item.dishId || item.dish_id,
      name: item.name,
      price: Number(item.price),
      quantity: Number(item.quantity) || 1,
      modifiers: Array.isArray(item.options)
        ? item.options.map((o: any) => typeof o === 'string' ? { id: 0, name: o, price: 0 } : o)
        : [],
      comment: item.comment || '',
      zone: item.zone,
      course: item.course,
      cookTimeMinutes: item.cookTimeMinutes,
    }));
    setCart(repeated);
    setActiveTab('sale');
    showMsg(`Заказ #${order.id} загружен для повторения`);
  };
  const toggleFavourite = (dishId: number) => {
    setFavourites(prev => {
      const next = prev.includes(dishId) ? prev.filter(id => id !== dishId) : [...prev, dishId];
      localStorage.setItem('fc_pos_favs', JSON.stringify(next));
      return next;
    });
  };
  const clearCart = () => {
    setCart([]); setSelectedTable(null); setCurrentOrderId(null); setCustomerName(''); setOrderComment(''); setDiscountValue(0);
    setServiceFeePercent(0); setServiceFeeAmount(0); setGuestCount(1); clearDraft();
  };

  const activeOrderStatuses = useMemo(() => new Set(['new', 'confirmed', 'preparing', 'ready', 'served']), []);

  const getActiveOrderForTable = useCallback((tableId: number | null) => {
    if (!tableId) return null;
    return orders.find(o => o.tableId === tableId && activeOrderStatuses.has(o.status)) || null;
  }, [orders, activeOrderStatuses]);

  const loadTableOrder = useCallback((tableId: number) => {
    const order = getActiveOrderForTable(tableId);
    if (order && Array.isArray(order.items)) {
      setCurrentOrderId(order.id);
        setCart(order.items.map((item: any) => ({
          id: item.id || `${item.dishId || item.dish_id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dishId: item.dishId || item.dish_id,
          name: item.name,
          price: Number(item.price),
          quantity: Number(item.quantity),
          modifiers: Array.isArray(item.options)
            ? item.options.map((o: any) => typeof o === 'string' ? { id: 0, name: o, price: 0 } : o)
            : [],
          comment: item.comment || '',
          zone: item.zone,
          course: item.course,
          cookTimeMinutes: item.cookTimeMinutes,
          itemStatus: item.itemStatus || null,
        })));
      setCustomerName(order.userName || '');
      setOrderComment(order.comment || '');
      setDiscountValue(Number(order.discount) || 0);
      setDiscountType(order.discountType === 'amount' ? 'amount' : 'percent');
      setGuestCount(Number(order.guestCount) || 1);
    } else {
      setCurrentOrderId(null);
      setCart([]);
      setCustomerName('');
      setOrderComment('');
      setDiscountValue(0);
      setGuestCount(1);
    }
  }, [getActiveOrderForTable]);

  const holdItem = async (item: CartItem) => {
    if (!currentOrderId) return;
    try {
      await api.request(`/api/orders/${currentOrderId}/items/${item.dishId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'hold' }),
      });
      showMsg('Позиция приостановлена');
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const fireItem = async (item: CartItem) => {
    if (!currentOrderId) return;
    try {
      await api.request(`/api/orders/${currentOrderId}/items/${item.dishId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'preparing' }),
      });
      showMsg('Позиция отправлена на кухню');
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const itemPrice = (item: CartItem): number => item.price + item.modifiers.reduce((sum, m) => sum + m.price, 0);
  const itemDiscountAmount = (item: CartItem): number => {
    if (!item.itemDiscount || item.itemDiscount <= 0) return 0;
    const base = itemPrice(item);
    if (item.itemDiscountType === 'amount') return Math.min(item.itemDiscount, base);
    return Math.round(base * (item.itemDiscount / 100) * 100) / 100;
  };
  const itemTotal = (item: CartItem) => (itemPrice(item) - itemDiscountAmount(item)) * item.quantity;
  const cartItemDiscountTotal = useMemo(() => cart.reduce((sum, item) => sum + itemDiscountAmount(item) * item.quantity, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((s, i) => s + itemPrice(i) * i.quantity, 0), [cart]);
  const afterItemDiscounts = subtotal - cartItemDiscountTotal;
  const discountAmount = useMemo(() => {
    if (discountType === 'percent') return Math.round(afterItemDiscounts * (discountValue / 100) * 100) / 100;
    return discountValue;
  }, [afterItemDiscounts, discountValue, discountType]);

  const happyHourActive = useMemo(() => {
    const hh = settings.happyHour;
    if (!hh?.enabled) return false;
    const now = new Date();
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return hm >= hh.start && hm <= hh.end;
  }, [settings.happyHour]);
  const happyHourDiscount = useMemo(() => {
    if (!happyHourActive || !settings.happyHour) return 0;
    return Math.round(afterItemDiscounts * (settings.happyHour.discountPercent / 100) * 100) / 100;
  }, [happyHourActive, afterItemDiscounts, settings.happyHour]);

  const total = Math.max(0, afterItemDiscounts - discountAmount - happyHourDiscount);
  const serviceFee = useMemo(() => {
    if (serviceFeePercent > 0) return Math.round(total * (serviceFeePercent / 100) * 100) / 100;
    return serviceFeeAmount;
  }, [total, serviceFeePercent, serviceFeeAmount]);
  const grandTotal = total + serviceFee;
  const payableTotal = Math.max(0, grandTotal - bonusToUse);

  const vatAmount = useMemo(() => {
    const rate = settings.vatRate || 0;
    if (!rate) return 0;
    const base = total + serviceFee;
    if (settings.pricesIncludeVat) return Math.round(base * rate / (100 + rate) * 100) / 100;
    return Math.round(base * rate / 100 * 100) / 100;
  }, [total, serviceFee, settings.vatRate, settings.pricesIncludeVat]);

  const filteredDishes = useMemo(() => {
    const pop: Record<number, number> = {};
    orders.forEach(o => {
      (o.items || []).forEach((i: any) => { pop[i.dishId || i.dish_id] = (pop[i.dishId || i.dish_id] || 0) + (i.quantity || 1); });
    });
    let list = dishes.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
    if (selectedCategory === 'fav') list = list.filter(d => favourites.includes(d.id));
    else if (selectedCategory === 'combo') list = [];
    else if (selectedCategory !== 'all') list = list.filter(d => d.categoryId === selectedCategory);
    if (selectedCourse !== 'all') list = list.filter(d => d.course === selectedCourse);
    if (menuSort === 'popular') list = [...list].sort((a, b) => (pop[b.id] || 0) - (pop[a.id] || 0));
    if (menuSort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    if (menuSort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [dishes, selectedCategory, selectedCourse, search, favourites, menuSort, orders]);

  const change = useMemo(() => {
    const received = parseFloat(receivedAmount) || 0;
    const pm = paymentMethods.find(p => p.key === selectedPayment);
    if (!pm || !pm.allowsChange) return 0;
    return Math.max(0, received - payableTotal);
  }, [receivedAmount, payableTotal, selectedPayment, paymentMethods]);

  const alerts = useMemo(() => {
    const list: { type: string; text: string }[] = [];
    orders.forEach(o => {
      if (o.status === 'ready') list.push({ type: 'ready', text: `Заказ #${o.id} готов к выдаче` });
      if (o.status === 'bill_requested') list.push({ type: 'bill', text: `Стол ${o.tableId}: гость просит счёт (#${o.id})` });
      if (o.status === 'preparing' && o.updatedAt) {
        const mins = (Date.now() - new Date(o.updatedAt).getTime()) / 60000;
        if (mins > 30) list.push({ type: 'long', text: `Заказ #${o.id} готовится ${Math.round(mins)} мин` });
      }
    });
    return list;
  }, [orders]);

  const upsellSuggestions = useMemo(() => {
    if (cart.length === 0 || categories.length === 0 || dishes.length === 0) return [];
    const last = cart[cart.length - 1];
    const catName = categories.find(c => c.id === last.categoryId)?.name?.toLowerCase() || '';
    let targetNames: string[] = [];
    if (catName.includes('пицц') || catName.includes('бургер') || catName.includes('ролл') || catName.includes('суши')) targetNames = ['напиток', 'десерт', 'соус'];
    else if (catName.includes('салат') || catName.includes('закуск')) targetNames = ['напиток', 'хлеб'];
    else if (catName.includes('горяч') || catName.includes('мясо')) targetNames = ['гарнир', 'напиток'];
    else targetNames = ['напиток', 'десерт'];
    const targetCatIds = categories.filter(c => targetNames.some(n => c.name?.toLowerCase().includes(n))).map(c => c.id);
    const cartDishIds = new Set(cart.map(i => i.dishId));
    return dishes.filter(d => d.categoryId != null && targetCatIds.includes(d.categoryId) && !cartDishIds.has(d.id)).slice(0, 3);
  }, [cart, categories, dishes]);

  const buildOrderPayload = useCallback(() => {
    const table = tables.find(t => t.id === selectedTable);
    return {
      user_id: user?.id || 1,
      user_name: customerName || user?.username || 'Гость',
      user_phone: '',
      address: table ? `Стол ${table.name}` : 'POS',
      table_id: table?.id || undefined,
      items: cart.map(i => ({
        dishId: i.dishId, name: i.name, price: i.price, quantity: i.quantity,
        options: i.modifiers, comment: i.comment, zone: i.zone, course: i.course, cookTimeMinutes: i.cookTimeMinutes,
        itemStatus: i.itemStatus || 'hold',
      })),
      total: grandTotal,
      subtotal: total,
      serviceFee,
      guestCount,
      payment_method: selectedPayment,
      type: 'dine_in',
      comment: orderComment,
      discount: discountAmount + cartItemDiscountTotal + happyHourDiscount,
      shift_id: shift?.id,
      handled_by: user?.id,
      handled_by_name: user?.username || user?.name,
    };
  }, [cart, customerName, user, selectedTable, tables, grandTotal, total, serviceFee, selectedPayment, orderComment, shift, discountAmount, cartItemDiscountTotal, happyHourDiscount]);

  const saveOpenOrder = async () => {
    if (cart.length === 0 || !shift) return;
    try {
      let orderId = currentOrderId;
      if (orderId) {
        await api.updateOrderItems(orderId, cart.map(i => ({
          dishId: i.dishId, name: i.name, price: i.price, quantity: i.quantity,
          options: i.modifiers, comment: i.comment, zone: i.zone, course: i.course, cookTimeMinutes: i.cookTimeMinutes,
          itemStatus: i.itemStatus || undefined,
        })));
      } else {
        const result = await api.createOrder(buildOrderPayload());
        orderId = result.id;
        setCurrentOrderId(orderId);
      }
      await api.updateOrderStatus(orderId, 'confirmed', 'Принят в POS');
      showMsg(`Заказ #${orderId} отправлен на кухню`);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const submitOrder = async () => {
    if (cart.length === 0 || !shift) return;
    try {
      let orderId = currentOrderId;
      if (orderId) {
        await api.updateOrderItems(orderId, cart.map(i => ({
          dishId: i.dishId, name: i.name, price: i.price, quantity: i.quantity,
          options: i.modifiers, comment: i.comment, zone: i.zone, course: i.course, cookTimeMinutes: i.cookTimeMinutes,
          itemStatus: i.itemStatus || undefined,
        })));
      } else {
        const result = await api.createOrder(buildOrderPayload());
        orderId = result.id;
      }

      // Bank terminal integration
      if (selectedPayment === 'terminal') {
        showMsg('Ожидание оплаты на терминале...');
        await api.request('/api/pos/terminal/pay', {
          method: 'POST',
          body: JSON.stringify({ orderId, amount: payableTotal }),
        });
      }

      await api.request('/api/pos/receipts', {
        method: 'POST',
        body: JSON.stringify({
          orderId, shiftId: shift.id, total: payableTotal,
          subtotal: total, serviceFee,
          paymentMethod: selectedPayment,
          paymentAmount: parseFloat(receivedAmount) || payableTotal,
          changeAmount: change,
        }),
      });

      // Apply bonus and finalize payment
      await api.processPayment(orderId, {
        paymentMethod: selectedPayment,
        amount: payableTotal,
        isPaid: true,
        bonusUsed: bonusToUse,
        userId: selectedClient?.id,
      });

      // Fiscalization
      try {
        await api.request(`/api/pos/fiscal/${orderId}`, { method: 'POST', body: JSON.stringify({ paymentMethod: selectedPayment }) });
      } catch (fiscalErr: any) {
        console.warn('Fiscalization skipped/error:', fiscalErr.message);
      }

      // Cash drawer auto-open for cash payments
      if (selectedPayment === 'cash') {
        try { await api.request('/api/pos/cash-drawer/open', { method: 'POST' }); } catch (e: any) { console.warn('Cash drawer open error:', e.message); }
      }
      showMsg(`Заказ #${orderId} оплачен`);
      clearCart(); setShowPayment(false); clearDraft(); setBonusToUse(0); setSelectedClient(null); setClientPhone(''); setClientSearchResults([]);
      loadShift(); loadData();
    } catch (e: any) { alert(e.message); }
  };

  const createSplitOrder = async () => {
    if (cart.length === 0 || !shift) return;
    try {
      let orderId = currentOrderId;
      if (orderId) {
        await api.updateOrderItems(orderId, cart.map(i => ({
          dishId: i.dishId, name: i.name, price: i.price, quantity: i.quantity,
          options: i.modifiers, comment: i.comment, zone: i.zone, course: i.course, cookTimeMinutes: i.cookTimeMinutes,
          itemStatus: i.itemStatus || undefined,
        })));
      } else {
        const result = await api.createOrder(buildOrderPayload());
        orderId = result.id;
        setCurrentOrderId(orderId);
      }
      await api.updateOrderStatus(orderId, 'confirmed', 'Для разделения счёта');
      return orderId;
    } catch (e: any) { alert(e.message); return null; }
  };

  const generateQrForGuest = async () => {
    if (!currentOrderId) return;
    const base = window.location.origin + window.location.pathname;
    const url = `${base}?publicPay=1&orderId=${currentOrderId}&amount=${grandTotal}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 256 });
      setQrUrl(dataUrl);
      setShowQr(true);
    } catch (e) { showMsg('Не удалось создать QR'); }
  };

  const splitOrder = async () => {
    const orderId = await createSplitOrder();
    if (!orderId) return;
    let splitsPayload: any[] = [];
    if (splitMode === 'equal') {
      const perGuest = Math.ceil(grandTotal / splitGuests * 100) / 100;
      splitsPayload = Array.from({ length: splitGuests }, (_, i) => ({
        guest_name: `Гость ${i + 1}`,
        items: cart.map(i => ({ dishId: i.dishId, name: i.name, quantity: i.quantity / splitGuests })),
        amount: i === splitGuests - 1 ? Math.max(0, grandTotal - perGuest * (splitGuests - 1)) : perGuest,
      }));
    } else if (splitMode === 'items') {
      splitsPayload = Array.from({ length: splitGuests }, (_, i) => {
        const guestItems = cart.filter(item => (splitAssignments[item.id] || 0) === i);
        const amount = guestItems.reduce((sum, item) => sum + itemTotal(item), 0);
        return {
          guest_name: `Гость ${i + 1}`,
          items: guestItems.map(i => ({ dishId: i.dishId, name: i.name, quantity: i.quantity })),
          amount,
        };
      }).filter(s => s.items.length > 0);
    } else if (splitMode === 'amount') {
      const defined = splitAmounts.slice(0, splitGuests).map(a => Number(a) || 0);
      splitsPayload = defined.map((amount, i) => ({
        guest_name: `Гость ${i + 1}`,
        items: [],
        amount,
      })).filter(s => s.amount > 0);
    }
    if (splitsPayload.length === 0) return;
    try {
      const result = await api.splitOrder(orderId, splitsPayload);
      setSplits(result.splits || []);
      setShowSplit(false);
      setShowSplitPayment(true);
      showMsg(`Заказ #${orderId} разделён`);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const paySplit = async (split: any) => {
    if (!shift) return;
    try {
      await api.payOrderSplit(split.id, selectedPayment);
      await api.request('/api/pos/receipts', {
        method: 'POST',
        body: JSON.stringify({
          orderId: currentOrderId, shiftId: shift.id, total: split.amount,
          paymentMethod: selectedPayment, paymentAmount: split.amount, changeAmount: 0,
        }),
      });
      showMsg(`Часть оплачена: ${split.guestName || split.id}`);
      const remaining = splits.filter(s => s.id !== split.id);
      setSplits(remaining);
      if (remaining.length === 0) {
        if (currentOrderId) await api.updateOrderStatus(currentOrderId, 'paid', 'Все части оплачены');
        setShowSplitPayment(false);
        clearCart();
        loadShift(); loadData();
      }
    } catch (e: any) { alert(e.message); }
  };

  const recordPartialPayment = async () => {
    if (!currentOrderId) return;
    const amount = Number(partialAmount);
    if (!amount || amount <= 0) return;
    try {
      const r = await api.request(`/api/pos/orders/${currentOrderId}/partial-pay`, {
        method: 'POST',
        body: JSON.stringify({ amount, paymentMethod: partialMethod }),
      });
      showMsg(r.remaining > 0 ? `Оплачено ${amount}₽, остаток ${r.remaining}₽` : 'Заказ полностью оплачен');
      setPartialAmount('');
      if (r.remaining <= 0.01) { clearCart(); setShowPayment(false); clearDraft(); }
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const saveSettings = async (newSettings: PosSettings) => {
    try {
      const r = await api.request('/api/pos/settings', { method: 'PUT', body: JSON.stringify(newSettings) });
      setSettings(r); showMsg('Настройки сохранены');
    } catch (e: any) { alert(e.message); }
  };

  const printReceipt = async () => {
    if (!currentOrderId) {
      // Browser fallback for not-yet-submitted cart
      const lines: string[] = [];
      lines.push(settings.orgName || 'FoodChain');
      lines.push('ИНН: ' + (settings.orgInn || '—'));
      lines.push('──────────────────────');
      lines.push(`Кассир: ${user?.username || '—'}`);
      lines.push(`Смена: #${shift?.id || '—'}`);
      lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
      lines.push('──────────────────────');
      cart.forEach(i => { lines.push(`${i.name}`); lines.push(`${i.quantity} x ${i.price} = ${i.quantity * i.price}`); });
      lines.push('──────────────────────');
      lines.push(`ИТОГО: ${grandTotal} ${settings.currencySymbol || CURRENCY}`);
      lines.push(`Оплата: ${paymentMethods.find(p => p.key === selectedPayment)?.name || selectedPayment}`);
      if (change > 0) lines.push(`Сдача: ${change}`);
      lines.push('──────────────────────');
      lines.push(settings.receiptFooter || 'Спасибо за покупку!');
      const w = window.open('', '_blank', 'width=400,height=600');
      if (w) { w.document.write(`<pre style="font-family: monospace; font-size: 12px; padding: 20px;">${lines.join('\n')}</pre>`); w.document.close(); w.print(); }
      return;
    }
    try {
      await api.request('/api/pos/print/receipt', { method: 'POST', body: JSON.stringify({ orderId: currentOrderId }) });
      showMsg('Чек отправлен на принтер');
    } catch (e: any) { showMsg(e.message); }
  };

  const printKitchenCheck = async () => {
    if (!currentOrderId) return;
    try {
      await api.request('/api/pos/print/kitchen', { method: 'POST', body: JSON.stringify({ orderId: currentOrderId, stationName: 'Кухня' }) });
      showMsg('Пречек отправлен на кухню');
    } catch (e: any) { showMsg(e.message); }
  };

  // Hotkeys
  useEffect(() => { cartRef.current = cart; filteredDishesRef.current = filteredDishes; activeTabRef.current = activeTab; }, [cart, filteredDishes, activeTab]);
  useEffect(() => {
    if (!token || !user || lockedByInactivity || showQuickSwitch) return;
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true')) {
        if (e.key === 'Escape') { (active as HTMLElement).blur(); }
        return;
      }
      if (activeTabRef.current !== 'sale') {
        if (e.key === 'Escape') setActiveTab('sale');
        return;
      }
      if (e.key === 'Escape') { clearCart(); return; }
      if (e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) { e.preventDefault(); searchInputRef.current?.focus(); return; }
      if (e.key === 'F1') { e.preventDefault(); setSelectedCategory('fav'); return; }
      if (e.key === 'F2') { e.preventDefault(); if (cartRef.current.length > 0) setShowPayment(true); return; }
      if (e.key === 'F3') { e.preventDefault(); if (cartRef.current.length > 0) setShowSplit(true); return; }
      if (e.key === 'F4') { e.preventDefault(); saveOpenOrder(); return; }
      const num = Number(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        if (e.ctrlKey) {
          const dish = filteredDishesRef.current[num - 1];
          if (dish) handleDishClick(dish);
        } else {
          const cat = categories[num - 1];
          if (cat) setSelectedCategory(cat.id);
        }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [token, user, lockedByInactivity, showQuickSwitch, categories]);

  // Login screen with numeric keypad
  if (!token || !user) {
    const appendDigit = (d: string) => setPin(prev => prev.length < 8 ? prev + d : prev);
    const removeDigit = () => setPin(prev => prev.slice(0, -1));
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'];
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-sm border border-zinc-800 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl mx-auto flex items-center justify-center font-bold text-2xl mb-4">P</div>
          <h1 className="text-xl font-bold mb-1">{t('pos_terminal')}</h1>
          <p className="text-xs text-zinc-400 mb-4">{t('pos_enter_pin')}</p>
          <div className="bg-zinc-800 rounded-xl px-4 py-3 text-white text-center text-2xl font-bold tracking-[0.3em] border border-zinc-700 mb-4 min-h-[54px]">
            {pin.replace(/./g, '•')}
          </div>
          {loginError && <p className="text-red-400 text-sm mb-4">{loginError}</p>}
          {pending2faToken && (
            <input
              value={twoFactorCode}
              onChange={e => setTwoFactorCode(e.target.value)}
              placeholder="Код 2FA"
              className={`w-full mb-4 px-3 py-2 rounded-xl border text-center tracking-[0.3em] font-bold ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}
            />
          )}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {digits.map(d => {
              if (d === 'C') return <button key={d} onClick={() => setPin('')} className="aspect-square rounded-xl bg-zinc-700 hover:bg-zinc-600 text-lg font-semibold">{d}</button>;
              if (d === '←') return <button key={d} onClick={removeDigit} className="aspect-square rounded-xl bg-zinc-700 hover:bg-zinc-600 text-lg font-semibold">{d}</button>;
              return <button key={d} onClick={() => appendDigit(d)} className="aspect-square rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-2xl font-bold">{d}</button>;
            })}
          </div>
          <button onClick={() => handleLogin()} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition">
            {t('pos_login')}
          </button>
        </div>
      </div>
    );
  }

  // Auto-lock inactivity screen
  if (lockedByInactivity) {
    const appendDigit = (d: string) => setPin(prev => prev.length < 8 ? prev + d : prev);
    const removeDigit = () => setPin(prev => prev.slice(0, -1));
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'];
    const quickUnlock = async () => {
      setLoginError('');
      if (!pin.trim()) return;
      try {
        const data = await api.posAuth(pin);
        if (data.token) {
          setPin('');
          unlockInactivity();
        } else {
          setLoginError('Неверный PIN');
        }
      } catch (e: any) {
        setLoginError(e.message || 'Ошибка');
      }
    };
    return (
      <div className="fixed inset-0 bg-zinc-950 text-white z-[100] flex items-center justify-center p-4">
        <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-sm border border-zinc-800 text-center">
          <Lock size={36} className="mx-auto text-orange-500 mb-3" />
          <h2 className="text-lg font-bold mb-1">Экран заблокирован</h2>
          <p className="text-xs text-zinc-400 mb-4">Автоблокировка после {AUTO_LOCK_SEC} сек бездействия</p>
          <div className="bg-zinc-800 rounded-xl px-4 py-3 text-white text-center text-2xl font-bold tracking-[0.3em] border border-zinc-700 mb-4 min-h-[54px]">
            {pin.replace(/./g, '•')}
          </div>
          {loginError && <p className="text-red-400 text-sm mb-4">{loginError}</p>}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {digits.map(d => {
              if (d === 'C') return <button key={d} onClick={() => setPin('')} className="aspect-square rounded-xl bg-zinc-700 hover:bg-zinc-600 text-lg font-semibold">{d}</button>;
              if (d === '←') return <button key={d} onClick={removeDigit} className="aspect-square rounded-xl bg-zinc-700 hover:bg-zinc-600 text-lg font-semibold">{d}</button>;
              return <button key={d} onClick={() => appendDigit(d)} className="aspect-square rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-2xl font-bold">{d}</button>;
            })}
          </div>
          <button onClick={quickUnlock} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition mb-2">
            Разблокировать
          </button>
          <button onClick={handleLogout} className="w-full bg-zinc-800 hover:bg-zinc-700 text-red-400 py-2 rounded-xl text-sm">
            Выйти
          </button>
        </div>
      </div>
    );
  }

  {/* Quick switch overlay */}
  {showQuickSwitch && (
    <div className="fixed inset-0 bg-zinc-950 z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-sm border border-zinc-800 text-center">
        <UserPlus size={36} className="mx-auto text-blue-400 mb-3" />
        <h2 className="text-lg font-bold mb-1">Сменить сотрудника</h2>
        <p className="text-xs text-zinc-400 mb-4">Введите PIN другого сотрудника</p>
        <div className="bg-zinc-800 rounded-xl px-4 py-3 text-white text-center text-2xl font-bold tracking-[0.3em] border border-zinc-700 mb-4 min-h-[54px]">
          {switchPin.replace(/./g, '•')}
        </div>
        {switchError && <p className="text-red-400 text-sm mb-4">{switchError}</p>}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {['1','2','3','4','5','6','7','8','9','C','0','←'].map(d => {
            if (d === 'C') return <button key={d} onClick={() => setSwitchPin('')} className="aspect-square rounded-xl bg-zinc-700 hover:bg-zinc-600 text-lg font-semibold">{d}</button>;
            if (d === '←') return <button key={d} onClick={() => setSwitchPin(prev => prev.slice(0, -1))} className="aspect-square rounded-xl bg-zinc-700 hover:bg-zinc-600 text-lg font-semibold">{d}</button>;
            return <button key={d} onClick={() => setSwitchPin(prev => prev.length < 8 ? prev + d : prev)} className="aspect-square rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-2xl font-bold">{d}</button>;
          })}
        </div>
        <button onClick={quickSwitch} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition mb-2">
          Сменить
        </button>
        <button onClick={() => { setShowQuickSwitch(false); setSwitchPin(''); setSwitchError(''); }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-xl text-sm">
          Отмена
        </button>
      </div>
    </div>
  )}

  // Shift closed / not opened screen
  if (!shift) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md border border-zinc-800 text-center">
          <Lock size={48} className="mx-auto text-orange-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">{t('pos_shift_closed')}</h2>
          <p className="text-sm text-zinc-400 mb-6">Обратитесь к менеджеру или администратору</p>
          {loginError && <p className="text-red-400 text-sm mb-4">{loginError}</p>}
          {canManageShift ? (
            <button onClick={openShift} disabled={openingShift} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition mb-3">
              {openingShift ? 'Открытие...' : t('pos_start_shift')}
            </button>
          ) : null}
          <button onClick={handleLogout} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-xl text-sm">
            Сменить сотрудника
          </button>
        </div>
      </div>
    );
  }

  const themeClass = darkMode ? 'dark bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-900';

  return (
    <div className={`min-h-screen ${themeClass} transition-colors`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} border-b px-4 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center font-bold text-white">P</div>
          <div>
            <h1 className="font-bold text-sm">{t('pos_terminal')}</h1>
            <div className="flex items-center gap-2 text-[10px] opacity-70">
              <span className="flex items-center gap-1"><Clock size={10} /> {t('pos_shift_report_modal')} #{shift.id} · {new Date(shift.openedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>·</span>
              <span>{orderCount} зак.</span>
              <span>·</span>
              <span className={`flex items-center gap-1 ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                {isOnline ? 'Онлайн' : 'Оффлайн'}
                {!isOnline && offlineQueueCount > 0 && ` (${offlineQueueCount})`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManageShift && (
            <>
              <button onClick={() => setShowCashDrawer(true)} className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-semibold rounded-lg flex items-center gap-1">
                <Banknote size={12} /> Касса
              </button>
              <button onClick={loadXReport} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-lg flex items-center gap-1">
                <FileText size={12} /> X-отчёт
              </button>
              <button onClick={() => setShowCloseConfirm(true)} className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg flex items-center gap-1">
                <Lock size={12} /> {t('pos_close_shift')}
              </button>
            </>
          )}
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-zinc-800/10">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button>
          <select value={i18n.language} onChange={e => changeLanguage(e.target.value)} className={`text-xs px-1 py-1 rounded border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}>
            <option value="ru">RU</option>
            <option value="en">EN</option>
            <option value="kk">KK</option>
          </select>
          <button onClick={openSwitch} className="p-2 rounded-lg hover:bg-zinc-800/10 text-blue-400" title={t('pos_switch_user')}><UserPlus size={16} /></button>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-zinc-800/10 text-red-400"><LogOut size={16} /></button>
        </div>
      </header>

      {message && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-xl">
          {message}
        </div>
      )}

      <main className="flex h-[calc(100vh-64px)]">
        {/* Left */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className={`flex border-b ${darkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
              {[
                { key: 'tables', label: t('pos_hall_plan'), icon: LayoutDashboard },
                { key: 'sale', label: t('pos_sale'), icon: ShoppingCart },
                { key: 'orders', label: t('pos_orders'), icon: ClipboardList },
                { key: 'queue', label: 'Очередь', icon: Clock },
                { key: 'history', label: t('pos_history'), icon: History },
                { key: 'analytics', label: 'Аналитика', icon: BarChart3 },
                { key: 'aggregators', label: 'Агрегаторы', icon: Truck },
                { key: 'accounting', label: 'Бухгалтерия', icon: FileSpreadsheet },
                { key: 'crm', label: 'CRM', icon: Users },
                { key: 'settings', label: t('pos_settings'), icon: Settings },
              ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition ${activeTab === tab.key ? (darkMode ? 'text-orange-400 border-b-2 border-orange-500 bg-zinc-800/30' : 'text-orange-600 border-b-2 border-orange-500 bg-zinc-100') : 'opacity-60 hover:opacity-100'}`}>
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'sale' && (
            <>
              <div className={`p-3 border-b ${darkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                    <input ref={searchInputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск блюда..." className={`w-full pl-9 pr-9 py-2 rounded-xl text-sm outline-none border ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300'}`} />
                    <button onClick={startVoiceSearch} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${isListening ? 'text-red-500 animate-pulse' : 'opacity-50 hover:opacity-100'}`}>
                      <Mic size={16} />
                    </button>
                  </div>
                  <button onClick={startVoiceOrderInput} title="Голосовой ввод заказа" className={`px-3 py-2 rounded-xl border text-sm font-semibold flex items-center gap-1 ${isListening ? 'bg-red-500/20 border-red-500 text-red-500' : (darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300')}`}>
                    <Mic size={16} /> Заказ
                  </button>
                  <select value={selectedTable || ''} onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    setSelectedTable(id);
                    if (id) loadTableOrder(id);
                    else { setCurrentOrderId(null); setCart([]); }
                  }} className={`px-3 py-2 rounded-xl text-sm outline-none border ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300'}`}>
                    <option value="">Без стола</option>
                    {tables.map(t => <option key={t.id} value={t.id}>Стол {t.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button onClick={() => setSelectedCategory('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCategory === 'all' ? 'bg-orange-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Все</button>
                  <button onClick={() => setSelectedCategory('fav')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 ${selectedCategory === 'fav' ? 'bg-orange-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}><Star size={10} fill={selectedCategory === 'fav' ? 'white' : 'orange'} /> Избранное</button>
                  <button onClick={() => setSelectedCategory('combo')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCategory === 'combo' ? 'bg-orange-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Комбо</button>
                  {categories.map(c => (
                    <button key={c.id} onClick={() => setSelectedCategory(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCategory === c.id ? 'bg-orange-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>{c.name}</button>
                  ))}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
                  <button onClick={() => setSelectedCourse('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCourse === 'all' ? 'bg-blue-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Все курсы</button>
                  <button onClick={() => setSelectedCourse('appetizer')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCourse === 'appetizer' ? 'bg-blue-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Закуски</button>
                  <button onClick={() => setSelectedCourse('main')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCourse === 'main' ? 'bg-blue-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Основные</button>
                  <button onClick={() => setSelectedCourse('dessert')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCourse === 'dessert' ? 'bg-blue-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Десерты</button>
                  <button onClick={() => setSelectedCourse('drink')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCourse === 'drink' ? 'bg-blue-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Напитки</button>
                  <button onClick={() => setSelectedCourse('side')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCourse === 'side' ? 'bg-blue-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Гарниры</button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
                  <button onClick={() => setMenuSort('default')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${menuSort === 'default' ? 'bg-purple-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>По умолчанию</button>
                  <button onClick={() => setMenuSort('popular')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${menuSort === 'popular' ? 'bg-purple-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>🔥 Популярное</button>
                  <button onClick={() => setMenuSort('price_asc')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${menuSort === 'price_asc' ? 'bg-purple-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Цена ↑</button>
                  <button onClick={() => setMenuSort('price_desc')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${menuSort === 'price_desc' ? 'bg-purple-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}>Цена ↓</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {selectedCategory === 'combo' ? combos.map(c => (
                    <button key={c.id} onClick={() => addComboToCart(c)} className={`p-3 rounded-xl text-left transition hover:scale-[1.02] active:scale-95 ${darkMode ? 'bg-zinc-900 border border-zinc-800 hover:border-orange-500' : 'bg-white border border-zinc-200 hover:border-orange-400'}`}>
                      <p className="text-xs font-semibold line-clamp-2">{c.name}</p>
                      <p className="text-sm font-bold text-orange-500 mt-1">{c.price}{CURRENCY}</p>
                      <p className="text-[9px] opacity-60 mt-1">{Array.isArray(c.items) ? c.items.length : JSON.parse(c.items || '[]').length} поз.</p>
                    </button>
                  )) : filteredDishes.map(d => (
                    <button key={d.id} onClick={() => handleDishClick(d)} className={`p-3 rounded-xl text-left transition hover:scale-[1.02] active:scale-95 group relative ${darkMode ? 'bg-zinc-900 border border-zinc-800 hover:border-orange-500' : 'bg-white border border-zinc-200 hover:border-orange-400'}`}>
                      <button onClick={e => { e.stopPropagation(); toggleFavourite(d.id); }} className={`absolute top-1 right-1 p-0.5 rounded ${favourites.includes(d.id) ? 'text-yellow-400' : 'text-zinc-500 opacity-0 group-hover:opacity-100'}`}>
                        <Star size={12} fill={favourites.includes(d.id) ? 'currentColor' : 'none'} />
                      </button>
                      <p className="text-xs font-semibold line-clamp-2">{d.name}</p>
                      <p className="text-sm font-bold text-orange-500 mt-1">{d.price}{CURRENCY}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'tables' && (
            <PosHallPlan
              tables={tables}
              orders={orders}
              bookings={bookings}
              darkMode={darkMode}
              onTableClick={(table: any) => {
                setSelectedTable(table.id);
                loadTableOrder(table.id);
                setActiveTab('sale');
                const active = getActiveOrderForTable(table.id);
                showMsg(active ? `Стол ${table.name}: заказ #${active.id}` : `Выбран стол ${table.name}`);
              }}
              onStatusChange={async (tableId, status) => {
                try {
                  await api.put(`/api/tables/${tableId}`, { status });
                  showMsg(`Стол ${tables.find(t => t.id === tableId)?.name || tableId}: ${status}`);
                  loadData();
                } catch (e: any) { alert(e.message); }
              }}
              onTransfer={async (fromTableId, toTableId) => {
                const order = getActiveOrderForTable(fromTableId);
                if (!order) return;
                try {
                  await api.request(`/api/pos/orders/${order.id}/transfer`, {
                    method: 'POST',
                    body: JSON.stringify({ table_id: toTableId }),
                  });
                  showMsg(`Заказ #${order.id} перенесён на стол ${tables.find(t => t.id === toTableId)?.name || toTableId}`);
                  loadData();
                } catch (e: any) { alert(e.message); }
              }}
              onMerge={async (fromOrderId, toOrderId) => {
                try {
                  await api.request('/api/orders/merge', {
                    method: 'POST',
                    body: JSON.stringify({ orderIds: [fromOrderId, toOrderId] }),
                  });
                  showMsg(`Заказы #${fromOrderId} и #${toOrderId} объединены`);
                  loadData();
                } catch (e: any) { alert(e.message); }
              }}
              onBook={async (tableId, data) => {
                try {
                  await api.request('/api/bookings', {
                    method: 'POST',
                    body: JSON.stringify({ ...data, table_id: tableId }),
                  });
                  showMsg('Бронь создана');
                  loadData();
                } catch (e: any) { alert(e.message); }
              }}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersPanel darkMode={darkMode} shiftId={shift.id} user={user} onMessage={showMsg} />
          )}

          {activeTab === 'queue' && (
            <div className="flex-1 overflow-y-auto p-4">
              <h2 className="font-bold mb-3">Электронная очередь</h2>
              <div className="flex gap-2 mb-4">
                <input value={queueName} onChange={e => setQueueName(e.target.value)} placeholder="Имя гостя / номер" className={`flex-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300'}`} />
                <button onClick={() => { if (!queueName.trim()) return; setQueue(prev => [...prev, { id: Date.now(), name: queueName, status: 'waiting', createdAt: Date.now() }]); setQueueName(''); }} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-semibold text-sm">Добавить</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {queue.filter(q => q.status !== 'served').map(q => (
                  <div key={q.id} className={`p-3 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold">#{q.id.toString().slice(-4)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${q.status === 'called' ? 'bg-green-600 text-white' : 'bg-zinc-600 text-white'}`}>{q.status === 'called' ? 'Вызван' : 'Ожидает'}</span>
                    </div>
                    <p className="text-sm mt-1">{q.name}</p>
                    <div className="flex gap-2 mt-2">
                      {q.status === 'waiting' && <button onClick={() => setQueue(prev => prev.map(item => item.id === q.id ? { ...item, status: 'called' } : item))} className="flex-1 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold">Вызвать</button>}
                      <button onClick={() => setQueue(prev => prev.map(item => item.id === q.id ? { ...item, status: 'served' } : item))} className="flex-1 py-1.5 rounded bg-zinc-600 text-white text-xs font-semibold">Готово</button>
                    </div>
                  </div>
                ))}
              </div>
              {queue.filter(q => q.status !== 'served').length === 0 && <p className="text-center opacity-50 py-10">Очередь пуста</p>}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4">
              <h2 className="font-bold mb-3">История заказов</h2>
              <div className="space-y-2">
                {orders.map(o => (
                  <div key={o.id} className={`p-3 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                    <div className="flex justify-between items-center"><span className="font-bold">#{o.id}</span><span className="text-sm font-bold">{o.total}{CURRENCY}</span></div>
                    <p className="text-xs opacity-60">{o.userName || o.handledByName} · {new Date(o.createdAt).toLocaleString('ru-RU')}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs opacity-60">{o.items?.length || 0} поз. · {o.status}</p>
                      <div className="flex gap-1">
                        <button onClick={() => repeatOrder(o)} className="text-[10px] px-2 py-1 rounded bg-orange-600 text-white font-semibold">Повторить</button>
                        {(o.status === 'paid' || o.status === 'closed') && (
                          <button onClick={() => { setReviewOrder(o); setReviewRating(5); setReviewText(''); }} className="text-[10px] px-2 py-1 rounded bg-blue-600 text-white font-semibold">Отзыв</button>
                        )}
                      </div>
                    </div>
                    {(o.status === 'paid' || o.status === 'closed') && (
                      <div className="mt-2 pt-2 border-t border-zinc-700/30">
                        <WaiterRating order={o} onRate={async (rating, review) => {
                          await api.request(`/api/pos/orders/${o.id}/rating`, { method: 'PUT', body: JSON.stringify({ waiterRating: rating, waiterReview: review }) });
                          showMsg('Оценка сохранена');
                          loadData();
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="flex-1 overflow-y-auto p-4">
              <h2 className="font-bold mb-3">Аналитика</h2>
              <PosAnalyticsPanel orders={orders} darkMode={darkMode} />
            </div>
          )}

          {activeTab === 'aggregators' && (
            <PosAggregatorsPanel darkMode={darkMode} />
          )}

          {activeTab === 'accounting' && (
            <PosAccountingPanel shift={shift} darkMode={darkMode} />
          )}

          {activeTab === 'crm' && (
            <PosCrmPanel darkMode={darkMode} />
          )}

          {activeTab === 'settings' && (
            <PosSettingsPanel settings={settings} onSave={saveSettings} darkMode={darkMode} />
          )}
        </div>

        {/* Right cart */}
        <div className={`w-[380px] flex flex-col border-l ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
          <div className="p-4 border-b border-zinc-800/20">
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2"><ShoppingCart size={18} /> {t('pos_cart')}</h2>
              <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
                <span>{selectedTable ? `Стол ${tables.find(t => t.id === selectedTable)?.name || selectedTable}` : 'Без стола'}{currentOrderId ? ` · #${currentOrderId}` : ''}</span>
                {selectedTable && (
                  <span className="flex items-center gap-1">
                    <Users size={10} />
                    <input type="number" min={1} max={50} value={guestCount} onChange={e => setGuestCount(Math.max(1, Number(e.target.value)))} className={`w-8 text-center text-[10px] px-0.5 py-0.5 rounded border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {currentOrderId && <CoursePanel cart={cart} onFireCourse={async (course) => {
              const items = cart.filter(i => i.course === course && (i as any).itemStatus === 'hold');
              for (const item of items) {
                await api.request(`/api/orders/${currentOrderId}/items/${item.dishId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'preparing' }) });
              }
              showMsg(`Курс «${course}» отправлен на кухню`);
              loadData();
            }} />}
            {cart.length === 0 ? <p className="text-center opacity-50 py-10 text-sm">{t('pos_add_dishes')}</p> : cart.map(item => {
              const itemStatus = (item as any).itemStatus;
              const statusColor = itemStatus === 'hold' ? 'border-yellow-500' : itemStatus === 'preparing' ? 'border-blue-500' : itemStatus === 'ready' ? 'border-green-500' : '';
              const statusLabel = itemStatus === 'hold' ? '⏸ Приостановлено' : itemStatus === 'preparing' ? '🔥 Готовится' : itemStatus === 'ready' ? '✓ Готово' : '';
              return (
                <div key={item.id} className={`p-3 rounded-xl border-2 ${statusColor || (darkMode ? 'border-zinc-700' : 'border-zinc-200')} ${darkMode ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm">{item.name}</span>
                    <div className="text-right">
                      <span className="font-bold text-sm">{itemTotal(item)}{CURRENCY}</span>
                      {item.itemDiscount && item.itemDiscount > 0 && <div className="text-[10px] text-red-400 line-through">{itemPrice(item) * item.quantity}{CURRENCY}</div>}
                    </div>
                  </div>
                  {item.modifiers.length > 0 && (
                    <div className="text-[10px] opacity-70 mt-0.5">
                      {item.modifiers.map(m => `${m.name} +${m.price}₽`).join(', ')}
                    </div>
                  )}
                  {statusLabel && <div className="text-[10px] font-semibold mt-1">{statusLabel}</div>}
                  <div className="flex items-center gap-1 mt-1">
                    <button onClick={() => {
                      setCart(prev => prev.map(i => i.id === item.id ? { ...i, itemDiscount: i.itemDiscount && i.itemDiscount > 0 ? 0 : 10, itemDiscountType: 'percent' as const } : i));
                    }} className="text-[10px] px-1.5 py-0.5 rounded border text-red-400 border-red-400/30 hover:bg-red-400/10">-10%</button>
                    <button onClick={() => {
                      setCart(prev => prev.map(i => i.id === item.id ? { ...i, itemDiscount: i.itemDiscount && i.itemDiscount > 0 ? 0 : 20, itemDiscountType: 'percent' as const } : i));
                    }} className="text-[10px] px-1.5 py-0.5 rounded border text-red-400 border-red-400/30 hover:bg-red-400/10">-20%</button>
                    {(item.itemDiscount && item.itemDiscount > 0) && (
                      <input type="number" value={item.itemDiscount} onChange={e => {
                        const v = Number(e.target.value);
                        setCart(prev => prev.map(i => i.id === item.id ? { ...i, itemDiscount: Math.max(0, v) } : i));
                      }} className={`w-12 text-[10px] text-center px-1 py-0.5 rounded border ${darkMode ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-zinc-300'}`} />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-lg bg-zinc-700 text-white flex items-center justify-center"><Minus size={14} /></button>
                      <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-lg bg-zinc-700 text-white flex items-center justify-center"><Plus size={14} /></button>
                    </div>
                    <div className="flex items-center gap-1">
                      {currentOrderId && (
                        <>
                          <button onClick={() => holdItem(item)} className="text-yellow-400 p-1 text-xs" title="Приостановить">⏸</button>
                          <button onClick={() => fireItem(item)} className="text-blue-400 p-1 text-xs" title="На кухню">🔥</button>
                        </>
                      )}
                      <button onClick={() => requestRemoveItem(item)} className="text-red-400 p-1"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {upsellSuggestions.length > 0 && (
              <div className={`p-3 rounded-xl border ${darkMode ? 'bg-zinc-800/70 border-orange-500/30' : 'bg-orange-50 border-orange-200'}`}>
                <p className="text-xs font-bold mb-2 flex items-center gap-1"><Sparkles size={12} /> Добавьте к заказу</p>
                <div className="flex gap-2 overflow-x-auto">
                  {upsellSuggestions.map(d => (
                    <button key={d.id} onClick={() => addToCart(d)} className="flex-shrink-0 text-left p-2 rounded-lg border text-xs min-w-[100px] hover:opacity-80 transition-opacity" style={{ background: darkMode ? '#27272a' : '#fff', borderColor: darkMode ? '#3f3f46' : '#e4e4e7' }}>
                      <div className="font-semibold truncate">{d.name}</div>
                      <div className="opacity-70">{d.price}{CURRENCY}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className={`p-4 border-t ${darkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <div className="flex gap-2 mb-3">
              <select value={discountType} onChange={e => setDiscountType(e.target.value as any)} className={`text-xs px-2 py-1 rounded-lg border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}>
                <option value="percent">%</option><option value="amount">₽</option>
              </select>
              <input type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} placeholder="Скидка" className={`flex-1 text-xs px-2 py-1 rounded-lg border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            </div>
            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between opacity-70"><span>Сумма</span><span>{subtotal}{CURRENCY}</span></div>
              {cartItemDiscountTotal > 0 && <div className="flex justify-between text-red-400"><span>Скидка на блюда</span><span>-{cartItemDiscountTotal}{CURRENCY}</span></div>}
              {discountAmount > 0 && <div className="flex justify-between text-red-400"><span>Скидка на чек</span><span>-{discountAmount}{CURRENCY}</span></div>}
              {happyHourActive && <div className="flex justify-between text-orange-400"><span>Happy Hour (-{settings.happyHour?.discountPercent}%)</span><span>-{happyHourDiscount}{CURRENCY}</span></div>}
              <div className="flex justify-between font-bold"><span>Сумма</span><span>{total}{CURRENCY}</span></div>
              <div className="flex gap-1 mt-1">
                <select value={serviceFeePercent > 0 ? 'percent' : 'amount'} onChange={e => { if (e.target.value === 'percent') { setServiceFeeAmount(0); setServiceFeePercent(10); } else { setServiceFeePercent(0); setServiceFeeAmount(Math.round(total * 0.1)); }}} className={`text-[10px] px-1 py-0.5 rounded border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}>
                  <option value="percent">%</option><option value="amount">₽</option>
                </select>
                <input type="number" value={serviceFeePercent > 0 ? serviceFeePercent : serviceFeeAmount} onChange={e => { const v = Number(e.target.value); if (serviceFeePercent > 0) setServiceFeePercent(v); else setServiceFeeAmount(v); }} placeholder="Чаевые" className={`flex-1 text-xs px-2 py-0.5 rounded border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
              </div>
              {serviceFee > 0 && <div className="flex justify-between text-green-400"><span>Сервисный сбор</span><span>+{serviceFee}{CURRENCY}</span></div>}
              {settings.vatRate ? <div className="flex justify-between text-blue-400 text-xs"><span>НДС {settings.vatRate}% {settings.pricesIncludeVat ? '(в т.ч.)' : '(начислен)'}</span><span>{vatAmount}{CURRENCY}</span></div> : null}
              <div className="flex justify-between text-xl font-bold"><span>ИТОГО</span><span>{grandTotal}{CURRENCY}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={clearCart} className="py-3 rounded-xl bg-zinc-700 text-white text-sm font-semibold">{t('pos_clear')}</button>
              <button onClick={saveOpenOrder} disabled={cart.length === 0} className="py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-bold">{t('pos_to_kitchen')}</button>
              <button onClick={() => setShowSplit(true)} disabled={cart.length === 0} className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold">{t('pos_split')}</button>
              <button onClick={() => setShowPayment(true)} disabled={cart.length === 0} className="py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold">{t('pos_pay')}</button>
            </div>
            {currentOrderId && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={printKitchenCheck} className="py-2 rounded-xl bg-zinc-700 text-white text-xs font-semibold">Пречек на кухню</button>
                <button onClick={() => setShowCancelOrder(true)} className="py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-bold">Аннулировать #{currentOrderId}</button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modifier selection modal */}
      {modifierModalDish && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{modifierModalDish.name}</h2>
              <button onClick={() => setModifierModalDish(null)}><X size={20} /></button>
            </div>
            <p className="text-sm opacity-70 mb-3">Выберите модификаторы:</p>
            <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto">
              {dishModifiers[modifierModalDish.id]?.map((m: any) => {
                const selected = selectedModifiers.some(sm => sm.id === m.modifierId);
                return (
                  <button key={m.id} onClick={() => {
                    setSelectedModifiers(prev => selected ? prev.filter(sm => sm.id !== m.modifierId) : [...prev, { id: m.modifierId, name: m.modifierName, price: m.modifierPrice || 0 }]);
                  }} className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${selected ? 'bg-orange-600 text-white border-orange-600' : (darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300')}`}>
                    <span className="font-medium">{m.modifierName}</span>
                    <span className="font-bold">+{m.modifierPrice || 0}{CURRENCY}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModifierModalDish(null)} className="flex-1 py-3 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Отмена</button>
              <button onClick={() => { addToCart(modifierModalDish, selectedModifiers); setModifierModalDish(null); }} className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold">Добавить</button>
            </div>
          </div>
        </div>
      )}

      {/* Split bill modal */}
      {showSplit && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Разделить счёт</h2><button onClick={() => setShowSplit(false)}><X size={20} /></button></div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['equal', 'items', 'amount'] as const).map(m => (
                <button key={m} onClick={() => setSplitMode(m)} className={`py-2 rounded-xl text-xs font-bold border ${splitMode === m ? 'bg-blue-600 text-white border-blue-600' : (darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300')}`}>
                  {m === 'equal' ? 'Поровну' : m === 'items' ? 'По позициям' : 'По суммам'}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mb-4">
              <button onClick={() => setSplitGuests(Math.max(2, splitGuests - 1))} className="w-10 h-10 rounded-xl bg-zinc-700 text-white font-bold">-</button>
              <span className="text-2xl font-bold w-12 text-center">{splitGuests}</span>
              <button onClick={() => setSplitGuests(Math.min(20, splitGuests + 1))} className="w-10 h-10 rounded-xl bg-zinc-700 text-white font-bold">+</button>
            </div>
            {splitMode === 'equal' && (
              <p className="text-center text-sm mb-4">С каждого: <b>{(grandTotal / splitGuests).toFixed(2)}{CURRENCY}</b></p>
            )}
            {splitMode === 'items' && (
              <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
                <p className="text-xs opacity-70">Выберите гостя для каждой позиции:</p>
                {cart.map(item => (
                  <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg text-sm ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                    <span className="truncate flex-1">{item.name} ×{item.quantity}</span>
                    <select value={splitAssignments[item.id] || 0} onChange={e => setSplitAssignments(prev => ({ ...prev, [item.id]: Number(e.target.value) }))} className={`ml-2 text-xs px-2 py-1 rounded border ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300'}`}>
                      {Array.from({ length: splitGuests }, (_, i) => <option key={i} value={i}>Гость {i + 1}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
            {splitMode === 'amount' && (
              <div className="space-y-2 mb-4">
                <p className="text-xs opacity-70">Укажите суммы:</p>
                {Array.from({ length: splitGuests }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm w-20">Гость {i + 1}</span>
                    <input type="number" value={splitAmounts[i] || ''} onChange={e => setSplitAmounts(prev => { const next = [...prev]; next[i] = Number(e.target.value); return next; })} className={`flex-1 px-3 py-1.5 rounded-xl border text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowSplit(false)} className="flex-1 py-3 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Отмена</button>
              <button onClick={splitOrder} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold">Разделить</button>
            </div>
          </div>
        </div>
      )}

      {/* Split payment modal */}
      {showSplitPayment && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Оплата по частям</h2><button onClick={() => setShowSplitPayment(false)}><X size={20} /></button></div>
            <div className="space-y-2 mb-4">
              {splits.map(split => (
                <div key={split.id} className={`flex items-center justify-between p-3 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}>
                  <div>
                    <span className="font-semibold">{split.guestName || `Гость`}</span>
                    <span className="text-sm opacity-70 ml-2">{split.amount}{CURRENCY}</span>
                  </div>
                  <button onClick={() => paySplit(split)} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg">Оплатить</button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {paymentMethods.filter(p => p.isActive).map(pm => (
                <button key={pm.id} onClick={() => setSelectedPayment(pm.key)} className={`p-3 rounded-xl border text-sm font-semibold transition ${selectedPayment === pm.key ? 'bg-orange-600 text-white border-orange-600' : (darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300')}`}>{pm.name}</button>
              ))}
            </div>
            <button onClick={() => setShowSplitPayment(false)} className="w-full py-3 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Закрыть</button>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Оплата</h2><button onClick={() => setShowPayment(false)}><X size={20} /></button></div>
            <p className="text-3xl font-bold text-center mb-2">{payableTotal}{CURRENCY}</p>
            {bonusToUse > 0 && <p className="text-center text-xs text-green-500 mb-2">С учётом {bonusToUse}{CURRENCY} бонусов</p>}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {paymentMethods.filter(p => p.isActive).map(pm => (
                <button key={pm.id} onClick={() => setSelectedPayment(pm.key)} className={`p-3 rounded-xl border text-sm font-semibold transition ${selectedPayment === pm.key ? 'bg-orange-600 text-white border-orange-600' : (darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300')}`}>{pm.name}</button>
              ))}
            </div>
            {paymentMethods.find(p => p.key === selectedPayment)?.allowsChange ? (
              <div className="mb-4">
                <label className="text-xs opacity-70">Получено</label>
                <input type="number" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} className={`w-full mt-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
                {change > 0 && <p className="text-sm text-green-500 mt-1">Сдача: {change}{CURRENCY}</p>}
              </div>
            ) : null}
            <div className={`p-3 rounded-xl border mb-4 ${darkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
              <p className="text-xs font-bold mb-2">Бонусы и клиент</p>
              <input type="text" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Телефон клиента" className={`w-full px-3 py-2 rounded-xl border text-sm mb-2 ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
              {clientSearchResults.length > 0 && (
                <div className={`max-h-28 overflow-y-auto rounded-xl border mb-2 ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'}`}>
                  {clientSearchResults.map((c: any) => (
                    <button key={c.id} onClick={() => { setSelectedClient(c); setClientPhone(c.phone || ''); setClientSearchResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-700/20">
                      {c.name || 'Гость'} · {c.phone || '—'} · бонусов {c.bonusBalance || 0}{CURRENCY}
                    </button>
                  ))}
                </div>
              )}
              {selectedClient && (
                <div className="text-xs mb-2 opacity-80">{selectedClient.name} · бонусов {selectedClient.bonusBalance || 0}{CURRENCY}</div>
              )}
              <div className="flex gap-2">
                <input type="number" value={bonusToUse || ''} onChange={e => setBonusToUse(Math.min(Number(e.target.value), selectedClient?.bonusBalance || 0, grandTotal))} placeholder="Списать бонусов" className={`flex-1 px-3 py-2 rounded-xl border text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
                <button onClick={() => setBonusToUse(Math.min(selectedClient?.bonusBalance || 0, grandTotal))} className="px-3 py-2 rounded-xl bg-zinc-700 text-white text-xs font-semibold">Макс</button>
              </div>
            </div>
            <div className={`p-3 rounded-xl border mb-4 ${darkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
              <p className="text-xs font-bold mb-2">Частичная оплата</p>
              <div className="flex gap-2 mb-2">
                <input type="number" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="Сумма" className={`flex-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
                <select value={partialMethod} onChange={e => setPartialMethod(e.target.value)} className={`px-2 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}>
                  {paymentMethods.filter(p => p.isActive).map(pm => <option key={pm.id} value={pm.key}>{pm.name}</option>)}
                </select>
              </div>
              <button onClick={recordPartialPayment} disabled={!currentOrderId || !partialAmount} className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold">Записать частичный платёж</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={printReceipt} className="flex-1 min-w-[80px] py-3 rounded-xl bg-zinc-700 text-white text-sm font-semibold flex items-center justify-center gap-2"><Printer size={16} /> Чек</button>
              <button onClick={generateQrForGuest} disabled={!currentOrderId} className="flex-1 min-w-[100px] py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2"><QrCode size={16} /> QR гостю</button>
              <button onClick={submitOrder} className="flex-1 min-w-[100px] py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold">Подтвердить</button>
            </div>
          </div>
        </div>
      )}

      {showQr && qrUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowQr(false)}>
          <div className={`w-full max-w-sm rounded-2xl p-5 text-center ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2">Оплатите по QR</h2>
            <p className="text-sm opacity-70 mb-3">Отсканируйте камерой телефона</p>
            <img src={qrUrl} alt="QR" className="w-56 h-56 mx-auto rounded-xl border border-zinc-300" />
            <p className="text-xl font-bold mt-3">{grandTotal}{CURRENCY}</p>
            <button onClick={() => setShowQr(false)} className="mt-4 w-full py-2.5 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Закрыть</button>
          </div>
        </div>
      )}

      {/* Remove item with reason */}
      {showRemoveReason && itemToRemove && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex items-center gap-3 mb-4 text-red-400"><Trash2 size={24} /><h2 className="text-lg font-bold">Удалить позицию?</h2></div>
            <p className="text-sm opacity-80 mb-4"><b>{itemToRemove.name}</b> будет удалена из чека.</p>
            <textarea value={removeReason} onChange={e => setRemoveReason(e.target.value)} placeholder="Причина удаления..." rows={2} className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowRemoveReason(false); setItemToRemove(null); }} className="flex-1 py-2.5 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Отмена</button>
              <button onClick={confirmRemoveItem} disabled={!removeReason.trim()} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel entire order */}
      {showCancelOrder && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex items-center gap-3 mb-4 text-red-400"><AlertTriangle size={28} /><h2 className="text-lg font-bold">Аннулировать заказ #{currentOrderId}?</h2></div>
            <p className="text-sm opacity-80 mb-4">Аннулирование требует обязательной причины.</p>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Причина аннулирования..." rows={2} className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowCancelOrder(false); setCancelReason(''); }} className="flex-1 py-2.5 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Отмена</button>
              <button onClick={cancelCurrentOrder} disabled={!cancelReason.trim()} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold">Аннулировать</button>
            </div>
          </div>
        </div>
      )}

      {/* Close shift confirmation */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex items-center gap-3 mb-4 text-red-400"><AlertTriangle size={28} /><h2 className="text-lg font-bold">Z-отчёт — {t('pos_close_shift')}?</h2></div>
            <p className="text-sm opacity-80 mb-3">После закрытия смены формируется Z-отчёт. Новые заказы будут недоступны до открытия следующей смены.</p>
            <div className="mb-4">
              <label className="text-xs opacity-70">Фактическая сумма в ящике</label>
              <input type="number" value={closingBalanceInput} onChange={e => setClosingBalanceInput(e.target.value)} placeholder="0" className={`w-full mt-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Отмена</button>
              <button onClick={() => { setShowCloseConfirm(false); closeShift(); }} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold">{t('pos_close_shift')}</button>
            </div>
          </div>
        </div>
      )}

      {reviewOrder && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setReviewOrder(null)}>
          <div className={`w-full max-w-sm rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Отзыв по заказу #{reviewOrder.id}</h2><button onClick={() => setReviewOrder(null)}><X size={20} /></button></div>
            <div className="flex justify-center gap-1 mb-3">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setReviewRating(star)} className={star <= reviewRating ? 'text-yellow-400' : 'text-zinc-500'}>
                  <Star size={24} fill={star <= reviewRating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Ваш отзыв или жалоба..." rows={3} className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            <button onClick={async () => {
              await api.request('/api/reviews', {
                method: 'POST',
                body: JSON.stringify({ order_id: reviewOrder.id, user_id: user?.id || 0, user_name: user?.username || 'Гость', rating: reviewRating, text: reviewText }),
              });
              showMsg('Отзыв сохранён');
              setReviewOrder(null);
            }} disabled={!reviewText.trim()} className="w-full mt-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm">Сохранить отзыв</button>
          </div>
        </div>
      )}

      {/* Shift report modal */}
      {showReport && report && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold flex items-center gap-2"><CheckCircle className="text-green-500" /> Z-отчёт по смене #{report.shift?.id}</h2><button onClick={() => setShowReport(false)}><X size={24} /></button></div>
            <div className={`grid grid-cols-2 gap-3 mb-4 text-sm ${darkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
              <div>Начало: <b>{new Date(report.shift?.openedAt).toLocaleString('ru-RU')}</b></div>
              <div>Окончание: <b>{new Date(report.shift?.closedAt).toLocaleString('ru-RU')}</b></div>
              <div>Открыл: <b>{report.openedByName || report.shift?.openedByName || '—'}</b></div>
              <div>Закрыл: <b>{report.closedByName || report.shift?.closedByName || '—'}</b></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Stat label="Заказов" value={report.totalOrders} />
              <Stat label="Выручка" value={`${report.totalRevenue}${CURRENCY}`} />
              <Stat label="Средний чек" value={`${Math.round(report.averageCheck * 100) / 100}${CURRENCY}`} />
              <Stat label="Отмен" value={report.canceledOrders} />
            </div>
            <h3 className="font-bold mb-2 text-sm">По способам оплаты</h3>
            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>Наличные: <b>{report.cashRevenue}{CURRENCY}</b></div>
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>Карта: <b>{report.cardRevenue}{CURRENCY}</b></div>
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>СБП: <b>{report.sbpRevenue}{CURRENCY}</b></div>
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>Онлайн: <b>{report.onlineRevenue}{CURRENCY}</b></div>
            </div>
            <h3 className="font-bold mb-2 text-sm flex items-center gap-2"><Users size={16} /> Сотрудники</h3>
            <div className="space-y-2 mb-4">
              {report.reportData?.employees?.map((emp: any) => (
                <div key={emp.id} className={`flex justify-between p-2 rounded-lg text-sm ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                  <span>{emp.name}</span>
                  <span className="opacity-70">{emp.orders} зак. · {emp.revenue}{CURRENCY}</span>
                </div>
              )) || <p className="text-sm opacity-60">Нет данных</p>}
            </div>
            <button onClick={() => setShowReport(false)} className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold">Закрыть отчёт</button>
          </div>
        </div>
      )}

      {/* Cash drawer modal */}
      {showCashDrawer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><Banknote className="text-green-500" /> Кассовые операции</h2><button onClick={() => setShowCashDrawer(false)}><X size={20} /></button></div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['deposit', 'withdrawal', 'refund'] as const).map(op => (
                <button key={op} onClick={() => setCashOpType(op)} className={`py-2 rounded-xl text-xs font-bold border ${cashOpType === op ? 'bg-green-600 text-white border-green-600' : (darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300')}`}>
                  {op === 'deposit' ? 'Внесение' : op === 'withdrawal' ? 'Изъятие' : 'Возврат'}
                </button>
              ))}
            </div>
            <input type="number" value={cashOpAmount} onChange={e => setCashOpAmount(e.target.value)} placeholder="Сумма" className={`w-full px-3 py-2 rounded-xl border mb-2 ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            <input value={cashOpNote} onChange={e => setCashOpNote(e.target.value)} placeholder="Примечание" className={`w-full px-3 py-2 rounded-xl border mb-3 ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            <button onClick={submitCashOp} disabled={!cashOpAmount} className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold mb-4">Записать операцию</button>
            <h3 className="font-bold mb-2 text-sm">Журнал операций</h3>
            <div className="space-y-2">
              {cashOps.length === 0 && <p className="text-sm opacity-60">Нет операций</p>}
              {cashOps.map((op: any) => (
                <div key={op.id} className={`flex justify-between p-2 rounded-lg text-sm ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                  <div>
                    <span className="font-semibold">{op.operation === 'deposit' ? 'Внесение' : op.operation === 'withdrawal' ? 'Изъятие' : 'Возврат'}</span>
                    {op.note && <span className="text-xs opacity-60 block">{op.note}</span>}
                    <span className="text-[10px] opacity-50">{op.createdByName} · {new Date(op.createdAt).toLocaleString('ru-RU')}</span>
                  </div>
                  <span className={`font-bold ${op.operation === 'deposit' ? 'text-green-500' : 'text-red-400'}`}>{op.amount}{CURRENCY}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-zinc-800/50 p-3 rounded-xl text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase opacity-60">{label}</div>
    </div>
  );
}

function PosAnalyticsPanel({ orders, darkMode }: { orders: any[]; darkMode: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.createdAt?.slice(0, 10) === today && o.status !== 'cancelled');
  const revenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const avgCheck = todayOrders.length ? Math.round(revenue / todayOrders.length) : 0;

  const dishStats: Record<string, { name: string; qty: number; revenue: number }> = {};
  todayOrders.forEach(o => {
    (o.items || []).forEach((i: any) => {
      const key = i.name;
      if (!dishStats[key]) dishStats[key] = { name: i.name, qty: 0, revenue: 0 };
      dishStats[key].qty += Number(i.quantity) || 1;
      dishStats[key].revenue += (i.price || 0) * (i.quantity || 1);
    });
  });
  const topDishes = Object.values(dishStats).sort((a: any, b: any) => b.qty - a.qty).slice(0, 5);

  const waiterStats: Record<string, { name: string; orders: number; revenue: number }> = {};
  todayOrders.forEach(o => {
    const name = o.handledByName || o.userName || '—';
    if (!waiterStats[name]) waiterStats[name] = { name, orders: 0, revenue: 0 };
    waiterStats[name].orders += 1;
    waiterStats[name].revenue += o.total || 0;
  });
  const waiters = Object.values(waiterStats).sort((a: any, b: any) => b.revenue - a.revenue);

  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, revenue: 0 }));
  todayOrders.forEach(o => {
    const h = new Date(o.createdAt).getHours();
    hourly[h].count += 1;
    hourly[h].revenue += o.total || 0;
  });
  const maxHour = Math.max(...hourly.map(h => h.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Заказов сегодня" value={todayOrders.length} />
        <Stat label="Выручка" value={`${Math.round(revenue)}${CURRENCY}`} />
        <Stat label="Средний чек" value={`${avgCheck}${CURRENCY}`} />
        <Stat label="Всего заказов" value={orders.length} />
      </div>
      <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <h3 className="font-bold mb-2 text-sm">Топ блюд</h3>
        {topDishes.length === 0 && <p className="text-sm opacity-60">Нет данных</p>}
        {topDishes.map((d: any, idx) => (
          <div key={d.name} className="flex justify-between text-sm py-1">
            <span>{idx + 1}. {d.name}</span>
            <span className="opacity-70">{d.qty} шт. · {Math.round(d.revenue)}{CURRENCY}</span>
          </div>
        ))}
      </div>
      <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <h3 className="font-bold mb-2 text-sm">Официанты</h3>
        {waiters.length === 0 && <p className="text-sm opacity-60">Нет данных</p>}
        {waiters.map((w: any) => (
          <div key={w.name} className="flex justify-between text-sm py-1">
            <span>{w.name}</span>
            <span className="opacity-70">{w.orders} зак. · {Math.round(w.revenue)}{CURRENCY}</span>
          </div>
        ))}
      </div>
      <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <h3 className="font-bold mb-2 text-sm">Заказы по часам</h3>
        <div className="flex items-end gap-1 h-32">
          {hourly.filter((_, i) => i >= 8 && i <= 23).map(h => (
            <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-orange-500/80 rounded-t" style={{ height: `${(h.count / maxHour) * 100}%`, minHeight: h.count ? 4 : 0 }} />
              <span className="text-[9px] opacity-60">{h.hour}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WaiterRating({ order, onRate }: { order: any; onRate: (rating: number, review: string) => void }) {
  const [rating, setRating] = useState(order.waiterRating || 0);
  const [review, setReview] = useState(order.waiterReview || '');
  const [saved, setSaved] = useState(false);
  return (
    <div className="text-xs">
      <div className="flex items-center gap-1 mb-1">
        <span className="opacity-70">Оценка официанта:</span>
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => { setRating(star); setSaved(false); }} className={star <= rating ? 'text-yellow-400' : 'text-zinc-500'}>
            <Star size={14} fill={star <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <input value={review} onChange={e => { setReview(e.target.value); setSaved(false); }} placeholder="Комментарий" className="w-full mb-1 px-2 py-1 rounded border bg-transparent border-zinc-600 text-xs" />
      <button onClick={() => { onRate(rating, review); setSaved(true); }} className="px-2 py-1 rounded bg-orange-600 text-white text-[10px] font-semibold">{saved ? 'Сохранено' : 'Сохранить'}</button>
    </div>
  );
}

function CoursePanel({ cart, onFireCourse }: { cart: CartItem[]; onFireCourse: (course: string) => void }) {
  const courses = ['appetizer', 'main', 'dessert', 'drink'];
  const labels: Record<string, string> = { appetizer: 'Закуски', main: 'Основное', dessert: 'Десерты', drink: 'Напитки' };
  const heldByCourse: Record<string, CartItem[]> = {};
  cart.filter(i => (i as any).itemStatus === 'hold' && i.course).forEach(i => {
    if (!heldByCourse[i.course!]) heldByCourse[i.course!] = [];
    heldByCourse[i.course!].push(i);
  });
  if (Object.keys(heldByCourse).length === 0) return null;
  return (
    <div className="p-3 rounded-xl border border-orange-500/30 bg-orange-500/10">
      <p className="text-xs font-bold mb-2">Курсы на удержании</p>
      <div className="flex flex-wrap gap-2">
        {courses.filter(c => heldByCourse[c]).map(c => (
          <button key={c} onClick={() => onFireCourse(c)} className="px-2 py-1 rounded-lg bg-orange-600 text-white text-xs font-semibold">
            {labels[c]} ({heldByCourse[c].length}) → На кухню
          </button>
        ))}
      </div>
    </div>
  );
}

function PosSettingsPanel({ settings, onSave, darkMode }: { settings: PosSettings; onSave: (s: PosSettings) => void; darkMode: boolean }) {
  const [form, setForm] = useState(settings);
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { setForm(settings); }, [settings]);
  useEffect(() => {
    api.request('/api/pos/action-logs').then(setLogs).catch(() => {});
  }, []);
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="font-bold mb-4">Настройки POS</h2>
      <div className={`max-w-xl space-y-3 p-4 rounded-2xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
          {[
          { key: 'orgName', label: 'Название организации' },
          { key: 'orgInn', label: 'ИНН' },
          { key: 'orgKpp', label: 'КПП' },
          { key: 'orgAddress', label: 'Адрес' },
          { key: 'orgPhone', label: 'Телефон' },
          { key: 'receiptFooter', label: 'Подвал чека' },
          { key: 'currencySymbol', label: 'Символ валюты' },
        ].map(field => (
          <div key={field.key}>
            <label className="text-xs opacity-70">{field.label}</label>
            <input value={(form as any)[field.key] || ''} onChange={e => setForm({ ...form, [field.key]: e.target.value })} className={`w-full mt-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
          </div>
        ))}
        <div className={`p-3 rounded-xl border ${darkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
          <label className="flex items-center gap-2 text-sm font-semibold mb-2">
            <input type="checkbox" checked={!!form.happyHour?.enabled} onChange={e => setForm({ ...form, happyHour: { ...(form.happyHour || { start: '15:00', end: '18:00', discountPercent: 10 }), enabled: e.target.checked } })} />
            Happy Hour (автоскидка по времени)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] opacity-60">Начало</label>
              <input type="time" value={form.happyHour?.start || '15:00'} onChange={e => setForm({ ...form, happyHour: { ...(form.happyHour || { enabled: false, end: '18:00', discountPercent: 10 }), start: e.target.value } })} className={`w-full px-2 py-1 rounded border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            </div>
            <div>
              <label className="text-[10px] opacity-60">Конец</label>
              <input type="time" value={form.happyHour?.end || '18:00'} onChange={e => setForm({ ...form, happyHour: { ...(form.happyHour || { enabled: false, start: '15:00', discountPercent: 10 }), end: e.target.value } })} className={`w-full px-2 py-1 rounded border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            </div>
            <div>
              <label className="text-[10px] opacity-60">Скидка %</label>
              <input type="number" value={form.happyHour?.discountPercent || 0} onChange={e => setForm({ ...form, happyHour: { ...(form.happyHour || { enabled: false, start: '15:00', end: '18:00' }), discountPercent: Number(e.target.value) } })} className={`w-full px-2 py-1 rounded border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            </div>
          </div>
        </div>
        <div className={`p-3 rounded-xl border ${darkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
          <h3 className="text-sm font-semibold mb-2">НДС</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] opacity-60">Ставка %</label>
              <input type="number" value={form.vatRate ?? 0} onChange={e => setForm({ ...form, vatRate: Number(e.target.value) })} className={`w-full px-2 py-1 rounded border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!!form.pricesIncludeVat} onChange={e => setForm({ ...form, pricesIncludeVat: e.target.checked })} />
            Цены включают НДС
          </label>
        </div>
        <button onClick={() => onSave(form)} className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2"><Save size={16} /> Сохранить</button>
      </div>

      <div className={`mt-6 max-w-xl p-4 rounded-2xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <h3 className="font-bold mb-3">Лог действий</h3>
        <div className="space-y-2 max-h-80 overflow-y-auto text-xs">
          {logs.length === 0 && <p className="opacity-50">Нет записей</p>}
          {logs.map((log: any) => (
            <div key={log.id} className="flex justify-between py-1 border-b border-zinc-700/30">
              <span>{new Date(log.createdAt).toLocaleString('ru-RU')}</span>
              <span className="font-semibold">{log.action}</span>
              <span className="opacity-70 truncate max-w-[200px]">{log.details}</span>
              <span className="opacity-60">{log.createdByName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
