import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, CreditCard, CheckCircle, Clock, XCircle, ExternalLink, Banknote, Loader } from 'lucide-react';

export function Payments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState('');
  const [payDesc, setPayDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

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
      setMsgType('success');
    } catch (err: any) {
      setMessage(err.message);
      setMsgType('error');
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
      case 'succeeded': return <CheckCircle size={14} className="text-emerald-400" />;
      case 'paid': return <CheckCircle size={14} className="text-emerald-400" />;
      case 'pending': return <Clock size={14} className="text-amber-400" />;
      case 'failed': case 'overdue': case 'cancelled': return <XCircle size={14} className="text-red-400" />;
      default: return <Clock size={14} className="text-slate-500" />;
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
        <div className="text-slate-400 text-sm">Загрузка...</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </Link>

      <h1 className="text-2xl font-bold text-white tracking-tight mb-6">Платежи и счета</h1>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${msgType === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {msgType === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {message}
        </div>
      )}

      <div className="bg-[#112240]/60 backdrop-blur-sm border border-white/5 rounded-2xl p-5 mb-8">
        <h2 className="font-bold text-white mb-3 flex items-center gap-2">
          <Banknote size={16} className="text-cyan-400" /> Выставить счёт
        </h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Сумма (₽)</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} required min={1} step="0.01" placeholder="1000"
              className="w-32 px-3 py-2 bg-transparent border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-slate-400 mb-1">Описание</label>
            <input value={payDesc} onChange={e => setPayDesc(e.target.value)} placeholder="Оплата подписки"
              className="w-full px-3 py-2 bg-transparent border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>
          <button type="submit" disabled={creating}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-5 py-2 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition text-sm disabled:opacity-50 flex items-center gap-2">
            {creating ? <><Loader size={14} className="animate-spin" /> Создание...</> : 'Создать счёт'}
          </button>
        </form>
      </div>

      <div className="mb-8">
        <h2 className="font-bold text-lg text-white mb-3">Счета</h2>
        {invoices.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">Нет счетов</p>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => (
              <div key={inv.id} className="bg-[#112240]/40 backdrop-blur-sm border border-white/5 rounded-xl px-5 py-3.5 flex items-center justify-between hover:border-cyan-500/20 transition">
                <div className="flex items-center gap-3">
                  {statusIcon(inv.status)}
                  <div>
                    <div className="text-sm font-medium text-white">{inv.number}</div>
                    <div className="text-xs text-slate-400">{inv.description || 'Подписка'} · {inv.due_date ? new Date(inv.due_date).toLocaleDateString('ru-RU') : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">{inv.amount.toLocaleString('ru-RU')} ₽</span>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                    inv.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>{inv.status}</span>
                  {inv.status === 'pending' && inv.payment_id && (
                    <button onClick={() => handleConfirm(inv.payment_id)} disabled={confirming === inv.payment_id}
                      className="text-xs font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
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
        <h2 className="font-bold text-lg text-white mb-3">Платежи</h2>
        {payments.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">Нет платежей</p>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="bg-[#112240]/40 backdrop-blur-sm border border-white/5 rounded-xl px-5 py-3.5 flex items-center justify-between hover:border-cyan-500/20 transition">
                <div className="flex items-center gap-3">
                  {statusIcon(p.status)}
                  <div>
                    <div className="text-sm font-medium text-white">{p.description || `Платёж #${p.id}`}</div>
                    <div className="text-xs text-slate-400">{p.transaction_id ? `ID: ${p.transaction_id}` : ''} · {p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">{p.amount.toLocaleString('ru-RU')} ₽</span>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    p.status === 'succeeded' ? 'bg-emerald-500/10 text-emerald-400' :
                    p.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>{p.status}</span>
                  {p.status === 'pending' && (
                    <button onClick={() => handleConfirm(p.id)} disabled={confirming === p.id}
                      className="text-xs font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
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
