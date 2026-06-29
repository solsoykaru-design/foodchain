import { useEffect, useState } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Check, X, Clock, Package } from 'lucide-react';

export default function PurchaseOrdersView() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.request('/api/purchase-orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  const approve = async (id: number) => {
    try {
      await api.request(`/api/purchase-orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'approved' }),
      });
      addToast('Заказ утверждён', 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const reject = async (id: number) => {
    if (!confirm('Отклонить заказ?')) return;
    try {
      await api.request(`/api/purchase-orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      addToast('Заказ отклонён', 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  if (loading) return <div className="text-center py-12 text-zinc-500">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Заказы поставщикам</h2>
      {orders.length === 0 && <p className="text-zinc-500 text-center py-8">Нет заказов</p>}
      {orders.map(o => (
        <div key={o.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold flex items-center gap-2"><Package size={16} /> Заказ #{o.id}</p>
              <p className="text-sm text-zinc-500 mt-1">{o.supplierName || 'Поставщик'} · {new Date(o.createdAt).toLocaleDateString('ru-RU')}</p>
              <p className="text-lg font-bold mt-2">{Number(o.total || 0).toLocaleString()} ₽</p>
            </div>
            <StatusBadge status={o.status} />
          </div>
          {o.status === 'draft' && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => approve(o.id)} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1"><Check size={16} /> Утвердить</button>
              <button onClick={() => reject(o.id)} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1"><X size={16} /> Отклонить</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    approved: 'bg-emerald-100 text-emerald-700',
    sent: 'bg-blue-100 text-blue-700',
    received: 'bg-purple-100 text-purple-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded-full ${map[status] || map.draft}`}>
      {status === 'draft' && <span className="flex items-center gap-1"><Clock size={12} /> Черновик</span>}
      {status === 'approved' && 'Утверждён'}
      {status === 'sent' && 'Отправлен'}
      {status === 'received' && 'Получен'}
      {status === 'cancelled' && 'Отклонён'}
    </span>
  );
}
