import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LayoutDashboard, RefreshCw, Wifi, WifiOff, Mic, MicOff,
  ChefHat, Coffee, Flame, ClipboardList, Search, Filter,
  X, CheckCircle, Clock, AlertCircle, Trash2, Edit3, Printer,
  Plus, ChevronDown, ChevronUp, Headset, TrendingUp, Users,
} from 'lucide-react';
import * as api from '../../api';
import { useWaiterSocket } from '../hooks/useWaiterSocket';

interface OrderItem {
  dishId?: number;
  name: string;
  price: number;
  quantity: number;
  modifiers?: string[];
  zone?: 'kitchen' | 'bar' | 'hookah' | null;
}

interface Order {
  id: number;
  table?: number;
  tableId?: number;
  userName: string;
  userId: number;
  items: OrderItem[];
  total: number;
  status: string;
  zone?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
  paymentMethod?: string;
}

interface VoiceDashboardProps {
  user: any;
  dishes: any[];
  tables: any[];
  onOpenVoice: () => void;
}

const STATUS_TABS = [
  { key: 'new', label: 'Новые', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { key: 'preparing', label: 'В работе', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'ready', label: 'Готовы', color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'paid', label: 'Оплачены', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { key: 'cancelled', label: 'Отменены', color: 'text-red-400', bg: 'bg-red-500/10' },
  { key: 'closed', label: 'Закрыты', color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
];

const ZONE_OPTIONS = [
  { key: 'all', label: 'Все' },
  { key: 'kitchen', label: 'Кухня', icon: ChefHat, color: 'text-orange-400' },
  { key: 'bar', label: 'Бар', icon: Coffee, color: 'text-blue-400' },
  { key: 'hookah', label: 'Кальянная', icon: Flame, color: 'text-purple-400' },
];

const TIME_OPTIONS = [
  { key: 'today', label: 'Сегодня' },
  { key: '24h', label: '24 часа' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
];

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый', confirmed: 'Принят', preparing: 'Готовится', ready: 'Готов',
  served: 'Подан', paid: 'Оплачен', closed: 'Закрыт', cancelled: 'Отменён', refunded: 'Возвращён',
};

const ZONE_LABELS: Record<string, string> = {
  kitchen: 'Кухня', bar: 'Бар', hookah: 'Кальянная',
};

function formatTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function parseTable(order: Order): number {
  if (order.table) return order.table;
  if (order.tableId) return order.tableId;
  const fromAddress = String(order.items?.[0]?.name || '');
  const m = String(order.items?.[0]?.name || '').match(/стол\s*(\d+)/i);
  if (m) return Number(m[1]);
  return 0;
}

function getOrderZone(order: Order): string {
  if (order.zone) return order.zone;
  const zones = new Set<string>();
  for (const item of order.items || []) {
    if (item.zone) zones.add(item.zone);
  }
  if (zones.size === 1) return Array.from(zones)[0];
  return 'mixed';
}

export default function VoiceDashboard({ user, dishes, tables, onOpenVoice }: VoiceDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState('new');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('today');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'table' | 'status'>('time');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeWaiters, setActiveWaiters] = useState(0);
  const [showManualForm, setShowManualForm] = useState(false);
  const [historyLog, setHistoryLog] = useState<{ status: string; at: string }[]>([]);
  const ttsEnabled = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load orders
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getOrdersMultiStatus(STATUS_TABS.map(t => t.key));
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load orders error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load active headsets count
  const loadActiveWaiters = useCallback(async () => {
    try {
      const data = await api.request('/api/voice/headsets/active');
      setActiveWaiters(Array.isArray(data) ? data.length : 0);
    } catch {}
  }, []);

  useEffect(() => {
    loadOrders();
    loadActiveWaiters();
    const id = setInterval(() => {
      loadOrders();
      loadActiveWaiters();
    }, 5000);
    return () => clearInterval(id);
  }, [loadOrders, loadActiveWaiters]);

  // WebSocket for realtime updates
  useWaiterSocket({
    'order:new': () => loadOrders(),
    'order:update': () => loadOrders(),
    'order:status': (data) => {
      if (data.status === 'ready') {
        const order = orders.find(o => o.id === data.orderId);
        if (order) speak(`Стол ${parseTable(order)}, заказ готов`);
      }
      loadOrders();
    },
    'ordersUpdated': () => loadOrders(),
  });

  // Connection indicator
  useEffect(() => {
    const onOnline = () => setConnected(true);
    const onOffline = () => setConnected(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setConnected(navigator.onLine);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Notification sound
  useEffect(() => {
    audioRef.current = new Audio('/sounds/notification.mp3');
  }, []);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled.current) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  const filteredOrders = useMemo(() => {
    let list = orders.filter(o => o.status === activeTab);

    if (zoneFilter !== 'all') {
      list = list.filter(o => getOrderZone(o) === zoneFilter);
    }

    const now = new Date();
    list = list.filter(o => {
      const d = new Date(o.createdAt);
      if (timeFilter === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (timeFilter === '24h') {
        return now.getTime() - d.getTime() < 24 * 60 * 60 * 1000;
      }
      if (timeFilter === 'week') {
        return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
      }
      if (timeFilter === 'month') {
        return now.getTime() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
      }
      return true;
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        String(o.id).includes(q) ||
        o.userName?.toLowerCase().includes(q) ||
        String(parseTable(o)).includes(q) ||
        o.items?.some(i => i.name.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'time') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'table') {
      list.sort((a, b) => parseTable(a) - parseTable(b));
    }

    return list;
  }, [orders, activeTab, zoneFilter, timeFilter, search, sortBy]);

  const stats = useMemo(() => {
    const today = new Date();
    const shiftOrders = orders.filter(o => {
      const d = new Date(o.createdAt);
      return d.toDateString() === today.toDateString();
    });
    return {
      total: shiftOrders.length,
      active: orders.filter(o => ['new', 'preparing', 'ready'].includes(o.status)).length,
      ready: orders.filter(o => o.status === 'ready').length,
      paid: orders.filter(o => o.status === 'paid').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      kitchen: orders.filter(o => getOrderZone(o) === 'kitchen' && ['new', 'preparing', 'ready'].includes(o.status)).length,
      bar: orders.filter(o => getOrderZone(o) === 'bar' && ['new', 'preparing', 'ready'].includes(o.status)).length,
      hookah: orders.filter(o => getOrderZone(o) === 'hookah' && ['new', 'preparing', 'ready'].includes(o.status)).length,
    };
  }, [orders]);

  const handleStatusChange = async (order: Order, status: string, note?: string) => {
    try {
      await api.updateOrderStatus(order.id, status as any, note);
      if (status === 'ready') {
        speak(`Стол ${parseTable(order)}, заказ готов`);
        audioRef.current?.play().catch(() => {});
      }
      loadOrders();
    } catch (e: any) { alert(e.message); }
  };

  const openDetails = async (order: Order) => {
    setSelectedOrder(order);
    try {
      const full = await api.getOrder(order.id);
      if (full?.statusHistory) {
        setHistoryLog(full.statusHistory.map((h: any) => ({ status: h.status, at: h.createdAt })));
      } else {
        setHistoryLog([{ status: order.status, at: order.updatedAt }]);
      }
    } catch {
      setHistoryLog([{ status: order.status, at: order.updatedAt }]);
    }
  };

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Top Panel */}
      <div className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center font-bold text-sm">T</div>
              <div>
                <h1 className="font-bold text-sm">AI-официант</h1>
                <p className="text-[10px] text-zinc-500">{now.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/50 rounded-lg text-[10px] text-zinc-400">
                <Headset size={12} />
                {activeWaiters} гарнитур
              </div>

              <button
                onClick={() => setVoiceMode(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${voiceMode ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-400'}`}
              >
                {voiceMode ? <Mic size={14} /> : <MicOff size={14} />}
                <span className="hidden sm:inline">{voiceMode ? 'Голос ON' : 'Голос OFF'}</span>
              </button>

              <button onClick={() => { loadOrders(); loadActiveWaiters(); }} disabled={loading}
                className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white disabled:opacity-50">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>

              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                {connected ? <Wifi size={12} className="text-green-500" /> : <WifiOff size={12} className="text-red-500" />}
                <span className="hidden sm:inline">{connected ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-3">
            {[
              { label: 'Всего', value: stats.total, icon: ClipboardList },
              { label: 'Актив', value: stats.active, icon: TrendingUp },
              { label: 'Готовы', value: stats.ready, icon: CheckCircle },
              { label: 'Оплач', value: stats.paid, icon: Clock },
              { label: 'Отмен', value: stats.cancelled, icon: AlertCircle },
              { label: '🍳', value: stats.kitchen, icon: ChefHat },
              { label: '🍹', value: stats.bar, icon: Coffee },
              { label: '💨', value: stats.hookah, icon: Flame },
            ].map((s, i) => (
              <div key={i} className="bg-zinc-800/40 rounded-lg px-2 py-1.5 text-center">
                <p className="text-xs font-bold text-white">{s.value}</p>
                <p className="text-[9px] text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {STATUS_TABS.map(tab => {
            const count = orders.filter(o => o.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                  activeTab === tab.key ? `${tab.bg} ${tab.color} ring-1 ring-current` : 'bg-zinc-900 text-zinc-500'
                }`}
              >
                {tab.label} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="relative flex-1 min-w-[140px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по столу, блюду..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-orange-500"
            />
          </div>

          <select
            value={zoneFilter}
            onChange={e => setZoneFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
          >
            {ZONE_OPTIONS.map(z => <option key={z.key} value={z.key}>{z.label}</option>)}
          </select>

          <select
            value={timeFilter}
            onChange={e => setTimeFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
          >
            {TIME_OPTIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
          >
            <option value="time">По времени</option>
            <option value="table">По столу</option>
          </select>
        </div>
      </div>

      {/* Orders grid */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
            <ClipboardList size={48} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Нет заказов в этой категории</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOrders.map(order => {
              const zone = getOrderZone(order);
              const zoneColor = zone === 'kitchen' ? 'text-orange-400' : zone === 'bar' ? 'text-blue-400' : zone === 'hookah' ? 'text-purple-400' : 'text-zinc-400';
              const zoneBg = zone === 'kitchen' ? 'bg-orange-500/10' : zone === 'bar' ? 'bg-blue-500/10' : zone === 'hookah' ? 'bg-purple-500/10' : 'bg-zinc-800';
              return (
                <div key={order.id} className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 hover:border-zinc-700 transition">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">#{order.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${zoneBg} ${zoneColor}`}>
                          {ZONE_LABELS[zone] || 'Смешанная'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">Стол {parseTable(order) || '—'} · {order.userName}</p>
                    </div>
                    <span className="text-sm font-bold text-white">{order.total}₽</span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {order.items?.slice(0, 4).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 truncate flex-1">{item.name} {item.modifiers?.length ? `(${item.modifiers.join(', ')})` : ''}</span>
                        <span className="text-zinc-500 ml-2">×{item.quantity}</span>
                      </div>
                    ))}
                    {(order.items?.length || 0) > 4 && (
                      <p className="text-[10px] text-zinc-600">+ ещё {(order.items?.length || 0) - 4}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-3">
                    <span>{formatTime(order.createdAt)}</span>
                    <span className="text-zinc-400">{STATUS_LABELS[order.status] || order.status}</span>
                  </div>

                  <div className="flex gap-2">
                    {order.status === 'new' && (
                      <button onClick={() => handleStatusChange(order, 'preparing', 'Принят к работе')}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-xl transition">
                        Принять
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button onClick={() => handleStatusChange(order, 'ready', 'Готов')}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-2 rounded-xl transition">
                        Готово
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button onClick={() => handleStatusChange(order, 'paid', 'Оплачен')}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-2 rounded-xl transition">
                        Оплачено
                      </button>
                    )}
                    <button onClick={() => openDetails(order)}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition">
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating voice button */}
      <button
        onClick={onOpenVoice}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-xl shadow-orange-500/30 active:scale-95 hover:scale-105 transition-all"
      >
        <Mic size={24} className="text-white" />
      </button>

      {/* Manual create button */}
      <button
        onClick={() => setShowManualForm(true)}
        className="fixed bottom-20 left-4 z-40 w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white active:scale-95 transition"
      >
        <Plus size={20} />
      </button>

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          history={historyLog}
          dishes={dishes}
          tables={tables}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          onRefresh={loadOrders}
        />
      )}

      {/* Manual form modal placeholder */}
      {showManualForm && (
        <ManualOrderModal
          user={user}
          dishes={dishes}
          tables={tables}
          onClose={() => setShowManualForm(false)}
          onCreated={() => { setShowManualForm(false); loadOrders(); }}
        />
      )}
    </div>
  );
}

function OrderDetailModal({ order, history, onClose, onStatusChange }: {
  order: Order;
  history: { status: string; at: string }[];
  dishes: any[];
  tables: any[];
  onClose: () => void;
  onStatusChange: (o: Order, s: string, n?: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-800" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">Заказ #{order.id}</h2>
            <p className="text-xs text-zinc-500">Стол {parseTable(order)} · {order.userName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl"><X size={18} className="text-zinc-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-2">
                <div>
                  <p className="text-sm text-white">{item.name}</p>
                  {item.modifiers?.length ? <p className="text-[10px] text-zinc-500">{item.modifiers.join(', ')}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">×{item.quantity}</p>
                  <p className="text-[10px] text-zinc-500">{item.price * item.quantity}₽</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
            <span className="text-sm text-zinc-400">Итого</span>
            <span className="text-lg font-bold text-white">{order.total}₽</span>
          </div>

          {order.comment && (
            <div className="bg-zinc-800/30 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 mb-1">Комментарий</p>
              <p className="text-sm text-zinc-300">{order.comment}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] text-zinc-500 mb-2">История статусов</p>
            <div className="space-y-1.5">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{STATUS_LABELS[h.status] || h.status}</span>
                  <span className="text-zinc-600">{formatDateTime(h.at)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {order.status !== 'cancelled' && order.status !== 'closed' && (
              <button onClick={() => { onStatusChange(order, 'cancelled', 'Отменён вручную'); onClose(); }}
                className="flex-1 bg-red-500/20 text-red-400 text-xs font-semibold py-2.5 rounded-xl transition">
                Отмена
              </button>
            )}
            <button onClick={() => { /* print */ }}
              className="flex-1 bg-zinc-800 text-zinc-400 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1 transition">
              <Printer size={14} /> Печать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualOrderModal({ user, dishes, tables, onClose, onCreated }: {
  user: any;
  dishes: any[];
  tables: any[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tableId, setTableId] = useState<number | ''>('');
  const [selectedItems, setSelectedItems] = useState<{ dishId: number; name: string; price: number; quantity: number; zone?: string }[]>([]);
  const [sending, setSending] = useState(false);

  const addDish = (dish: any) => {
    const existing = selectedItems.find(i => i.dishId === dish.id);
    if (existing) {
      setSelectedItems(selectedItems.map(i => i.dishId === dish.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setSelectedItems([...selectedItems, { dishId: dish.id, name: dish.name, price: dish.price, quantity: 1, zone: dish.zone }]);
    }
  };

  const submit = async () => {
    if (!tableId || selectedItems.length === 0) return;
    setSending(true);
    try {
      const table = tables.find(t => t.id === Number(tableId));
      await api.createDineInOrder({
        tableId: Number(tableId),
        waiterId: user.id,
        waiterName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        items: selectedItems.map(i => ({
          dishId: i.dishId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          options: [],
          zone: i.zone,
        })),
        guestCount: table?.capacity || 2,
      });
      onCreated();
    } catch (e: any) { alert(e.message); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-800" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Создать заказ вручную</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl"><X size={18} className="text-zinc-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <select
            value={tableId}
            onChange={e => setTableId(Number(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white"
          >
            <option value="">Выберите стол</option>
            {tables.map(t => <option key={t.id} value={t.id}>Стол {t.name}</option>)}
          </select>

          <div className="max-h-40 overflow-y-auto space-y-1 bg-zinc-800/30 rounded-xl p-2">
            {dishes.slice(0, 50).map(d => (
              <button key={d.id} onClick={() => addDish(d)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 text-xs text-zinc-300 flex justify-between">
                <span>{d.name}</span>
                <span className="text-zinc-500">{d.price}₽</span>
              </button>
            ))}
          </div>

          {selectedItems.length > 0 && (
            <div className="space-y-1">
              {selectedItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-2">
                  <span className="text-sm text-white">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedItems(selectedItems.map((i, j) => j === idx && i.quantity > 1 ? { ...i, quantity: i.quantity - 1 } : i).filter((i, j) => j !== idx || i.quantity > 1))}
                      className="text-zinc-500 hover:text-white">-</button>
                    <span className="text-sm text-white">×{item.quantity}</span>
                    <button onClick={() => setSelectedItems(selectedItems.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i))}
                      className="text-zinc-500 hover:text-white">+</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={submit} disabled={!tableId || selectedItems.length === 0 || sending}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
            {sending ? 'Создание...' : 'Создать заказ'}
          </button>
        </div>
      </div>
    </div>
  );
}
