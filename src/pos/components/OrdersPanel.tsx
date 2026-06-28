import { useState, useEffect, useMemo } from 'react';
import { Search, Truck, ChefHat, Check, X, Trash2, Plus, Minus, Printer, CreditCard, AlertTriangle, Clock, User, MapPin, Phone } from 'lucide-react';
import * as api from '../../api';

interface Props {
  darkMode: boolean;
  shiftId: number;
  user?: any;
  onMessage: (msg: string) => void;
}

const CURRENCY = '₽';
const STATUS_LABELS: Record<string, string> = {
  new: 'Новый', confirmed: 'Принят', preparing: 'Готовится', ready: 'Готов',
  served: 'Подан', paid: 'Оплачен', closed: 'Закрыт', cancelled: 'Отменён',
  assigned: 'Курьер назначен', en_route: 'В пути', delivered: 'Доставлен',
};
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400', confirmed: 'bg-blue-500/20 text-blue-400',
  preparing: 'bg-amber-500/20 text-amber-400', ready: 'bg-green-500/20 text-green-400',
  served: 'bg-purple-500/20 text-purple-400', paid: 'bg-emerald-500/20 text-emerald-400',
  closed: 'bg-zinc-500/20 text-zinc-400', cancelled: 'bg-red-500/20 text-red-400',
  assigned: 'bg-cyan-500/20 text-cyan-400', en_route: 'bg-indigo-500/20 text-indigo-400',
  delivered: 'bg-emerald-500/20 text-emerald-400',
};

export default function OrdersPanel({ darkMode, shiftId, user, onMessage }: Props) {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'new' | 'preparing' | 'ready' | 'delivery' | 'paid' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [payReceived, setPayReceived] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  const loadOrders = async () => {
    try {
      const params: any = {};
      if (filter !== 'all') {
        if (filter === 'delivery') params.type = 'delivery';
        else params.status = filter;
      }
      if (search.trim()) params.search = search;
      const data = await api.getPosOrders(params);
      setOrders(data);
    } catch (e: any) { onMessage(e.message); }
  };

  const loadCouriers = async () => {
    try { setCouriers(await api.getPosCouriers()); } catch {}
  };

  const loadPaymentMethods = async () => {
    try { setPaymentMethods(await api.request('/api/pos/payment-methods')); } catch {}
  };

  useEffect(() => { loadOrders(); loadCouriers(); loadPaymentMethods(); const id = setInterval(loadOrders, 5000); return () => clearInterval(id); }, [filter, search]);

  const handleStatus = async (status: string, note?: string) => {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      await api.updatePosOrderStatus(selectedOrder.id, status, note);
      onMessage(`Статус обновлён: ${STATUS_LABELS[status]}`);
      await loadOrders();
      const updated = await api.request(`/api/pos/orders/${selectedOrder.id}`);
      setSelectedOrder(updated);
    } catch (e: any) { onMessage(e.message); }
    setLoading(false);
  };

  const handleAssignCourier = async (courierId: number) => {
    if (!selectedOrder) return;
    const courier = couriers.find(c => c.id === courierId);
    setLoading(true);
    try {
      await api.assignPosOrderCourier(selectedOrder.id, courierId, courier?.name || `Курьер #${courierId}`);
      onMessage('Курьер назначен');
      await loadOrders();
      const updated = await api.request(`/api/pos/orders/${selectedOrder.id}`);
      setSelectedOrder(updated);
    } catch (e: any) { onMessage(e.message); }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      await api.cancelPosOrder(selectedOrder.id, cancelReason);
      onMessage('Заказ отменён');
      setShowCancel(false);
      setSelectedOrder(null);
      await loadOrders();
    } catch (e: any) { onMessage(e.message); }
    setLoading(false);
  };

  const handleUpdateItems = async (items: any[]) => {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      await api.updatePosOrderItems(selectedOrder.id, items);
      onMessage('Состав обновлён');
      await loadOrders();
      const updated = await api.request(`/api/pos/orders/${selectedOrder.id}`);
      setSelectedOrder(updated);
    } catch (e: any) { onMessage(e.message); }
    setLoading(false);
  };

  const handlePay = async () => {
    if (!selectedOrder) return;
    const total = Number(selectedOrder.total) || 0;
    const received = Number(payReceived) || total;
    const pm = paymentMethods.find((p: any) => p.key === payMethod);
    const change = pm?.allowsChange ? Math.max(0, received - total) : 0;
    setLoading(true);
    try {
      await api.updatePosOrderStatus(selectedOrder.id, 'paid', `Оплачено: ${pm?.name || payMethod}`);
      await api.request('/api/pos/receipts', {
        method: 'POST',
        body: JSON.stringify({ orderId: selectedOrder.id, shiftId, total, paymentMethod: payMethod, paymentAmount: received, changeAmount: change }),
      });
      onMessage(`Заказ #${selectedOrder.id} оплачен`);
      setShowPay(false);
      await loadOrders();
      const updated = await api.request(`/api/pos/orders/${selectedOrder.id}`);
      setSelectedOrder(updated);
    } catch (e: any) { onMessage(e.message); }
    setLoading(false);
  };

  const filteredOrders = useMemo(() => orders, [orders]);

  const activeStatuses = ['new', 'confirmed', 'preparing', 'ready', 'served', 'assigned', 'en_route'];

  return (
    <div className="flex-1 flex flex-col min-w-0 p-4">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по номеру или гостю..." className={`w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none border ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300'}`} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className={`px-3 py-2 rounded-xl text-sm outline-none border ${darkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300'}`}>
          <option value="all">Все активные</option>
          <option value="new">Новые</option>
          <option value="preparing">Готовятся</option>
          <option value="ready">Готовы</option>
          <option value="delivery">Доставка</option>
          <option value="paid">Оплаченные</option>
          <option value="cancelled">Отменённые</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pb-4">
        {filteredOrders.map(o => (
          <button key={o.id} onClick={() => setSelectedOrder(o)} className={`text-left p-4 rounded-2xl border transition hover:scale-[1.01] ${darkMode ? 'bg-zinc-900 border-zinc-800 hover:border-orange-500' : 'bg-white border-zinc-200 hover:border-orange-400'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold">#{o.id}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] || 'bg-zinc-700 text-zinc-400'}`}>{STATUS_LABELS[o.status] || o.status}</span>
            </div>
            <p className="text-sm font-medium truncate">{o.userName || 'Гость'}</p>
            <p className="text-xs opacity-60 mb-2">{o.type === 'delivery' ? 'Доставка' : o.type === 'pickup' ? 'Самовывоз' : 'В зале'} · {new Date(o.createdAt).toLocaleString('ru-RU')}</p>
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-60">{(o.items || []).length} поз.</span>
              <span className="font-bold text-orange-500">{o.total}{CURRENCY}</span>
            </div>
          </button>
        ))}
      </div>

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          couriers={couriers}
          paymentMethods={paymentMethods}
          darkMode={darkMode}
          loading={loading}
          onClose={() => setSelectedOrder(null)}
          onStatus={handleStatus}
          onAssignCourier={handleAssignCourier}
          onUpdateItems={handleUpdateItems}
          onCancel={() => setShowCancel(true)}
          onPay={() => setShowPay(true)}
        />
      )}

      {showCancel && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-red-400"><AlertTriangle size={20} /> Отмена заказа #{selectedOrder.id}</h2>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Причина отмены..." className={`w-full p-3 rounded-xl border mb-4 text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} rows={3} />
            <div className="flex gap-2">
              <button onClick={() => setShowCancel(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Отмена</button>
              <button onClick={handleCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Подтвердить</button>
            </div>
          </div>
        </div>
      )}

      {showPay && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><CreditCard size={20} /> Оплата #{selectedOrder.id}</h2>
            <p className="text-3xl font-bold text-center mb-4">{selectedOrder.total}{CURRENCY}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {paymentMethods.filter((p: any) => p.isActive).map((pm: any) => (
                <button key={pm.id} onClick={() => setPayMethod(pm.key)} className={`p-2 rounded-xl border text-sm font-semibold ${payMethod === pm.key ? 'bg-orange-600 text-white border-orange-600' : (darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300')}`}>{pm.name}</button>
              ))}
            </div>
            {paymentMethods.find((p: any) => p.key === payMethod)?.allowsChange && (
              <div className="mb-4">
                <label className="text-xs opacity-70">Получено</label>
                <input type="number" value={payReceived} onChange={e => setPayReceived(e.target.value)} className={`w-full mt-1 px-3 py-2 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowPay(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-700 text-white text-sm font-semibold">Отмена</button>
              <button onClick={handlePay} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold">Оплатить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderModal({ order, couriers, paymentMethods, darkMode, loading, onClose, onStatus, onAssignCourier, onUpdateItems, onCancel, onPay }: any) {
  const [items, setItems] = useState<any[]>(order.items || []);
  const [editItems, setEditItems] = useState(false);

  useEffect(() => { setItems(order.items || []); }, [order.items]);

  const isEditable = ['new', 'confirmed'].includes(order.status);
  const canPay = ['ready', 'served', 'assigned', 'en_route', 'delivered'].includes(order.status) && order.status !== 'paid';

  const updateQty = (idx: number, delta: number) => {
    const next = items.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, (it.quantity || 1) + delta) } : it).filter(it => it.quantity > 0);
    setItems(next);
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const saveItems = () => { onUpdateItems(items); setEditItems(false); };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 ${darkMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">Заказ #{order.id}</h2>
            <p className="text-xs opacity-60">{new Date(order.createdAt).toLocaleString('ru-RU')}</p>
          </div>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[order.status] || 'bg-zinc-700 text-zinc-400'}`}>{STATUS_LABELS[order.status] || order.status}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">{order.type === 'delivery' ? 'Доставка' : order.type === 'pickup' ? 'Самовывоз' : 'В зале'}</span>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm ${darkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
          <div className="flex items-center gap-2"><User size={14} /> {order.userName || 'Гость'}</div>
          {order.userPhone && <div className="flex items-center gap-2"><Phone size={14} /> {order.userPhone}</div>}
          {order.address && <div className="flex items-center gap-2"><MapPin size={14} /> {order.address}</div>}
          {order.tableId && <div className="flex items-center gap-2">Стол #{order.tableId}</div>}
          {order.courierName && <div className="flex items-center gap-2"><Truck size={14} /> {order.courierName}</div>}
        </div>

        <h3 className="font-bold mb-2 text-sm flex items-center gap-2"><ChefHat size={16} /> Состав</h3>
        <div className="space-y-2 mb-4">
          {items.map((item, idx) => (
            <div key={idx} className={`flex justify-between items-center p-2 rounded-lg text-sm ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{item.name}</span>
                {item.options?.length > 0 && <span className="text-xs opacity-60 ml-2">{item.options.join(', ')}</span>}
              </div>
              {editItems ? (
                <div className="flex items-center gap-2 ml-2">
                  <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 rounded bg-zinc-700 text-white flex items-center justify-center"><Minus size={12} /></button>
                  <span className="w-5 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 rounded bg-zinc-700 text-white flex items-center justify-center"><Plus size={12} /></button>
                  <button onClick={() => removeItem(idx)} className="text-red-400 ml-1"><Trash2 size={14} /></button>
                </div>
              ) : (
                <span className="ml-2 opacity-80">{item.quantity} x {item.price}{CURRENCY}</span>
              )}
            </div>
          ))}
        </div>

        {isEditable && (
          <div className="mb-4">
            {!editItems ? (
              <button onClick={() => setEditItems(true)} className="text-sm text-orange-500 font-semibold">Редактировать состав</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditItems(false)} className="px-3 py-1.5 rounded-lg bg-zinc-700 text-white text-xs">Отмена</button>
                <button onClick={saveItems} disabled={loading} className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold">Сохранить</button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between text-xl font-bold mb-4">
          <span>Итого</span>
          <span>{order.total}{CURRENCY}</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {order.status === 'new' && <button onClick={() => onStatus('confirmed')} disabled={loading} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Принять</button>}
          {(order.status === 'new' || order.status === 'confirmed') && <button onClick={() => onStatus('preparing', 'Отправлен на кухню')} disabled={loading} className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-1"><ChefHat size={12} /> На кухню</button>}
          {order.status === 'preparing' && <button onClick={() => onStatus('ready')} disabled={loading} className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold">Готово</button>}
          {order.status === 'ready' && order.type !== 'delivery' && <button onClick={() => onStatus('served')} disabled={loading} className="px-3 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold">Подать</button>}
          {canPay && <button onClick={onPay} disabled={loading} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"><CreditCard size={12} /> Оплатить</button>}
          {order.type === 'delivery' && (order.status === 'ready' || order.status === 'confirmed' || order.status === 'preparing') && (
            <select disabled={loading} onChange={e => { if (e.target.value) { onAssignCourier(Number(e.target.value)); e.target.value = ''; } }} className={`px-3 py-2 rounded-xl text-xs outline-none border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`}>
              <option value="">Назначить курьера</option>
              {couriers.filter((c: any) => c.isOnline || c.isAvailable).map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.isOnline ? '(на линии)' : ''}</option>)}
            </select>
          )}
          {!['paid', 'closed', 'cancelled'].includes(order.status) && <button onClick={onCancel} disabled={loading} className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-bold ml-auto">Отменить</button>}
        </div>

        {order.comment && <p className="text-xs opacity-60 mb-4">Комментарий: {order.comment}</p>}

        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex-1 py-2 rounded-xl bg-zinc-700 text-white text-xs font-semibold flex items-center justify-center gap-1"><Printer size={14} /> Печать</button>
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-zinc-700 text-white text-xs font-semibold">Закрыть</button>
        </div>
      </div>
    </div>
  );
}
