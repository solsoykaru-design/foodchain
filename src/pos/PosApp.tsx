import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShoppingCart, Trash2, Plus, Minus, Search, Settings, History, LogOut,
  Printer, CreditCard, Banknote, QrCode, Receipt, Calculator, X, ChevronLeft,
  ChevronRight, Clock, User, Lock, Save, Edit3, CheckCircle, AlertTriangle,
  RotateCcw, ArrowRightLeft, LayoutGrid, List, Percent, Wallet, Monitor,
  Sun, Moon, Maximize2
} from 'lucide-react';
import * as api from '../api';

interface Dish {
  id: number;
  name: string;
  price: number;
  categoryId?: number;
  zone?: string;
}

interface Category {
  id: number;
  name: string;
}

interface CartItem {
  dishId: number;
  name: string;
  price: number;
  quantity: number;
  modifiers: string[];
  comment: string;
  zone?: string;
}

interface PaymentMethod {
  id: number;
  key: string;
  name: string;
  icon: string;
  allowsChange: number;
  requiresTerminal: number;
}

interface PosSettings {
  orgName?: string;
  orgInn?: string;
  receiptFooter?: string;
  currencySymbol?: string;
}

interface Shift {
  id: number;
  staffId: number;
  staffName: string;
  openedAt: string;
  status: string;
  openingBalance: number;
}

interface Order {
  id: number;
  userName: string;
  status: string;
  total: number;
  items: any[];
  createdAt: string;
  tableId?: number;
}

export default function PosApp() {
  // Auth
  const [token, setToken] = useState(localStorage.getItem('fc_token') || '');
  const [user, setUser] = useState<any>(null);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Data
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<PosSettings>({});
  const [shift, setShift] = useState<Shift | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<'sale' | 'history' | 'settings'>('sale');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [orderComment, setOrderComment] = useState('');
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>('cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState('');
  const [tables, setTables] = useState<any[]>([]);

  const messageTimer = useRef<any>(null);

  const showMsg = (text: string) => {
    setMessage(text);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 3000);
  };

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [d, c, pm, s, sh, o, t] = await Promise.all([
        api.getDishes(),
        api.getMenuCategories(),
        api.request('/api/pos/payment-methods'),
        api.request('/api/pos/settings'),
        api.request('/api/pos/shifts/current'),
        api.getOrdersMultiStatus(['new', 'preparing', 'ready', 'paid', 'closed']),
        api.getTables(),
      ]);
      setDishes(Array.isArray(d) ? d : []);
      setCategories(Array.isArray(c) ? c : []);
      setPaymentMethods(Array.isArray(pm) ? pm : []);
      setSettings(s || {});
      setShift(sh?.shift || null);
      setOrders(Array.isArray(o) ? o : []);
      setTables(Array.isArray(t) ? t : []);
    } catch (e) {
      console.error('POS load error:', e);
    }
  }, []);

  useEffect(() => {
    if (token) {
      api.getMe().then(r => { setUser(r.user); loadData(); }).catch(() => setToken(''));
    }
  }, [token, loadData]);

  // Auth handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api.adminLogin(loginPhone, loginPassword);
      if (data.token) {
        localStorage.setItem('fc_token', data.token);
        setToken(data.token);
        setUser(data.user);
        loadData();
      } else {
        setLoginError('Неверный логин или пароль');
      }
    } catch (e: any) {
      setLoginError(e.message || 'Ошибка входа');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('fc_token');
    setToken('');
    setUser(null);
  };

  // Cart logic
  const addToCart = (dish: Dish) => {
    setCart(prev => {
      const existing = prev.find(i => i.dishId === dish.id);
      if (existing) {
        return prev.map(i => i.dishId === dish.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { dishId: dish.id, name: dish.name, price: dish.price, quantity: 1, modifiers: [], comment: '', zone: dish.zone }];
    });
  };

  const updateQty = (dishId: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.dishId !== dishId) return i;
      const q = Math.max(1, i.quantity + delta);
      return { ...i, quantity: q };
    }).filter(i => i.quantity > 0));
  };

  const removeItem = (dishId: number) => {
    setCart(prev => prev.filter(i => i.dishId !== dishId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedTable(null);
    setCustomerName('');
    setOrderComment('');
    setDiscountValue(0);
  };

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const discountAmount = useMemo(() => {
    if (discountType === 'percent') return Math.round(subtotal * (discountValue / 100) * 100) / 100;
    return discountValue;
  }, [subtotal, discountValue, discountType]);
  const total = Math.max(0, subtotal - discountAmount);

  const filteredDishes = useMemo(() => {
    let list = dishes;
    if (selectedCategory !== 'all') list = list.filter(d => d.categoryId === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [dishes, selectedCategory, search]);

  // Shift
  const openShift = async () => {
    try {
      const r = await api.request('/api/pos/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingBalance: 0 }),
      });
      if (r.success) { setShift(r.shift); showMsg('Смена открыта'); }
    } catch (e: any) { alert(e.message); }
  };

  const closeShift = async () => {
    if (!shift) return;
    try {
      const r = await api.request(`/api/pos/shifts/${shift.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ closingBalance: 0 }),
      });
      if (r.success) { setShift(null); showMsg('Смена закрыта'); }
    } catch (e: any) { alert(e.message); }
  };

  // Payment
  const change = useMemo(() => {
    const received = parseFloat(receivedAmount) || 0;
    const pm = paymentMethods.find(p => p.key === selectedPayment);
    if (!pm || !pm.allowsChange) return 0;
    return Math.max(0, received - total);
  }, [receivedAmount, total, selectedPayment, paymentMethods]);

  const submitOrder = async () => {
    if (cart.length === 0) return;
    try {
      const table = tables.find(t => t.id === selectedTable);
      const result = await api.createOrder({
        user_id: user?.id || 1,
        user_name: customerName || user?.username || 'Гость',
        user_phone: '',
        address: table ? `Стол ${table.name}` : 'POS',
        items: cart.map(i => ({
          dishId: i.dishId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          options: i.modifiers,
          comment: i.comment,
          zone: i.zone,
        })),
        total,
        payment_method: selectedPayment,
        type: 'dine_in',
        comment: orderComment,
      });

      // Create POS receipt
      await api.request('/api/pos/receipts', {
        method: 'POST',
        body: JSON.stringify({
          orderId: result.id,
          shiftId: shift?.id || 0,
          total,
          paymentMethod: selectedPayment,
          paymentAmount: parseFloat(receivedAmount) || total,
          changeAmount: change,
        }),
      });

      showMsg(`Заказ #${result.id} оплачен`);
      clearCart();
      setShowPayment(false);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  // Settings save
  const saveSettings = async (newSettings: PosSettings) => {
    try {
      const r = await api.request('/api/pos/settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings),
      });
      setSettings(r);
      showMsg('Настройки сохранены');
    } catch (e: any) { alert(e.message); }
  };

  // Print receipt (simulated)
  const printReceipt = () => {
    const receipt = generateReceiptText();
    const w = window.open('', '_blank', 'width=400,height=600');
    if (w) {
      w.document.write(`<pre style="font-family: monospace; font-size: 12px; padding: 20px;">${receipt}</pre>`);
      w.document.close();
      w.print();
    }
  };

  const generateReceiptText = () => {
    const lines: string[] = [];
    lines.push(settings.orgName || 'FoodChain');
    lines.push('ИНН: ' + (settings.orgInn || '—'));
    lines.push('──────────────────────');
    lines.push(`Кассир: ${user?.username || '—'}`);
    lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
    lines.push('──────────────────────');
    cart.forEach(i => {
      lines.push(`${i.name}`);
      lines.push(`${i.quantity} x ${i.price} = ${i.quantity * i.price}`);
    });
    lines.push('──────────────────────');
    lines.push(`ИТОГО: ${total} ${settings.currencySymbol || '₽'}`);
    lines.push(`Оплата: ${paymentMethods.find(p => p.key === selectedPayment)?.name || selectedPayment}`);
    if (change > 0) lines.push(`Сдача: ${change}`);
    lines.push('──────────────────────');
    lines.push(settings.receiptFooter || 'Спасибо за покупку!');
    return lines.join('\n');
  };

  if (!token || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md border border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center font-bold text-xl">P</div>
            <h1 className="text-xl font-bold">POS-терминал</h1>
          </div>
          <div className="space-y-4">
            <input
              value={loginPhone}
              onChange={e => setLoginPhone(e.target.value)}
              placeholder="Логин"
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 border border-zinc-700"
            />
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              placeholder="Пароль"
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 border border-zinc-700"
            />
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition">
              Войти
            </button>
          </div>
        </form>
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
            <h1 className="font-bold text-sm">POS-терминал</h1>
            <p className="text-[10px] opacity-60">{user.username} · {shift ? `Смена #${shift.id}` : 'Смена не открыта'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!shift ? (
            <button onClick={openShift} className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg">Открыть смену</button>
          ) : (
            <button onClick={closeShift} className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg">Закрыть смену</button>
          )}
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-zinc-800/10">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={() => setFullscreen(!fullscreen)} className="p-2 rounded-lg hover:bg-zinc-800/10"><Maximize2 size={16} /></button>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-zinc-800/10 text-red-400"><LogOut size={16} /></button>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-xl">
          {message}
        </div>
      )}

      {/* Main */}
      <main className="flex h-[calc(100vh-64px)]">
        {/* Left: catalog */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className={`flex border-b ${darkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
            {[
              { key: 'sale', label: 'Продажа', icon: ShoppingCart },
              { key: 'history', label: 'История', icon: History },
              { key: 'settings', label: 'Настройки', icon: Settings },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition ${
                  activeTab === t.key
                    ? (darkMode ? 'text-orange-400 border-b-2 border-orange-500 bg-zinc-800/30' : 'text-orange-600 border-b-2 border-orange-500 bg-zinc-100')
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'sale' && (
            <>
              {/* Search & categories */}
              <div className={`p-3 border-b ${darkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Поиск блюда..."
                      className={`w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none border ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300'}`}
                    />
                  </div>
                  <select
                    value={selectedTable || ''}
                    onChange={e => setSelectedTable(e.target.value ? Number(e.target.value) : null)}
                    className={`px-3 py-2 rounded-xl text-sm outline-none border ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300'}`}
                  >
                    <option value="">Без стола</option>
                    {tables.map(t => <option key={t.id} value={t.id}>Стол {t.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCategory === 'all' ? 'bg-orange-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}
                  >
                    Все
                  </button>
                  {categories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedCategory === c.id ? 'bg-orange-600 text-white' : (darkMode ? 'bg-zinc-800' : 'bg-white border border-zinc-300')}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products grid */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredDishes.map(d => (
                    <button
                      key={d.id}
                      onClick={() => addToCart(d)}
                      className={`p-3 rounded-xl text-left transition hover:scale-[1.02] active:scale-95 ${darkMode ? 'bg-zinc-900 border border-zinc-800 hover:border-orange-500' : 'bg-white border border-zinc-200 hover:border-orange-400'}`}
                    >
                      <p className="text-xs font-semibold line-clamp-2">{d.name}</p>
                      <p className="text-sm font-bold text-orange-500 mt-1">{d.price}₽</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4">
              <h2 className="font-bold mb-3">История заказов</h2>
              <div className="space-y-2">
                {orders.map(o => (
                  <div key={o.id} className={`p-3 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold">#{o.id}</span>
                      <span className="text-sm font-bold">{o.total}₽</span>
                    </div>
                    <p className="text-xs opacity-60">{o.userName} · {new Date(o.createdAt).toLocaleString('ru-RU')}</p>
                    <p className="text-xs opacity-60">{o.items?.length || 0} поз.</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <PosSettingsPanel settings={settings} onSave={saveSettings} darkMode={darkMode} />
          )}
        </div>

        {/* Right: cart */}
        <div className={`w-[380px] flex flex-col border-l ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
          <div className="p-4 border-b border-zinc-800/20">
            <h2 className="font-bold flex items-center gap-2"><ShoppingCart size={18} /> Чек</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <p className="text-center opacity-50 py-10 text-sm">Добавьте блюда</p>
            ) : cart.map(item => (
              <div key={item.dishId} className={`p-3 rounded-xl ${darkMode ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm">{item.name}</span>
                  <span className="font-bold text-sm">{item.price * item.quantity}₽</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.dishId, -1)} className="w-7 h-7 rounded-lg bg-zinc-700 text-white flex items-center justify-center"><Minus size={14} /></button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.dishId, 1)} className="w-7 h-7 rounded-lg bg-zinc-700 text-white flex items-center justify-center"><Plus size={14} /></button>
                  </div>
                  <button onClick={() => removeItem(item.dishId)} className="text-red-400 p-1"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className={`p-4 border-t ${darkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <div className="flex gap-2 mb-3">
              <select
                value={discountType}
                onChange={e => setDiscountType(e.target.value as any)}
                className={`text-xs px-2 py-1 rounded-lg border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}
              >
                <option value="percent">%</option>
                <option value="amount">₽</option>
              </select>
              <input
                type="number"
                value={discountValue}
                onChange={e => setDiscountValue(Number(e.target.value))}
                placeholder="Скидка"
                className={`flex-1 text-xs px-2 py-1 rounded-lg border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}
              />
            </div>
            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between opacity-70"><span>Сумма</span><span>{subtotal}₽</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-red-400"><span>Скидка</span><span>-{discountAmount}₽</span></div>}
              <div className="flex justify-between text-xl font-bold"><span>ИТОГО</span><span>{total}₽</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={clearCart} className="py-3 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Очистить</button>
              <button
                onClick={() => setShowPayment(true)}
                disabled={cart.length === 0}
                className="py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold"
              >
                Оплатить
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Payment modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Оплата</h2>
              <button onClick={() => setShowPayment(false)}><X size={20} /></button>
            </div>
            <p className="text-3xl font-bold text-center mb-4">{total}₽</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {paymentMethods.filter(p => p.isActive).map(pm => (
                <button
                  key={pm.id}
                  onClick={() => setSelectedPayment(pm.key)}
                  className={`p-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition ${
                    selectedPayment === pm.key
                      ? 'bg-orange-600 text-white border-orange-600'
                      : (darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300')
                  }`}
                >
                  {pm.name}
                </button>
              ))}
            </div>
            {paymentMethods.find(p => p.key === selectedPayment)?.allowsChange && (
              <div className="mb-4">
                <label className="text-xs opacity-70">Получено</label>
                <input
                  type="number"
                  value={receivedAmount}
                  onChange={e => setReceivedAmount(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}
                />
                {change > 0 && <p className="text-sm text-green-500 mt-1">Сдача: {change}₽</p>}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={printReceipt} className="flex-1 py-3 rounded-xl bg-zinc-700 text-white text-sm font-semibold flex items-center justify-center gap-2"><Printer size={16} /> Чек</button>
              <button onClick={submitOrder} className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold">Подтвердить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PosSettingsPanel({ settings, onSave, darkMode }: { settings: PosSettings; onSave: (s: PosSettings) => void; darkMode: boolean }) {
  const [form, setForm] = useState(settings);

  useEffect(() => { setForm(settings); }, [settings]);

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
            <input
              value={(form as any)[field.key] || ''}
              onChange={e => setForm({ ...form, [field.key]: e.target.value })}
              className={`w-full mt-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}
            />
          </div>
        ))}
        <button
          onClick={() => onSave(form)}
          className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2"
        >
          <Save size={16} /> Сохранить
        </button>
      </div>
    </div>
  );
}
