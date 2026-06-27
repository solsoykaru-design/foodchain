import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Coffee, ClipboardList, Wallet, History, MessageSquare,
  Bell, BellRing, AlertTriangle, LogOut,
} from 'lucide-react';
import * as api from '../api';
import type { Table, DineInCheck, WaiterCall, Dish, MenuCategory, Order } from '../types';
import HallPlan from './components/HallPlan';
import TableCard from './components/TableCard';
import MenuGrid from './components/MenuGrid';
import type { CartItem, OrderOptions } from './components/MenuGrid';
import ActiveOrders from './components/ActiveOrders';
import PaymentScreen from './components/PaymentScreen';
import OrderHistory from './components/OrderHistory';
import KitchenChat from './components/KitchenChat';
import WaiterChat from './components/WaiterChat';
import QuickTemplates from './components/QuickTemplates';
import VoiceOrder from './components/VoiceOrder';
import { useWaiterSocket } from './hooks/useWaiterSocket';
import type { ChatInfo } from '../types';

type Tab = 'hall' | 'menu' | 'orders' | 'payment' | 'history' | 'chat';

export default function WaiterApp({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('hall');
  const [tables, setTables] = useState<Table[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [checks, setChecks] = useState<DineInCheck[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableCardOpen, setTableCardOpen] = useState(false);
  const [voiceOrderOpen, setVoiceOrderOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);

  // ─── WebSocket ──────────────────────────────────────────────
  useWaiterSocket({
    'order:status': (data) => {
      if (data.status === 'ready' || data.status === 'preparing') {
        setNotifications(prev => [...prev.slice(-19), `Заказ #${data.orderId}: ${data.status === 'ready' ? 'Готов' : 'Готовится'}`]);
        notifAudioRef.current?.play().catch(() => {});
      }
      loadChecks();
      loadTables();
    },
    'kitchen:ready': () => { loadChecks(); },
    'table:status': () => { loadTables(); },
    'chat:message': (data) => {
      if (data.message?.senderType === 'guest' && tab !== 'chat') {
        setChatUnread(prev => prev + 1);
        notifAudioRef.current?.play().catch(() => {});
      }
    },
  });

  // ─── Data loading ──────────────────────────────────────────
  const loadTables = useCallback(async () => {
    try { setTables(await api.getWaiterTables()); } catch {}
  }, []);

  const loadMenu = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api.getDishes(), api.getMenuCategories()]);
      setDishes(d);
      setCategories(c);
    } catch {}
  }, []);

  const loadChecks = useCallback(async () => {
    try { setChecks(await api.getActiveChecks(user.id)); } catch {}
  }, [user.id]);

  const loadCalls = useCallback(async () => {
    try { setWaiterCalls(await api.request('/api/waiter/calls/pending')); } catch {}
  }, []);

  useEffect(() => {
    loadTables();
    loadMenu();
    loadChecks();
    loadCalls();
    const interval = setInterval(() => {
      loadTables();
      loadChecks();
      loadCalls();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadTables, loadChecks, loadMenu, loadCalls]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    setTableCardOpen(true);
  };

  const handleResolveCall = async (callId: number) => {
    try {
      await api.request(`/api/waiter/call/${callId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolvedBy: user.id }),
      });
      setWaiterCalls(prev => prev.filter(c => c.id !== callId));
    } catch {}
  };

  const handleSendOrder = async (items: CartItem[], opts: OrderOptions) => {
    try {
      const tableId = selectedTable?.id;
      if (opts.orderType === 'dine_in' && !tableId) return;
      await api.createDineInOrder({
        tableId: tableId || 0,
        waiterId: user.id,
        waiterName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        items: items.map(i => ({
          dishId: i.dish.id,
          name: i.dish.name,
          price: i.unitPrice,
          quantity: i.quantity,
          options: i.modifiers,
          comment: i.comment,
        })),
        guestCount: selectedTable?.capacity || 2,
        type: opts.orderType,
        discount: opts.discountValue > 0 ? {
          type: opts.discountType,
          value: opts.discountValue,
        } : undefined,
        comment: opts.orderComment,
        ...(opts.orderType === 'delivery' ? {
          deliveryName: opts.deliveryFields?.name,
          deliveryPhone: opts.deliveryFields?.phone,
          deliveryAddress: opts.deliveryFields?.address,
          deliveryComment: opts.deliveryFields?.comment,
        } : {}),
        ...(opts.orderType === 'pickup' ? { pickupPointId: opts.pickupPointId } : {}),
      });
      setTab('orders');
      setTableCardOpen(false);
      loadChecks();
      loadTables();
    } catch (e: any) { alert(e.message); }
  };

  const handleApplyTemplate = async (templateItems: { dishId: number; quantity: number; modifiers: string[] }[]) => {
    if (!selectedTable) return;
    try {
      await api.createDineInOrder({
        tableId: selectedTable.id,
        waiterId: user.id,
        waiterName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        items: templateItems.map(i => ({
          dishId: i.dishId,
          name: dishes.find(d => d.id === i.dishId)?.name || '',
          price: dishes.find(d => d.id === i.dishId)?.price || 0,
          quantity: i.quantity,
          options: i.modifiers,
        })),
        guestCount: selectedTable.capacity || 2,
      });
      setTab('orders');
      setTableCardOpen(false);
      loadChecks();
      loadTables();
    } catch (e: any) { alert(e.message); }
  };

  const handlePayOrder = (order: Order) => {
    setTab('payment');
  };

  // ─── Sound ──────────────────────────────────────────────────
  useEffect(() => {
    notifAudioRef.current = new Audio('/sounds/notification.mp3');
  }, []);

  // ─── Render ───────────────────────────────────────────────
  const renderTab = () => {
    switch (tab) {
      case 'hall':
        return (
          <>
            <QuickTemplates dishes={dishes} onApplyTemplate={handleApplyTemplate} />
            <HallPlan
              tables={tables}
              checks={checks}
              waiterCalls={waiterCalls}
              onTableClick={handleTableClick}
              onResolveCall={handleResolveCall}
            />
          </>
        );
      case 'menu':
        return <MenuGrid dishes={dishes} categories={categories} onSendOrder={handleSendOrder} />;
      case 'orders':
        return <ActiveOrders checks={checks} onRefresh={loadChecks} onPayOrder={handlePayOrder} user={user} />;
      case 'payment':
        return <PaymentScreen checks={checks} onRefresh={loadChecks} onClose={() => setTab('orders')} />;
      case 'history':
        return <OrderHistory />;
      case 'chat':
        return <WaiterChat user={user} onUnreadChange={setChatUnread} />;
    }
  };

  const unreadCalls = waiterCalls.length;
  const totalNotifications = unreadCalls + notifications.length;

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (newTab === 'chat') setChatUnread(0);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Audio */}
      <audio ref={notifAudioRef} preload="none" />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">T</div>
            <div>
              <h1 className="font-bold text-sm">Терминал</h1>
              <p className="text-[10px] text-zinc-500">{user.firstName || user.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative p-2 text-zinc-500 hover:text-white">
              {totalNotifications > 0 ? <BellRing size={18} className="text-orange-400" /> : <Bell size={18} />}
              {totalNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] min-w-[16px] h-[16px] rounded-full flex items-center justify-center font-bold">
                  {totalNotifications > 9 ? '9+' : totalNotifications}
                </span>
              )}
            </button>
            <button onClick={onLogout} className="text-xs text-zinc-500 hover:text-red-400 px-3 py-1.5 rounded-lg bg-zinc-900">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Notification panel */}
      {showNotifPanel && (
        <div className="fixed top-14 left-0 right-0 z-50 bg-zinc-900 border-b border-zinc-800 shadow-xl">
          <div className="max-w-lg mx-auto p-4 space-y-2 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white">Уведомления</span>
              <button onClick={() => { setNotifications([]); setShowNotifPanel(false); }} className="text-xs text-zinc-500">Очистить</button>
            </div>
            {waiterCalls.length > 0 && (
              <div className="bg-red-500/10 rounded-xl p-3 text-sm text-red-400 font-semibold flex items-center gap-2">
                <AlertTriangle size={16} /> {waiterCalls.length} вызов(ов) официанта
              </div>
            )}
            {notifications.map((n, i) => (
              <div key={i} className="bg-zinc-800/50 rounded-xl p-3 text-sm text-zinc-300">{n}</div>
            ))}
            {totalNotifications === 0 && <p className="text-sm text-zinc-600">Нет уведомлений</p>}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-lg mx-auto">
        {renderTab()}
      </div>

      {/* Table card modal */}
      {tableCardOpen && selectedTable && (
        <TableCard
          table={selectedTable}
          checks={checks.filter(c => c.tableId === selectedTable.id)}
          onClose={() => { setTableCardOpen(false); setSelectedTable(null); }}
          onAddOrder={() => { setTab('menu'); setTableCardOpen(false); }}
          onRefresh={() => { loadTables(); loadChecks(); }}
        />
      )}

      {/* Voice Order FAB */}
      <button onClick={() => setVoiceOrderOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-xl shadow-orange-500/30 active:scale-95">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>

      {/* Voice Order Modal */}
      {voiceOrderOpen && (
        <VoiceOrder
          user={user}
          onOrderCreated={() => { loadChecks(); loadTables(); }}
          onClose={() => setVoiceOrderOpen(false)}
        />
      )}

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-50 safe-bottom">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {[
            { id: 'hall' as Tab, icon: LayoutDashboard, label: 'Зал', badge: 0 },
            { id: 'menu' as Tab, icon: Coffee, label: 'Меню', badge: 0 },
            { id: 'orders' as Tab, icon: ClipboardList, label: 'Заказы', badge: checks.filter(c => c.status === 'open').length },
            { id: 'payment' as Tab, icon: Wallet, label: 'Оплата', badge: 0 },
            { id: 'history' as Tab, icon: History, label: 'История', badge: 0 },
            { id: 'chat' as Tab, icon: MessageSquare, label: 'Чат', badge: chatUnread },
          ].map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 relative transition-all ${tab === t.id ? 'text-orange-500' : 'text-zinc-500'}`}>
              <div className={`p-1 rounded-xl transition-all ${tab === t.id ? 'bg-orange-500/10' : ''}`}>
                <t.icon size={20} strokeWidth={tab === t.id ? 2.5 : 1.5} />
              </div>
              <span className="text-[9px] font-semibold">{t.label}</span>
              {t.badge ? (
                <span className="absolute -top-0.5 right-0 bg-orange-500 text-white text-[8px] min-w-[16px] h-[16px] rounded-full flex items-center justify-center font-bold px-1 shadow-lg">
                  {t.badge > 99 ? '99+' : t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
