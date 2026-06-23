import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Plus, X, DollarSign, Calendar } from 'lucide-react';

export function AdminInvoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ tenant_id: '', amount: '', description: '', due_date: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.adminGetInvoices()
      .then(setInvoices)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.adminCreateInvoice(
        parseInt(form.tenant_id),
        parseFloat(form.amount),
        form.description,
        form.due_date || undefined
      );
      setShowCreate(false);
      setForm({ tenant_id: '', amount: '', description: '', due_date: '' });
      load();
    } catch (err: any) { setError(err.message); }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700', paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700', cancelled: 'bg-zinc-100 text-zinc-500',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Счета и платежи</h1>
        <button onClick={() => setShowCreate(true)} className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-xl hover:bg-zinc-800 transition text-sm flex items-center gap-2">
          <Plus size={16} /> Выставить счёт
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Выставить счёт</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-3">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={form.tenant_id} onChange={e => setForm(p => ({ ...p, tenant_id: e.target.value }))} required type="number" placeholder="ID арендатора *"
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              <input value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required type="number" placeholder="Сумма *"
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Описание"
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              <input value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} type="date"
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition">Создать счёт</button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {invoices.map(inv => (
              <div key={inv.id} className="px-5 py-3.5 flex items-center justify-between text-sm hover:bg-zinc-50">
                <div>
                  <div className="font-medium text-zinc-900">{inv.number}</div>
                  <div className="text-xs text-zinc-500">{inv.tenant_name || `ID: ${inv.tenant_id}`} · {inv.description || '—'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-zinc-900">{inv.amount.toLocaleString('ru-RU')} ₽</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusColors[inv.status]}`}>{inv.status}</span>
                  <span className="text-xs text-zinc-400">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('ru-RU') : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
