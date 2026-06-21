import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneCall, PhoneOff, User, Clock, Search, ShoppingCart, Save, X, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function TelephonyOperatorPage() {
  const { t } = useTranslation();
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [callLog, setCallLog] = useState<any[]>([]);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [orderComment, setOrderComment] = useState('');
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadCallLog();
    loadMenuItems();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const loadCallLog = async () => {
    try {
      const logs = await api.getTelephonyLogs();
      setCallLog(Array.isArray(logs) ? logs : []);
    } catch {}
  };

  const loadMenuItems = async () => {
    try {
      const items = await api.getDishes();
      setMenuItems(Array.isArray(items) ? items : []);
    } catch {}
  };

  const lookupClient = async (phone: string) => {
    try {
      const clients = await api.searchClients(phone);
      if (Array.isArray(clients) && clients.length > 0) {
        setClientInfo(clients[0]);
      } else {
        setClientInfo(null);
      }
    } catch { setClientInfo(null); }
  };

  const handleIncomingCall = (call: any) => {
    setActiveCalls(prev => [...prev, { ...call, startTime: Date.now() }]);
    setSelectedCall(call);
    lookupClient(call.caller_phone);
    if (Notification.permission === 'granted') {
      new Notification('Входящий звонок', { body: `+${call.caller_phone}` });
    }
  };

  const createOrderFromCall = async () => {
    if (!selectedCall || cart.length === 0) return;
    try {
      const order = await api.createOrder({
        user_id: 0,
        user_name: clientInfo?.name || 'Гость (телефон)',
        user_phone: selectedCall.caller_phone,
        items: cart.map((i: any) => ({ dishId: i.id, quantity: i.qty, price: i.price })),
        total: cart.reduce((s: number, i: any) => s + i.price * i.qty, 0),
        comment: `Заказ по телефону. ${orderComment}`.trim(),
      });
      addToast('Заказ создан', 'success');
      await api.addTelephonyNote(selectedCall.id || selectedCall.call_id, `Заказ #${order.id}`);
      setCart([]);
      setOrderComment('');
    } catch (e: any) {
      addToast('Ошибка: ' + e.message, 'error');
    }
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const exists = prev.find((i: any) => i.id === item.id);
      if (exists) return prev.map((i: any) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => {
      const item = prev.find((i: any) => i.id === id);
      if (item && item.qty > 1) return prev.map((i: any) => i.id === id ? { ...i, qty: i.qty - 1 } : i);
      return prev.filter((i: any) => i.id !== id);
    });
  };

  const filteredMenu = menuItems.filter((i: any) =>
    i.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDuration = (start: number) => {
    const sec = Math.floor((Date.now() - start) / 1000);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Phone size={24} /> Оператор колл-центра</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Active calls + history */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex gap-2 mb-3">
              <button onClick={() => setTab('active')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tab === 'active' ? 'bg-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                Активные ({activeCalls.length})
              </button>
              <button onClick={() => setTab('history')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tab === 'history' ? 'bg-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                История
              </button>
            </div>

            {tab === 'active' ? (
              activeCalls.length === 0 ? (
                <p className="text-zinc-400 text-sm text-center py-8">Нет активных звонков</p>
              ) : (
                activeCalls.map((call, i) => (
                  <button key={i} onClick={() => { setSelectedCall(call); lookupClient(call.caller_phone); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-2 text-left"
                  >
                    <PhoneCall size={20} className="text-green-500 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">+{call.caller_phone}</p>
                      <p className="text-xs text-zinc-400">{formatDuration(call.startTime)}</p>
                    </div>
                  </button>
                ))
              )
            ) : (
              callLog.slice(0, 20).map((log, i) => (
                <button key={i} onClick={() => { setSelectedCall(log); lookupClient(log.caller_phone); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 mb-2 text-left"
                >
                  <Phone size={16} className="text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">+{log.caller_phone}</p>
                    <p className="text-xs text-zinc-400">{log.duration ? `${log.duration}с` : '-'} · {log.status}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center: Client info + order form */}
        <div className="lg:col-span-1 space-y-4">
          {selectedCall ? (
            <>
              <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><User size={16} /> Карточка клиента</h2>
                {clientInfo ? (
                  <div className="space-y-1 text-sm">
                    <p><span className="text-zinc-400">Имя:</span> {clientInfo.name || '—'}</p>
                    <p><span className="text-zinc-400">Телефон:</span> {clientInfo.phone}</p>
                    <p><span className="text-zinc-400">Заказов:</span> {clientInfo.orders_count || 0}</p>
                    <p><span className="text-zinc-400">Бонусов:</span> {clientInfo.bonus_balance || 0}</p>
                  </div>
                ) : (
                  <p className="text-zinc-400 text-sm">Клиент не найден. Новый звонок.</p>
                )}
                <div className="mt-3">
                  <p className="text-xs text-zinc-400 mb-1">Длительность: <span className="text-white font-mono">{selectedCall.startTime ? formatDuration(selectedCall.startTime) : '—'}</span></p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Search size={16} /> Поиск блюд</h2>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Введите название блюда..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm mb-3"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredMenu.slice(0, 20).map((item: any) => (
                    <button key={item.id} onClick={() => addToCart(item)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                    >
                      <span className="text-sm">{item.name}</span>
                      <span className="text-sm font-bold text-blue-500">{item.price} ₽</span>
                    </button>
                  ))}
                  {filteredMenu.length === 0 && <p className="text-zinc-400 text-xs text-center py-2">Ничего не найдено</p>}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><ShoppingCart size={16} /> Корзина заказа</h2>
                {cart.length === 0 ? (
                  <p className="text-zinc-400 text-xs py-2">Добавьте блюда из меню</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {cart.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="flex-1 truncate">{item.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-500 text-xs font-bold">−</button>
                          <span className="w-6 text-center">{item.qty}</span>
                          <button onClick={() => addToCart(item)} className="text-green-400 hover:text-green-500 text-xs font-bold">+</button>
                          <span className="w-14 text-right font-bold">{item.price * item.qty} ₽</span>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 flex justify-between font-bold text-sm">
                      <span>Итого:</span>
                      <span>{cart.reduce((s: number, i: any) => s + i.price * i.qty, 0)} ₽</span>
                    </div>
                  </div>
                )}
                <textarea value={orderComment} onChange={e => setOrderComment(e.target.value)}
                  placeholder="Комментарий к заказу..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm mb-3 resize-none"
                />
                <button onClick={createOrderFromCall} disabled={cart.length === 0}
                  className="w-full py-2.5 rounded-xl font-bold text-sm bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Создать заказ
                </button>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center h-64">
              <p className="text-zinc-400 text-sm text-center">Выберите звонок из списка<br/>для начала работы</p>
            </div>
          )}
        </div>

        {/* Right: Quick stats + notifications */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Clock size={16} /> Статистика</h2>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
                <p className="text-2xl font-bold text-blue-500">{callLog.length}</p>
                <p className="text-xs text-zinc-400">Всего звонков</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
                <p className="text-2xl font-bold text-green-500">{callLog.filter((l: any) => l.order_id).length}</p>
                <p className="text-xs text-zinc-400">Заказов</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><MessageSquare size={16} /> Уведомления</h2>
            <p className="text-xs text-zinc-400">При входящем звонке появится уведомление на рабочем столе.<br/>Убедитесь, что уведомления разрешены.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
