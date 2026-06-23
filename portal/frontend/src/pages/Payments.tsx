import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, CreditCard, CheckCircle, Clock, XCircle, ExternalLink } from 'lucide-react';

export function Payments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState('');
  const [payDesc, setPayDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.getPayments(), api.getInvoices()])
      .then(([p, i]) => { setPayments(p); setInvoices(i); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');
    try {
      await api.createPayment(parseFloat(payAmount), payDesc);
      setPayAmount('');
      setPayDesc('');
      load();
      setMessage('Счёт создан');
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = async (id: number) => {
    setConfirming(id);
    try {
      await api.confirmPayment(id);
      load();
    } catch {}
    setConfirming(null);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'succeeded': return <CheckCircle size={14} className="text-green-500" />;
      case 'paid': return <CheckCircle size={14} className="text-green-500" />;
      case 'pending': return <Clock size={14} className="text-amber-500" />;
      case 'failed': case 'overdue': case 'cancelled': return <XCircle size={14} className="text-red-500" />;
      default: return <Clock size={14} className="text-zinc-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </Link>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Платежи и счета</h1>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${message.includes('Ошибка') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-8">
        <h2 className="font-bold text-zinc-900 mb-3">Выставить счёт</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Сумма (₽)</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} required min={1} step="0.01" placeholder="1000"
              className="w-32 px-3 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-zinc-500 mb-1">Описание</label>
            <input value={payDesc} onChange={e => setPayDesc(e.target.value)} placeholder="Оплата подписки"
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <button type="submit" disabled={creating}
            className="bg-orange-500 text-white font-medium px-5 py-2 rounded-xl hover:bg-orange-600 transition text-sm disabled:opacity-60">
            {creating ? 'Создание...' : 'Создать счёт'}
          </button>
        </form>
      </div>

      <div className="mb-8">
        <h2 className="font-bold text-lg text-zinc-900 mb-3">Счета</h2>
        {invoices.length === 0 ? (
          <p className="text-zinc-400 text-sm text-center py-8">Нет счетов</p>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => (
              <div key={inv.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon(inv.status)}
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{inv.number}</div>
                    <div className="text-xs text-zinc-500">{inv.description || 'Подписка'} · {inv.due_date ? new Date(inv.due_date).toLocaleDateString('ru-RU') : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-zinc-900">{inv.amount.toLocaleString('ru-RU')} ₽</span>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                    inv.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{inv.status}</span>
                  {inv.status === 'pending' && inv.payment_id && (
                    <button onClick={() => handleConfirm(inv.payment_id)} disabled={confirming === inv.payment_id}
                      className="text-xs font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50">
                      {confirming === inv.payment_id ? '...' : 'Оплатить'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-bold text-lg text-zinc-900 mb-3">Платежи</h2>
        {payments.length === 0 ? (
          <p className="text-zinc-400 text-sm text-center py-8">Нет платежей</p>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon(p.status)}
                  <div>
                    <div className="text-sm font-medium text-zinc-900">{p.description || `Платёж #${p.id}`}</div>
                    <div className="text-xs text-zinc-500">{p.transaction_id ? `ID: ${p.transaction_id}` : ''} · {p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-zinc-900">{p.amount.toLocaleString('ru-RU')} ₽</span>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    p.status === 'succeeded' ? 'bg-green-100 text-green-700' :
                    p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{p.status}</span>
                  {p.status === 'pending' && (
                    <button onClick={() => handleConfirm(p.id)} disabled={confirming === p.id}
                      className="text-xs font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50">
                      {confirming === p.id ? '...' : 'Подтвердить'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
