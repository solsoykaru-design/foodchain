import { useState, useEffect } from 'react';
import { 
  Package, Clock, CheckCircle, CreditCard, XCircle, Archive,
  Filter, RefreshCw, ChefHat, Wine, Flame, Eye
} from 'lucide-react';
import * as api from '../../api';

type OrderStatus = 'new' | 'preparing' | 'ready' | 'paid' | 'cancelled' | 'closed';
type Zone = 'all' | 'kitchen' | 'bar' | 'hookah';

interface Order {
  id: number;
  user_name: string;
  address: string;
  items: any[];
  subtotal: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG = {
  new: { label: 'Новые', icon: Package, color: 'yellow', bg: 'bg-yellow-900/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  preparing: { label: 'В работе', icon: Clock, color: 'blue', bg: 'bg-blue-900/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  ready: { label: 'Готовы', icon: CheckCircle, color: 'green', bg: 'bg-green-900/20', text: 'text-green-400', border: 'border-green-500/30' },
  paid: { label: 'Оплачены', icon: CreditCard, color: 'purple', bg: 'bg-purple-900/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  cancelled: { label: 'Отменены', icon: XCircle, color: 'red', bg: 'bg-red-900/20', text: 'text-red-400', border: 'border-red-500/30' },
  closed: { label: 'Закрыты', icon: Archive, color: 'gray', bg: 'bg-zinc-900/20', text: 'text-zinc-400', border: 'border-zinc-500/30' },
};

const ZONE_CONFIG = {
  kitchen: { label: 'Кухня', icon: ChefHat, color: 'orange' },
  bar: { label: 'Бар', icon: Wine, color: 'blue' },
  hookah: { label: 'Кальянная', icon: Flame, color: 'purple' },
};

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('new');
  const [zoneFilter, setZoneFilter] = useState<Zone>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await api.request('/api/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load orders error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    
    const handleUpdate = () => loadOrders();
    window.addEventListener('voiceOrdersUpdated', handleUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('voiceOrdersUpdated', handleUpdate);
    };
  }, []);

  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    
    if (zoneFilter !== 'all') {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const hasZone = items.some((item: any) => item.zone === zoneFilter);
      if (!hasZone) return false;
    }
    
    return true;
  });

  const getStatusCounts = () => {
    const counts: Record<string, number> = { all: orders.length };
    for (const status of Object.keys(STATUS_CONFIG)) {
      counts[status] = orders.filter(o => o.status === status).length;
    }
    return counts;
  };

  const counts = getStatusCounts();

  const updateOrderStatus = async (orderId: number, newStatus: OrderStatus) => {
    try {
      await api.request(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      loadOrders();
    } catch (e) {
      console.error('Update status error:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
            statusFilter === 'all'
              ? 'bg-orange-500 text-white'
              : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
          }`}
        >
          <Package className="w-4 h-4" />
          Все
          <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full">{counts.all}</span>
        </button>

        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status as OrderStatus)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? `${config.bg} ${config.text} ring-1 ${config.border}`
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {config.label}
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full">{counts[status] || 0}</span>
            </button>
          );
        })}
      </div>

      {/* Zone Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setZoneFilter('all')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            zoneFilter === 'all'
              ? 'bg-zinc-700 text-white'
              : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Все зоны
        </button>

        {Object.entries(ZONE_CONFIG).map(([zone, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={zone}
              onClick={() => setZoneFilter(zone as Zone)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                zoneFilter === zone
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {config.label}
            </button>
          );
        })}

        <button
          onClick={loadOrders}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Orders Grid */}
      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
          <p className="text-zinc-500">Нет заказов</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.new;
            const Icon = config.icon;
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            const tableMatch = order.address?.match(/Стол\s+(\d+)/);
            const table = tableMatch ? tableMatch[1] : '—';

            return (
              <div
                key={order.id}
                className={`${config.bg} border ${config.border} rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-transform`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold text-white">#{order.id}</span>
                      <Icon className={`w-5 h-5 ${config.text}`} />
                    </div>
                    <p className="text-sm text-zinc-400">Стол {table}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{order.subtotal}₽</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(order.created_at).toLocaleTimeString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  {items.slice(0, 3).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300 truncate">
                        {item.quantity}× {item.name}
                      </span>
                      {item.zone && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.zone === 'kitchen' ? 'bg-orange-900/30 text-orange-400' :
                          item.zone === 'bar' ? 'bg-blue-900/30 text-blue-400' :
                          'bg-purple-900/30 text-purple-400'
                        }`}>
                          {ZONE_CONFIG[item.zone as keyof typeof ZONE_CONFIG]?.label}
                        </span>
                      )}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <p className="text-xs text-zinc-500">+{items.length - 3} ещё...</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <span className={`text-xs font-medium ${config.text}`}>
                    {config.label}
                  </span>
                  <p className="text-xs text-zinc-500">{order.user_name}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div 
            className="bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Заказ #{selectedOrder.id}
                  </h2>
                  <p className="text-zinc-400">{selectedOrder.address}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {new Date(selectedOrder.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                {(typeof selectedOrder.items === 'string' ? JSON.parse(selectedOrder.items) : selectedOrder.items).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-800/50 rounded-xl p-3">
                    <div>
                      <p className="text-white font-medium">{item.name}</p>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <p className="text-xs text-zinc-500 mt-1">
                          {item.modifiers.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{item.quantity}× {item.price}₽</p>
                      {item.zone && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.zone === 'kitchen' ? 'bg-orange-900/30 text-orange-400' :
                          item.zone === 'bar' ? 'bg-blue-900/30 text-blue-400' :
                          'bg-purple-900/30 text-purple-400'
                        }`}>
                          {ZONE_CONFIG[item.zone as keyof typeof ZONE_CONFIG]?.label}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-6 pt-4 border-t border-zinc-800">
                <span className="text-xl font-bold text-white">Итого:</span>
                <span className="text-2xl font-bold text-orange-500">{selectedOrder.subtotal}₽</span>
              </div>

              <div className="flex gap-2">
                {selectedOrder.status === 'new' && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'preparing');
                      setSelectedOrder(null);
                    }}
                    className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700"
                  >
                    Принять в работу
                  </button>
                )}
                {selectedOrder.status === 'preparing' && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'ready');
                      setSelectedOrder(null);
                    }}
                    className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700"
                  >
                    Готово
                  </button>
                )}
                {selectedOrder.status === 'ready' && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'paid');
                      setSelectedOrder(null);
                    }}
                    className="flex-1 bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700"
                  >
                    Оплачено
                  </button>
                )}
                <button
                  onClick={() => {
                    updateOrderStatus(selectedOrder.id, 'cancelled');
                    setSelectedOrder(null);
                  }}
                  className="px-6 bg-red-600/20 text-red-400 font-bold py-3 rounded-xl hover:bg-red-600/30"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
