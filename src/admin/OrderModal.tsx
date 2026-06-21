import { useState, useEffect, useCallback } from 'react';
import { X, Pencil, Check, Plus, Trash2, Minus, ChevronDown, ChevronUp, Search } from 'lucide-react';
import * as api from '../api';
import type { Order, OrderItem } from '../types';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый', confirmed: 'Принят', preparing: 'Готовится', ready: 'Готов к выдаче',
  assigned: 'Назначен курьеру', en_route: 'В пути', delivered: 'Выполнен', cancelled: 'Отменён',
};
const ALL_STATUSES = ['new', 'confirmed', 'preparing', 'ready', 'assigned', 'en_route', 'delivered', 'cancelled'];

interface Props {
  orderId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function OrderModal({ orderId, onClose, onSaved }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add dish modal
  const [showAddDish, setShowAddDish] = useState(false);
  const [dishes, setDishes] = useState<any[]>([]);
  const [dishSearch, setDishSearch] = useState('');

  // Status change
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  // Couriers
  const [couriers, setCouriers] = useState<any[]>([]);
  const [showCourierDropdown, setShowCourierDropdown] = useState(false);
  const [assigningCourier, setAssigningCourier] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const data = await api.getOrder(orderId);
      setOrder(data);
      setEditItems(data.items ? [...data.items] : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const loadDishes = async () => {
    try {
      const data = await api.get('/api/dishes');
      setDishes(Array.isArray(data) ? data : []);
    } catch {}
  };

  const loadCouriers = async () => {
    try {
      const data = await api.getStaff();
      setCouriers(data.filter((s: any) => s.role === 'courier' && s.isActive));
    } catch {}
  };

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const startEditing = () => {
    setEditItems(order?.items ? order.items.map(i => ({ ...i })) : []);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditItems(order?.items ? [...order.items] : []);
    setEditing(false);
  };

  const updateItemQty = (index: number, delta: number) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const qty = Math.max(1, (item.quantity || 1) + delta);
      return { ...item, quantity: qty };
    }));
  };

  const removeItem = (index: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const addDishItem = (dish: any) => {
    setEditItems(prev => {
      const existing = prev.find(i => i.dishId === dish.id);
      if (existing) {
        return prev.map(i => i.dishId === dish.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i);
      }
      return [...prev, { dishId: dish.id, name: dish.name, price: dish.price, quantity: 1, options: [] }];
    });
    setShowAddDish(false);
    setDishSearch('');
  };

  const saveItems = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = editItems.map(i => ({ dishId: i.dishId, quantity: i.quantity }));
      const updated = await api.updateOrderItems(orderId, payload);
      setOrder(updated);
      setEditItems(updated.items ? [...updated.items] : []);
      setEditing(false);
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const calcSubtotal = (items: OrderItem[]) => {
    return items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  };

  const handleStatusChange = async (status: string) => {
    setChangingStatus(true);
    setError('');
    try {
      const updated = await api.changeOrderStatus(orderId, status);
      setOrder(updated);
      setShowStatusDropdown(false);
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Ошибка изменения статуса');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleAssignCourier = async (courierId: number, courierName: string) => {
    setAssigningCourier(true);
    setError('');
    try {
      const updated = await api.assignOrderCourier(orderId, courierId, courierName);
      setOrder(updated);
      setShowCourierDropdown(false);
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Ошибка назначения курьера');
    } finally {
      setAssigningCourier(false);
    }
  };

  const isCourierAssigned = order?.status === 'assigned' || order?.status === 'en_route' || order?.status === 'delivered';

  const filteredDishes = dishes.filter(d =>
    d.name?.toLowerCase().includes(dishSearch.toLowerCase())
  );

  const fieldInput = "w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400";

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

  const subtotal = editing ? calcSubtotal(editItems) : (order.subtotal || 0);
  const items = editing ? editItems : (order.items || []);

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

          {/* Status & Courier row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <button onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                {STATUS_LABELS[order.status] || order.status} {showStatusDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showStatusDropdown && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-1.5 min-w-[140px]">
                  {ALL_STATUSES.filter(s => s !== order.status).map(s => (
                    <button key={s} onClick={() => handleStatusChange(s)} disabled={changingStatus}
                      className="block w-full text-left px-3 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400 transition disabled:opacity-50">
                      {STATUS_LABELS[s] || s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!isCourierAssigned ? (
              <div className="relative">
                <button onClick={() => { setShowCourierDropdown(!showCourierDropdown); if (!showCourierDropdown) loadCouriers(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition">
                  <Plus size={14} /> Назначить курьера
                </button>
                {showCourierDropdown && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-2 min-w-[180px]">
                    <p className="text-[10px] font-semibold text-zinc-500 mb-1.5 px-1">Выберите курьера:</p>
                    {couriers.length === 0 && <p className="text-[10px] text-zinc-400 px-1">Нет активных курьеров</p>}
                    {couriers.map(c => {
                      const cn = `${c.firstName} ${c.lastName || ''}`.trim() || c.username || `Курьер #${c.id}`;
                      return (
                        <button key={c.id} onClick={() => handleAssignCourier(c.id, cn)} disabled={assigningCourier}
                          className="block w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400 transition disabled:opacity-50">
                          {cn}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                <span>Курьер: {order.courierName || 'назначен'}</span>
              </div>
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

          {/* Order items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Состав заказа</h3>
              {!editing ? (
                <button onClick={startEditing}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition">
                  <Pencil size={14} /> Редактировать
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowAddDish(true); loadDishes(); }}
                    className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition">
                    <Plus size={14} /> Добавить блюдо
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {items.length === 0 && (
                <p className="text-xs text-zinc-400 py-2">Нет позиций</p>
              )}
              {items.map((item, idx) => (
                <div key={idx}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-zinc-400">{item.price?.toLocaleString()}₽ × {item.quantity}</p>
                  </div>
                  {editing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateItemQty(idx, -1)} disabled={item.quantity <= 1}
                        className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 transition">
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-bold text-zinc-900 dark:text-white w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateItemQty(idx, 1)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                        <Plus size={14} />
                      </button>
                      <button onClick={() => removeItem(idx)}
                        className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition ml-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  {!editing && (
                    <span className="text-sm font-bold text-zinc-900 dark:text-white shrink-0">
                      {((item.price || 0) * (item.quantity || 1)).toLocaleString()}₽
                    </span>
                  )}
                </div>
              ))}
            </div>

            {editing && (
              <div className="border-t border-zinc-200 dark:border-zinc-700 mt-3 pt-3 flex justify-between items-center">
                <span className="text-sm text-zinc-500">Итого:</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-white">{subtotal.toLocaleString()}₽</span>
              </div>
            )}
          </div>

          {/* Order total (non-editing) */}
          {!editing && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 flex justify-between items-center">
              <div>
                <span className="text-sm text-zinc-500">Итого</span>
                {order.deliveryFee > 0 && <p className="text-xs text-zinc-400">Доставка: {order.deliveryFee.toLocaleString()}₽</p>}
              </div>
              <span className="text-xl font-bold text-zinc-900 dark:text-white">{order.total?.toLocaleString()}₽</span>
            </div>
          )}

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
          {editing ? (
            <>
              <button onClick={cancelEditing}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-[0.97]">
                Отмена
              </button>
              <button onClick={saveItems} disabled={saving || editItems.length === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition active:scale-[0.97]">
                <Check size={16} /> {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </>
          ) : (
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-[0.97]">
              Закрыть
            </button>
          )}
        </div>
      </div>

      {/* Add Dish modal */}
      {showAddDish && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAddDish(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Добавить блюдо</h3>
              <button onClick={() => setShowAddDish(false)} className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input value={dishSearch} onChange={e => setDishSearch(e.target.value)}
                  placeholder="Поиск блюд..." className={`${fieldInput} pl-9`} />
              </div>
              <div className="max-h-[40vh] overflow-y-auto space-y-1">
                {filteredDishes.length === 0 && (
                  <p className="text-xs text-zinc-400 text-center py-4">Ничего не найдено</p>
                )}
                {filteredDishes.map((dish: any) => (
                  <button key={dish.id} onClick={() => addDishItem(dish)}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition text-left">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{dish.name}</p>
                      <p className="text-xs text-zinc-400">{dish.price?.toLocaleString()}₽</p>
                    </div>
                    <Plus size={16} className="text-zinc-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
