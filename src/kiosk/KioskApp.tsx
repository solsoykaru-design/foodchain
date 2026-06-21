import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context';
import * as api from '../api';
import { ShoppingCart, Plus, Minus, X, Check, Printer, CreditCard, Banknote, ChevronLeft, Clock, AlertCircle } from 'lucide-react';

type KioskStep = 'menu' | 'checkout' | 'payment' | 'complete';

interface CartItem {
  dishId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export default function KioskApp() {
  const { cart, addToCart, removeFromCart, updateCartQty, cartTotal, clearCart } = useApp();
  const [step, setStep] = useState<KioskStep>('menu');
  const [categories, setCategories] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [orderResult, setOrderResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const inactivityRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    Promise.all([
      api.getMenuCategories(true).catch(() => []),
      api.getDishes().catch(() => []),
    ]).then(([cats, items]) => {
      setCategories(cats || []);
      setDishes(items || []);
      if (cats && cats.length > 0) setSelectedCategory(cats[0].id);
      setLoading(false);
    });
  }, []);

  const useResetInactivity = () => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (step !== 'menu') return;
    inactivityRef.current = setTimeout(() => {
      setCartItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');
      setOrderResult(null);
      setStep('menu');
      setError('');
    }, 30000);
  };

  useEffect(() => {
    const handler = () => useResetInactivity();
    window.addEventListener('mousedown', handler);
    window.addEventListener('touchstart', handler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('touchstart', handler);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [step]);

  const categoryDishes = dishes.filter(d => d.categoryId === selectedCategory || d.category_id === selectedCategory);

  const addItem = (dish: any) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.dishId === dish.id);
      if (existing) return prev.map(i => i.dishId === dish.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { dishId: dish.id, name: dish.name, price: dish.price, quantity: 1, imageUrl: dish.imageUrl }];
    });
  };

  const removeItem = (dishId: number) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.dishId === dishId);
      if (existing && existing.quantity > 1) return prev.map(i => i.dishId === dishId ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.dishId !== dishId);
    });
  };

  const cartSum = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const placeOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Укажите имя и телефон');
      return;
    }
    setError('');
    try {
      let userId = 0;
      const users = await api.getUsers(customerPhone).catch(() => []);
      const existingUser = Array.isArray(users) ? users.find((u: any) => u.phone === customerPhone) : null;
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const reg = await api.register(customerName, customerPhone, 'guest');
        userId = reg.user.id;
      }
      const order = await api.createOrder({
        user_id: userId,
        user_name: customerName,
        user_phone: customerPhone,
        items: cartItems.map(i => ({ dishId: i.dishId, name: i.name, price: i.price, quantity: i.quantity })),
        total: cartSum,
        payment_method: paymentMethod,
        type: 'pickup',
      });
      setOrderResult(order);
      setStep('complete');
    } catch (e: any) {
      setError(e.message || 'Ошибка оформления');
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const resetAll = () => {
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('cash');
    setOrderResult(null);
    setStep('menu');
    setError('');
    clearCart();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-2xl text-zinc-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col overflow-hidden select-none">
      {step === 'menu' && (
        <div className="flex flex-col h-screen">
          <div className="bg-zinc-900 border-b border-zinc-800 p-4">
            <h1 className="text-3xl font-bold text-center tracking-wide">Терминал самообслуживания</h1>
          </div>
          <div className="flex overflow-x-auto gap-3 p-4 bg-zinc-900/50 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {categories.map((cat: any) => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 px-6 py-3 rounded-2xl text-lg font-bold transition-all active:scale-95 ${selectedCategory === cat.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                {cat.name}
              </button>
            ))}
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
              {categoryDishes.map((dish: any) => (
                <button key={dish.id} onClick={() => addItem(dish)}
                  className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-blue-500/50 transition-all active:scale-95 text-left">
                  {dish.imageUrl ? (
                    <img src={dish.imageUrl} alt={dish.name} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-zinc-800 flex items-center justify-center text-zinc-600 text-4xl">🍽</div>
                  )}
                  <div className="p-3">
                    <h3 className="font-bold text-lg truncate">{dish.name}</h3>
                    <p className="text-blue-400 font-bold text-xl mt-1">{dish.price} ₽</p>
                    {dish.weight && <p className="text-zinc-500 text-sm">{dish.weight} {dish.unit || 'г'}</p>}
                  </div>
                </button>
              ))}
            </div>
            <div className="w-80 lg:w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0">
              <div className="p-4 border-b border-zinc-800">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingCart size={22} /> Корзина
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cartItems.length === 0 ? (
                  <p className="text-zinc-500 text-center text-lg mt-8">Корзина пуста</p>
                ) : (
                  cartItems.map(item => (
                    <div key={item.dishId} className="flex items-center gap-3 bg-zinc-800 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{item.name}</p>
                        <p className="text-blue-400 font-bold">{item.price * item.quantity} ₽</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeItem(item.dishId)} className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center active:scale-90"><Minus size={18} /></button>
                        <span className="w-8 text-center font-bold text-lg">{item.quantity}</span>
                        <button onClick={() => addItem({ id: item.dishId, name: item.name, price: item.price, imageUrl: item.imageUrl })} className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center active:scale-90"><Plus size={18} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-zinc-800 space-y-3">
                <div className="flex justify-between text-xl font-bold">
                  <span>Итого:</span>
                  <span className="text-blue-400">{cartSum} ₽</span>
                </div>
                <button onClick={() => setCartItems([])}
                  className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-400 font-bold text-lg active:scale-95">
                  Очистить корзину
                </button>
                <button onClick={() => cartItems.length > 0 && setStep('checkout')}
                  disabled={cartItems.length === 0}
                  className={`w-full py-4 rounded-2xl font-bold text-xl transition-all active:scale-95 ${cartItems.length > 0 ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-zinc-800 text-zinc-600'}`}>
                  Оформить заказ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'checkout' && (
        <div className="flex items-center justify-center h-screen p-8">
          <div className="w-full max-w-lg bg-zinc-900 rounded-3xl p-8 space-y-6">
            <button onClick={() => setStep('menu')} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-lg">
              <ChevronLeft size={24} /> Назад
            </button>
            <h2 className="text-3xl font-bold text-center">Оформление заказа</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-zinc-400 mb-2 text-lg">Ваше имя</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-4 text-white text-xl focus:border-blue-500 outline-none"
                  placeholder="Введите имя" />
              </div>
              <div>
                <label className="block text-zinc-400 mb-2 text-lg">Номер телефона</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-4 text-white text-xl focus:border-blue-500 outline-none"
                  placeholder="+7 (999) 999-99-99" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-zinc-400 text-lg">Способ оплаты</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-xl transition-all active:scale-95 ${paymentMethod === 'cash' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
                  <Banknote size={24} /> Наличные
                </button>
                <button onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-xl transition-all active:scale-95 ${paymentMethod === 'card' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
                  <CreditCard size={24} /> Карта
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <div className="flex justify-between text-2xl font-bold mb-4">
                <span>Сумма:</span>
                <span className="text-blue-400">{cartSum} ₽</span>
              </div>
              {error && <div className="text-red-400 text-lg mb-3 flex items-center gap-2"><AlertCircle size={20} /> {error}</div>}
              <button onClick={placeOrder}
                className="w-full py-4 rounded-2xl font-bold text-xl bg-green-500 text-white shadow-lg shadow-green-500/30 active:scale-95 transition-all">
                <Check size={24} className="inline mr-2" /> Подтвердить заказ
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'complete' && orderResult && (
        <div className="flex items-center justify-center h-screen p-8">
          <div className="w-full max-w-lg bg-zinc-900 rounded-3xl p-8 space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <Check size={40} className="text-green-500" />
            </div>
            <h2 className="text-3xl font-bold">Заказ оформлен!</h2>
            <p className="text-zinc-400 text-xl">Номер заказа: <span className="text-white font-bold">#{orderResult.id}</span></p>
            <div className="bg-zinc-800 rounded-2xl p-6 space-y-2 text-left">
              <p className="text-zinc-400">Клиент: {customerName}</p>
              <p className="text-zinc-400">Телефон: {customerPhone}</p>
              <p className="text-zinc-400">Способ оплаты: {paymentMethod === 'cash' ? 'Наличные' : 'Карта'}</p>
              <div className="border-t border-zinc-700 pt-2 mt-2">
                {cartItems.map((item, i) => (
                  <p key={i} className="flex justify-between text-lg">
                    <span>{item.name} × {item.quantity}</span>
                    <span>{item.price * item.quantity} ₽</span>
                  </p>
                ))}
                <div className="flex justify-between text-xl font-bold mt-2 pt-2 border-t border-zinc-700">
                  <span>Итого</span>
                  <span className="text-blue-400">{cartSum} ₽</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={printReceipt}
                className="flex-1 py-4 rounded-2xl font-bold text-lg bg-zinc-800 text-white active:scale-95 transition-all">
                <Printer size={20} className="inline mr-2" /> Распечатать чек
              </button>
            </div>
            <button onClick={resetAll}
              className="w-full py-4 rounded-2xl font-bold text-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
              Новый заказ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
