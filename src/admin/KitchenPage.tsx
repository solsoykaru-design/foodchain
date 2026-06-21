import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { onEvent } from '../api';
import type { Order } from '../types';
import { addToast } from '../ToastContext';
import { useTranslation } from 'react-i18next';
import { ChefHat, Check, X, Clock } from 'lucide-react';

export default function KitchenPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'confirmed' | 'preparing'>('confirmed');
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      const confirmed = await api.getOrders({ status: 'confirmed' });
      const preparing = await api.getOrders({ status: 'preparing' });
      setOrders([...confirmed, ...preparing]);
    } catch (e) {
      console.error('Kitchen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const unsub = onEvent('order:update', (order: Order) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === order.id);
        if (exists) {
          if (order.status === 'confirmed' || order.status === 'preparing') {
            return prev.map(o => o.id === order.id ? order : o);
          }
          return prev.filter(o => o.id !== order.id);
        }
        if (order.status === 'confirmed' || order.status === 'preparing') {
          return [order, ...prev];
        }
        return prev;
      });
    });
    const interval = setInterval(loadOrders, 5000);
    return () => { unsub(); clearInterval(interval); };
  }, [loadOrders]);

  const updateStatus = async (orderId: number, status: string, note?: string) => {
    try {
      await api.updateOrderStatus(orderId, status as any, note);
      loadOrders();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const filtered = orders.filter(o => o.status === tab).sort((a, b) => a.createdAt?.localeCompare(b.createdAt) || 0);

  const timeSince = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('kitchen_just_now');
    if (mins < 60) return `${mins} ${t('kitchen_min')}`;
    const hours = Math.floor(mins / 60);
    return `${hours} ${t('kitchen_h')} ${mins % 60} ${t('kitchen_min')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <ChefHat size={24} className="text-amber-500" /> {t('sidebar_kitchen')}
        </h1>
        <button onClick={loadOrders} className="text-sm text-blue-500 hover:text-blue-600 active:scale-[0.97] transition-transform">{t('kitchen_refresh')}</button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('confirmed')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${tab === 'confirmed' ? 'bg-blue-500 text-white shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'}`}>
          {t('kitchen_new')} {orders.filter(o => o.status === 'confirmed').length > 0 && <span className="ml-1.5 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{orders.filter(o => o.status === 'confirmed').length}</span>}
        </button>
        <button onClick={() => setTab('preparing')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${tab === 'preparing' ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'}`}>
          {t('kitchen_preparing')} {orders.filter(o => o.status === 'preparing').length > 0 && <span className="ml-1.5 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{orders.filter(o => o.status === 'preparing').length}</span>}
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center shadow-sm border border-zinc-100 dark:border-zinc-800">
          <ChefHat size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">{t('kitchen_empty')}</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">{t('kitchen_all_processed')}</p>
        </div>
      )}

      <div className="grid gap-4">
        {filtered.map(order => (
          <div key={order.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${order.status === 'confirmed' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                  #{order.id}
                </div>
                <div>
                  <p className="font-bold text-zinc-900 dark:text-white">#{order.id} · {order.userName || t('kitchen_guest')}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                    <Clock size={12} /> {timeSince(order.createdAt)} назад
                  </p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${order.status === 'confirmed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                  {order.status === 'confirmed' ? `🆕 ${t('kitchen_badge_new')}` : `👨‍🍳 ${t('kitchen_badge_preparing')}`}
              </span>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 mb-3">
              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span className="text-zinc-700 dark:text-zinc-300">{item.name} × {item.quantity}</span>
                  <span className="font-medium text-zinc-900 dark:text-white">{(item.price * item.quantity).toLocaleString()}₽</span>
                </div>
              ))}
              <div className="border-t border-zinc-200 dark:border-zinc-700 mt-2 pt-2 flex justify-between font-bold text-zinc-900 dark:text-white">
                <span>{t('kitchen_total')}</span><span>{order.total?.toLocaleString()}₽</span>
              </div>
            </div>

            {order.comment && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 italic">📝 {order.comment}</p>
            )}

            <div className="flex gap-2">
              {order.status === 'confirmed' && (
                <button onClick={() => updateStatus(order.id, 'preparing', t('kitchen_note_confirm'))}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]">
                  <ChefHat size={16} /> {t('kitchen_take')}
                </button>
              )}
              {order.status === 'preparing' && (
                <button onClick={() => updateStatus(order.id, 'ready', t('kitchen_note_ready'))}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]">
                  <Check size={16} /> {t('kitchen_done')}
                </button>
              )}
              <button onClick={() => updateStatus(order.id, 'cancelled', t('kitchen_note_cancel'))}
                className="bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all active:scale-[0.97]">
                <X size={16} /> {t('kitchen_cancel')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
