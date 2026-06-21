import { useState, useEffect, useCallback } from 'react';
import { History, Calendar, ChevronDown } from 'lucide-react';
import * as api from '../../api';
import type { Order } from '../../types';

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('foodchain_waiter_user') || '{}');
      const all = await api.getOrders({ status: 'closed' });
      const waiterOrders = all.filter(o => o.waiterId === user.id);
      setOrders(waiterOrders.filter(o => o.createdAt?.startsWith(dateFilter)));
    } catch { setOrders([]); }
    setLoading(false);
  }, [dateFilter]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders = orders.length;

  return (
    <div className="pb-28 px-4 pt-4">
      <h2 className="text-lg font-extrabold text-white mb-4 flex items-center gap-2">
        <History size={20} className="text-orange-500" /> История заказов
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
          <p className="text-xs text-zinc-500">Заказов</p>
          <p className="text-2xl font-extrabold text-white">{totalOrders}</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-4 ring-1 ring-zinc-800">
          <p className="text-xs text-zinc-500">Выручка</p>
          <p className="text-2xl font-extrabold text-orange-500">{totalRevenue}₽</p>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2 bg-zinc-900 rounded-xl px-3 py-2 ring-1 ring-zinc-800 mb-4">
        <Calendar size={16} className="text-zinc-500" />
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="flex-1 bg-transparent text-sm text-white outline-none" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Загрузка...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <History size={48} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 font-semibold">Нет закрытых заказов</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <div key={order.id} className="bg-zinc-900 rounded-xl p-3 ring-1 ring-zinc-800">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-white">Заказ #{order.id}</span>
                <span className="text-sm font-extrabold text-orange-500">{order.total}₽</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>{order.tableNumber ? `Стол ${order.tableNumber}` : order.type === 'delivery' ? 'Доставка' : 'Самовывоз'}</span>
                <span>·</span>
                <span>{new Date(order.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
                {order.paymentMethod && <><span>·</span><span>{order.paymentMethod}</span></>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
