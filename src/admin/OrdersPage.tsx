import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import { onEvent } from '../api';
import type { Order } from '../types';
import { X, UserPlus, Download } from 'lucide-react';
import OrderModal from './OrderModal';
import { addToast } from '../ToastContext';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый', confirmed: 'Принят', preparing: 'Готовится', ready: 'Готов к выдаче',
  assigned: 'Назначен курьеру', en_route: 'В пути', delivered: 'Выполнен', cancelled: 'Отменён',
};

const STATUS_BG: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  preparing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ready: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  assigned: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  en_route: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ALL_STATUSES = ['new', 'confirmed', 'preparing', 'ready', 'assigned', 'en_route', 'delivered', 'cancelled'];

export default function OrdersPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [couriers, setCouriers] = useState<any[]>([]);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [modalOrderId, setModalOrderId] = useState<number | null>(null);

  const loadOrders = () => {
    if (statusFilters.length === 0) {
      api.getOrders().then(setOrders).catch(() => {});
    } else {
      api.getOrdersMultiStatus(statusFilters).then(setOrders).catch(() => {});
    }
  };

  const loadCouriers = () => {
    api.getStaff().then((all: any[]) => {
      setCouriers(all.filter((s: any) => s.role === 'courier' && s.isActive));
    }).catch(() => {});
  };

  useEffect(() => {
    loadOrders();
    loadCouriers();
  }, [statusFilters]);

  useEffect(() => {
    const unsub1 = onEvent('order:update', (order: Order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
    });
    const unsub2 = onEvent('order:new', (order: Order) => {
      if (statusFilters.length === 0 || statusFilters.includes(order.status)) {
        setOrders(prev => [order, ...prev]);
      }
    });
    return () => { unsub1(); unsub2(); };
  }, [statusFilters]);

  const toggleStatusFilter = (s: string) => {
    setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)));
    }
  };

  const updateStatus = async (orderId: number, status: string, note?: string) => {
    try {
      await api.updateOrderStatus(orderId, status as any, note);
      loadOrders();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    if (!confirm(`Изменить статус ${selectedIds.size} заказов на "${STATUS_LABELS[bulkStatus] || bulkStatus}"?`)) return;
    try {
      await api.bulkUpdateOrderStatus(Array.from(selectedIds), bulkStatus);
      setBulkStatus('');
      setSelectedIds(new Set());
      loadOrders();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleAssign = async (orderId: number, courierId: number, courierName: string) => {
    try {
      await api.assignOrder(orderId, courierId, courierName, 0);
      setAssigning(null);
      loadOrders();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleUnassign = async (orderId: number) => {
    try {
      await api.assignOrder(orderId, 0, '', 0);
      loadOrders();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const confirmStatusOverride = (orderId: number, status: string) => {
    const label = STATUS_LABELS[status] || status;
    if (!confirm(`Перевести заказ #${orderId} в статус "${label}"?`)) return;
    updateStatus(orderId, status);
  };

  const filtered = [...orders].sort((a, b) => b.createdAt?.localeCompare(a.createdAt) || 0);

  const exportCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(item => columns.map(c => `"${String(item[c.key] ?? '')}"`).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportOrders = () => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'userName', label: 'Клиент' },
      { key: 'userPhone', label: 'Телефон' },
      { key: 'address', label: 'Адрес' },
      { key: 'total', label: 'Сумма' },
      { key: 'status', label: 'Статус' },
      { key: 'createdAt', label: 'Дата' },
      { key: 'courierName', label: 'Курьер' },
    ];
    exportCSV(filtered, 'orders.csv', columns);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('sidebar_orders')}</h2>
          <p className="text-sm text-zinc-500 mt-1">Управление заказами</p>
        </div>
        <button onClick={handleExportOrders}
          className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-600 active:scale-[0.97] transition-all"><Download size={16} /> Экспорт CSV</button>
      </div>
      {/* Status filter checkboxes */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_STATUSES.map(s => (
          <label key={s}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all select-none ${statusFilters.includes(s) ? 'bg-blue-500 text-white shadow-sm' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
            <input type="checkbox" checked={statusFilters.includes(s)} onChange={() => toggleStatusFilter(s)} className="hidden" />
            {t('status_' + s)}
          </label>
        ))}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Выбрано: {selectedIds.size}</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
            className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white outline-none">
            <option value="">Изменить статус...</option>
            {ALL_STATUSES.filter(s => s !== 'cancelled' && s !== 'delivered').map(s => (
              <option key={s} value={s}>{t('status_' + s)}</option>
            ))}
            <option value="cancelled">Отменить</option>
          </select>
          <button onClick={handleBulkStatus} disabled={!bulkStatus}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97]">
            Применить
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs text-zinc-500 hover:text-zinc-700 active:scale-[0.97]">
            Снять выделение
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center shadow-sm border border-zinc-100 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">{t('orders_empty')}{statusFilters.length > 0 && statusFilters.length < ALL_STATUSES.length ? ' по выбранным статусам' : ''}</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[40px_80px_1fr_140px_120px_130px_110px] gap-3 px-5 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <div className="flex items-center">
              <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                className="rounded border-zinc-300 dark:border-zinc-600 accent-blue-500" />
            </div>
            <span>{t('orders_id')}</span>
            <span>{t('orders_client')}</span>
            <span className="text-right">{t('orders_sum')}</span>
            <span>{t('orders_status')}</span>
            <span>{t('orders_date')}</span>
            <span className="text-right">Действия</span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map(order => {
              const bg = STATUS_BG[order.status] || 'bg-zinc-100 text-zinc-700';
              return (
                <div key={order.id}>
                  <div className="grid grid-cols-[40px_1fr] md:grid-cols-[40px_80px_1fr_140px_120px_130px_110px] gap-3 px-5 py-3.5 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer" onClick={() => setModalOrderId(order.id)}>
                    <div className="flex items-center" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelect(order.id)}
                        className="rounded border-zinc-300 dark:border-zinc-600 accent-blue-500" />
                    </div>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white hidden md:block">#{order.id}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white md:hidden">#{order.id}</span>
                      <button onClick={e => { e.stopPropagation(); setModalOrderId(order.id); }}
                        className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate hover:text-blue-500 dark:hover:text-blue-400 text-left">
                        {order.userName || 'Гость'}
                      </button>
                    </div>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white text-right">{order.total?.toLocaleString()}₽</span>
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full text-center justify-self-start ${bg}`}>
                      {t('status_' + order.status)}
                    </span>
                    <span className="text-xs text-zinc-400 hidden md:block">{order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    <div className="flex gap-1 justify-end relative" onClick={e => e.stopPropagation()}>
                      {order.status === 'new' && (
                        <button onClick={() => confirmStatusOverride(order.id, 'confirmed')}
                          className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-[0.97]">
                          Принять
                        </button>
                      )}
                      {order.status === 'confirmed' && (
                        <button onClick={() => confirmStatusOverride(order.id, 'preparing')}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-[0.97]">
                          Готовить
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button onClick={() => confirmStatusOverride(order.id, 'ready')}
                          className="bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-[0.97]">
                          Готово
                        </button>
                      )}
                      {(order.status === 'new' || order.status === 'confirmed' || order.status === 'preparing' || order.status === 'ready') && (
                        <div className="relative">
                          <button onClick={() => { setAssigning(assigning === order.id ? null : order.id); if (assigning !== order.id) loadCouriers(); }}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-[0.97]">
                            <UserPlus size={12} />
                          </button>
                          {assigning === order.id && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-2 min-w-[180px]">
                              <p className="text-[10px] font-semibold text-zinc-500 mb-1.5 px-1">Выберите курьера:</p>
                              {couriers.length === 0 && <p className="text-[10px] text-zinc-400 px-1">Нет активных курьеров</p>}
                              {couriers.map(c => {
                                const courierName = `${c.firstName} ${c.lastName || ''}`.trim() || c.username || `Курьер #${c.id}`;
                                return (
                                  <button key={c.id} onClick={() => handleAssign(order.id, c.id, courierName)}
                                    className="block w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400 transition-all active:scale-[0.97] whitespace-nowrap">
                                    {courierName}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalOrderId !== null && (
        <OrderModal
          orderId={modalOrderId}
          onClose={() => setModalOrderId(null)}
          onSaved={() => { loadOrders(); }}
        />
      )}
    </div>
  );
}
