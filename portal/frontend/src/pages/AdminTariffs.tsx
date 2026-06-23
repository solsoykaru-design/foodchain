import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Check } from 'lucide-react';

export function AdminTariffs() {
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', price_monthly: 9900, max_orders: 500, max_staff: 5, max_branches: 1, features: '', sort_order: 1 });
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.adminGetTariffs()
      .then(setTariffs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const data = {
      ...form,
      features: form.features.split('\n').filter(f => f.trim()),
    };
    try {
      if (editId) {
        await api.adminUpdateTariff(editId, data);
      } else {
        await api.adminCreateTariff(data);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', code: '', price_monthly: 9900, max_orders: 500, max_staff: 5, max_branches: 1, features: '', sort_order: 1 });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEdit = (t: any) => {
    setForm({
      name: t.name, code: t.code, price_monthly: parseFloat(t.price_monthly),
      max_orders: t.max_orders, max_staff: t.max_staff, max_branches: t.max_branches,
      features: (t.features || []).join('\n'), sort_order: t.sort_order,
    });
    setEditId(t.id);
    setShowForm(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/admin/tenants')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад к ресторанам
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Управление тарифами</h1>
        <button onClick={() => { setEditId(null); setForm({ name: '', code: '', price_monthly: 9900, max_orders: 500, max_staff: 5, max_branches: 1, features: '', sort_order: 1 }); setShowForm(true); }}
          className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-xl hover:bg-zinc-800 transition text-sm flex items-center gap-2">
          <Plus size={16} /> Добавить тариф
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-4">{editId ? 'Редактировать' : 'Создать'} тариф</h2>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-3">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Название" className="col-span-2 px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} required placeholder="Код (basic/pro/...)" className="col-span-2 px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={form.price_monthly} onChange={e => setForm(p => ({ ...p, price_monthly: parseFloat(e.target.value) || 0 }))} required type="number" placeholder="Цена/мес" className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} type="number" placeholder="Порядок" className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={form.max_orders} onChange={e => setForm(p => ({ ...p, max_orders: parseInt(e.target.value) || 0 }))} type="number" placeholder="Макс. заказов" className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={form.max_staff} onChange={e => setForm(p => ({ ...p, max_staff: parseInt(e.target.value) || 0 }))} type="number" placeholder="Макс. сотрудников" className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={form.max_branches} onChange={e => setForm(p => ({ ...p, max_branches: parseInt(e.target.value) || 1 }))} type="number" placeholder="Макс. филиалов" className="col-span-2 px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <textarea value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} placeholder="Возможности (каждая с новой строки)" rows={4}
                  className="col-span-2 px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition">
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>
      ) : (
        <div className="space-y-3">
          {tariffs.map(t => (
            <div key={t.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer hover:shadow-sm transition" onClick={() => startEdit(t)}>
              <div>
                <div className="font-bold text-zinc-900">{t.name}</div>
                <div className="text-xs text-zinc-500">Код: {t.code} · {t.max_orders} заказов · {t.max_staff} сотрудников</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(t.features || []).map((f: string, i: number) => (
                    <span key={i} className="text-[11px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={10} className="text-green-500" /> {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-zinc-900">{parseFloat(t.price_monthly).toLocaleString('ru-RU')} ₽</div>
                <div className="text-xs text-zinc-500">в месяц</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
