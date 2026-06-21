import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Search, Filter, Download, RotateCcw, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle, Clock, CreditCard, Smartphone, Globe } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
  succeeded: { label: 'Успешно', color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  canceled: { label: 'Отменён', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  refunded: { label: 'Возвращён', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
  error: { label: 'Ошибка', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
};

const PROVIDER_LABELS: Record<string, string> = {
  yookassa: 'ЮKassa',
  cloudpayments: 'CloudPayments',
  tbank: 'Т-Банк',
};

const PAYMENT_METHOD_ICONS: Record<string, any> = {
  card: CreditCard,
  sbp: Smartphone,
  apple_pay: Globe,
  google_pay: Globe,
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refunding, setRefunding] = useState<string | null>(null);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const data = await api.getAdminPayments({
        page: p, limit: 20,
        status: filterStatus || undefined,
        provider: filterProvider || undefined,
        type: filterType || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setPayments(data.items);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setPage(data.page);
    } catch (e: any) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(1); }, [filterStatus, filterProvider, filterType, dateFrom, dateTo]);

  const handleRefund = async (payment: any) => {
    if (!confirm(`Вернуть ${payment.amount}₽ по платежу ${payment.id.slice(0, 12)}...?`)) return;
    setRefunding(payment.id);
    try {
      const result = await api.refundPayment(payment.id);
      if (result.ok) { addToast('Возврат выполнен', 'success'); load(); }
      else {
        addToast(`Ошибка: ${result.data?.error_description || JSON.stringify(result.data)}`, 'error');
      }
    } catch (e: any) { addToast(e.message, 'error'); }
    setRefunding(null);
  };

  const exportCSV = () => {
    const headers = ['ID', 'Сумма', 'Статус', 'Провайдер', 'Метод', 'Заказ', 'Плательщик', 'Дата'];
    const rows = payments.map(p => [
      p.id, p.amount, p.status, p.provider, p.payment_method,
      p.order_id || '-', p.order_user_name || '-', p.created_at,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Платежи</h1>
          <p className="text-sm text-zinc-500 mt-1">Всего: {total}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-2 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all">
            <Download size={16} /> CSV
          </button>
          <button onClick={() => load()} className="flex items-center gap-1.5 bg-blue-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 active:scale-[0.97] transition-all">
            <RefreshCw size={16} /> Обновить
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-zinc-400" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
              <option value="">Все статусы</option>
              <option value="pending">Ожидает</option>
              <option value="succeeded">Успешно</option>
              <option value="canceled">Отменён</option>
              <option value="refunded">Возвращён</option>
              <option value="error">Ошибка</option>
            </select>
          </div>
          <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
            <option value="">Все провайдеры</option>
            <option value="yookassa">ЮKassa</option>
            <option value="cloudpayments">CloudPayments</option>
            <option value="tbank">Т-Банк</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
            <option value="">Все типы</option>
            <option value="order">Заказы</option>
            <option value="subscription">Подписки</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
          <span className="text-zinc-400 text-xs">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left py-3 px-4 font-medium">ID</th>
                <th className="text-left py-3 px-4 font-medium">Сумма</th>
                <th className="text-left py-3 px-4 font-medium">Статус</th>
                <th className="text-left py-3 px-4 font-medium">Провайдер</th>
                <th className="text-left py-3 px-4 font-medium">Метод</th>
                <th className="text-left py-3 px-4 font-medium">Заказ / Плательщик</th>
                <th className="text-left py-3 px-4 font-medium">Дата</th>
                <th className="text-right py-3 px-4 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-zinc-400">Загрузка...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-zinc-400">Платежей нет</td></tr>
              ) : payments.map(p => {
                const st = STATUS_LABELS[p.status] || { label: p.status, color: '' };
                const MethodIcon = PAYMENT_METHOD_ICONS[p.payment_method] || CreditCard;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-zinc-500">{p.id.slice(0, 16)}...</td>
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">{p.amount?.toLocaleString('ru-RU')} ₽</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                        {p.status === 'succeeded' ? <CheckCircle size={12} /> : p.status === 'refunded' ? <RotateCcw size={12} /> : p.status === 'error' ? <AlertTriangle size={12} /> : p.status === 'pending' ? <Clock size={12} /> : <XCircle size={12} />}
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{PROVIDER_LABELS[p.provider] || p.provider}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        <MethodIcon size={14} />
                        <span className="text-xs">{p.payment_method === 'sbp' ? 'СБП' : p.payment_method === 'card' ? 'Карта' : p.payment_method}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-zinc-700 dark:text-zinc-300">
                        {p.order_id ? (
                          <span>Заказ #{p.order_id}{p.order_user_name ? ` · ${p.order_user_name}` : ''}</span>
                        ) : p.subscription_id ? (
                          <span>Подписка #{p.subscription_id}</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 text-xs">{new Date(p.created_at).toLocaleString('ru-RU')}</td>
                    <td className="py-3 px-4 text-right">
                      {p.status === 'succeeded' && (
                        <button
                          onClick={() => handleRefund(p)}
                          disabled={refunding === p.id}
                          className="text-xs text-red-500 hover:text-red-600 font-medium disabled:opacity-50"
                        >
                          {refunding === p.id ? '...' : 'Возврат'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4 border-t border-zinc-100 dark:border-zinc-800">
            <button onClick={() => load(page - 1)} disabled={page <= 1} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
              <ChevronLeft size={14} /> Назад
            </button>
            <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
              Вперёд <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
