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
          <ShieldAlert size={48} className="mx-auto mb-4 text-slate-600" />
          <h2 className="text-xl font-bold text-white mb-2">Управление точками</h2>
          <p className="text-slate-400 text-sm mb-6">
            Суперадминистратор управляет точками через панель администратора.
          </p>
          <Link to="/admin/tenants" className="inline-block bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition text-sm shadow-md">
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
        <div className="text-slate-400 text-sm">Загрузка...</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Точки (филиалы)</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {allowCreate ? 'Вы можете создавать и управлять точками' : 'Управление точками ограничено'}
          </p>
        </div>
        {allowCreate && (
          <button onClick={() => { setForm({ name: '', address: '', phone: '' }); setEditId(null); setShowForm(true); }}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-4 py-2 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition text-sm flex items-center gap-2 shadow-md">
            <Plus size={16} /> Добавить точку
          </button>
        )}
      </div>

      {!allowCreate && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300 flex items-center gap-2 mb-6 backdrop-blur-sm">
          <Building2 size={18} />
          Для добавления точек обратитесь к администратору платформы.
        </div>
      )}

      {error && <div className="bg-red-500/10 text-red-400 border border-red-500/20 text-sm px-4 py-2 rounded-xl mb-4">{error}</div>}

      {showForm && (
        <div className="bg-[#112240]/60 backdrop-blur-sm border border-white/5 rounded-xl p-4 mb-4">
          <h3 className="font-medium text-sm text-white mb-3">{editId ? 'Редактировать точку' : 'Новая точка'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Название *"
              className="px-3 py-2 bg-transparent border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            <input value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} placeholder="Адрес"
              className="px-3 py-2 bg-transparent border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="Телефон"
              className="px-3 py-2 bg-transparent border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg hover:shadow-cyan-500/25 transition">
              Сохранить
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-white/10 rounded-lg text-sm text-slate-400 hover:text-white transition">
              Отмена
            </button>
          </div>
        </div>
      )}

      {branches.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <MapPin size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Нет точек. {allowCreate ? 'Добавьте первую точку.' : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {branches.map(b => (
            <div key={b.id} className="bg-[#112240]/40 backdrop-blur-sm border border-white/5 rounded-xl px-5 py-3.5 flex items-center justify-between hover:border-cyan-500/20 transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-400 shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <div className="font-medium text-sm text-white">{b.name}</div>
                  <div className="text-xs text-slate-400">{b.address || '—'} {b.phone && `· ${b.phone}`}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {allowCreate && (
                  <>
                    <button onClick={() => { setForm({ name: b.name, address: b.address || '', phone: b.phone || '' }); setEditId(b.id); setShowForm(true); }}
                      className="p-2 text-slate-400 hover:text-cyan-400 transition"><Edit3 size={15} /></button>
                    <button onClick={() => handleDelete(b.id)} className="p-2 text-slate-400 hover:text-red-400 transition"><Trash2 size={15} /></button>
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
