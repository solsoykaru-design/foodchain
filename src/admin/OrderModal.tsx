import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import * as api from '../api';
import type { Order } from '../types';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый', confirmed: 'Принят', preparing: 'Готовится', ready: 'Готов к выдаче',
  assigned: 'Назначен курьеру', en_route: 'В пути', delivered: 'Выполнен', cancelled: 'Отменён',
};

interface Props {
  orderId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function OrderModal({ orderId, onClose }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    try {
      const data = await api.getOrder(orderId);
      setOrder(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8" onClick={e => e.stopPropagation()}>
          <p className="text-zinc-500">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8" onClick={e => e.stopPropagation()}>
          <p className="text-red-500">{error || 'Заказ не найден'}</p>
          <button onClick={onClose} className="mt-3 text-sm text-blue-600 hover:underline">Закрыть</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-[680px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Заказ #{order.id}</h2>
            <p className="text-xs text-zinc-400">
              {order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU') : ''}
              {' · '}
              {order.type === 'delivery' ? 'Доставка' : order.type === 'pickup' ? 'Самовывоз' : 'В зале'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-600 dark:text-red-400">{error}</div>}

          {/* Status & Courier info (read-only) */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {STATUS_LABELS[order.status] || order.status}
            </span>
            {order.courierName && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                Курьер: {order.courierName}
              </span>
            )}
          </div>

          {/* Client info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Клиент</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">{order.userName}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{order.userPhone}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-0.5">Адрес доставки</p>
              <p className="text-sm text-zinc-900 dark:text-white">{order.address || '—'}</p>
              {order.comment && (
                <>
                  <p className="text-xs text-zinc-400 mt-1 mb-0.5">Комментарий</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 italic">{order.comment}</p>
                </>
              )}
            </div>
          </div>

          {/* Order items (read-only) */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Состав заказа</h3>
            <div className="space-y-1.5">
              {(!order.items || order.items.length === 0) && (
                <p className="text-xs text-zinc-400 py-2">Нет позиций</p>
              )}
              {(order.items || []).map((item: any, idx: number) => (
                <div key={idx}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-zinc-400">{item.price?.toLocaleString()}₽ × {item.quantity}</p>
                  </div>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white shrink-0">
                    {((item.price || 0) * (item.quantity || 1)).toLocaleString()}₽
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Order total */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 flex justify-between items-center">
            <div>
              <span className="text-sm text-zinc-500">Итого</span>
              {order.deliveryFee > 0 && <p className="text-xs text-zinc-400">Доставка: {order.deliveryFee.toLocaleString()}₽</p>}
            </div>
            <span className="text-xl font-bold text-zinc-900 dark:text-white">{order.total?.toLocaleString()}₽</span>
          </div>

          {/* Status history */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <details className="text-xs text-zinc-400">
              <summary className="cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 font-medium">История статусов</summary>
              <div className="mt-2 space-y-1">
                {order.statusHistory.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
                    <span className="text-zinc-600 dark:text-zinc-400">{STATUS_LABELS[h.status] || h.status}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {h.createdAt ? new Date(h.createdAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {h.note && <span className="text-zinc-400 italic">— {h.note}</span>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-[0.97]">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
