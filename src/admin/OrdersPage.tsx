import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import { onEvent } from '../api';
import type { Order } from '../types';
import { Download } from 'lucide-react';
import OrderModal from './OrderModal';

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
  const [modalOrderId, setModalOrderId] = useState<number | null>(null);

  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  const loadOrders = () => {
    if (statusFilters.length === 0) {
      api.getOrders().then(setOrders).catch(() => {});
    } else {
      api.getOrdersMultiStatus(statusFilters).then(setOrders).catch(() => {});
    }
  };

  useEffect(() => {
    loadOrders();
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
          <p className="text-sm text-zinc-500 mt-1">Просмотр заказов (только чтение)</p>
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

      {filtered.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center shadow-sm border border-zinc-100 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">{t('orders_empty')}{statusFilters.length > 0 && statusFilters.length < ALL_STATUSES.length ? ' по выбранным статусам' : ''}</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[80px_1fr_140px_120px_130px] gap-3 px-5 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <span>{t('orders_id')}</span>
            <span>{t('orders_client')}</span>
            <span className="text-right">{t('orders_sum')}</span>
            <span>{t('orders_status')}</span>
            <span>{t('orders_date')}</span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map(order => {
              const bg = STATUS_BG[order.status] || 'bg-zinc-100 text-zinc-700';
              return (
                <div key={order.id}>
                  <div className="grid grid-cols-[1fr] md:grid-cols-[80px_1fr_140px_120px_130px] gap-3 px-5 py-3.5 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer" onClick={() => setModalOrderId(order.id)}>
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
