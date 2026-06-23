import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Plus, X, MapPin, Building2, Trash2, Edit3, ShieldAlert } from 'lucide-react';

export function Branches() {
  const { isSuperAdmin } = useAuth();
  const [branches, setBranches] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [b, t] = await Promise.all([api.getMyBranches(), api.getMyTenant()]);
      setBranches(b);
      setTenant(t);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (isSuperAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <ShieldAlert size={48} className="mx-auto mb-4 text-zinc-300" />
          <h2 className="text-xl font-bold text-zinc-800 mb-2">Управление точками</h2>
          <p className="text-zinc-500 text-sm mb-6">
            Суперадминистратор управляет точками через панель администратора.
          </p>
          <Link to="/admin/tenants" className="inline-block bg-zinc-900 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-zinc-800 transition text-sm">
            Перейти в панель администратора
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setError('');
    try {
      if (editId) {
        await api.updateMyBranch(editId, form);
      } else {
        await api.createMyBranch(form);
      }
      setForm({ name: '', address: '', phone: '' });
      setEditId(null);
      setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить точку?')) return;
    try { await api.deleteMyBranch(id); load(); } catch {}
  };

  const allowCreate = tenant?.allow_create_branches;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-zinc-400">Загрузка...</div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Точки (филиалы)</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {allowCreate ? 'Вы можете создавать и управлять точками' : 'Управление точками ограничено'}
          </p>
        </div>
        {allowCreate && (
          <button onClick={() => { setForm({ name: '', address: '', phone: '' }); setEditId(null); setShowForm(true); }}
            className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-xl hover:bg-zinc-800 transition text-sm flex items-center gap-2">
            <Plus size={16} /> Добавить точку
          </button>
        )}
      </div>

      {!allowCreate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2 mb-6">
          <Building2 size={18} />
          Для добавления точек обратитесь к администратору платформы.
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-4">{error}</div>}

      {showForm && (
        <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-4">
          <h3 className="font-medium text-sm mb-3">{editId ? 'Редактировать точку' : 'Новая точка'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Название *" className="px-3 py-2 border border-zinc-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
            <input value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} placeholder="Адрес" className="px-3 py-2 border border-zinc-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
            <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="Телефон" className="px-3 py-2 border border-zinc-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-sm font-medium">Сохранить</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm">Отмена</button>
          </div>
        </div>
      )}

      {branches.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <MapPin size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Нет точек. {allowCreate ? 'Добавьте первую точку.' : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {branches.map(b => (
            <div key={b.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <div className="font-medium text-sm text-zinc-900">{b.name}</div>
                  <div className="text-xs text-zinc-500">{b.address || '—'} {b.phone && `· ${b.phone}`}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {allowCreate && (
                  <>
                    <button onClick={() => { setForm({ name: b.name, address: b.address || '', phone: b.phone || '' }); setEditId(b.id); setShowForm(true); }}
                      className="p-2 text-zinc-400 hover:text-blue-500 transition"><Edit3 size={15} /></button>
                    <button onClick={() => handleDelete(b.id)} className="p-2 text-zinc-400 hover:text-red-500 transition"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
