import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { UserPlus, Trash2, Shield, Eye, EyeOff, Loader } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Супер-админ', owner: 'Владелец', manager: 'Менеджер',
  chef: 'Шеф-повар', waiter: 'Официант', courier: 'Курьер',
  accountant: 'Бухгалтер', analyst: 'Аналитик',
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-red-500/10 text-red-400', owner: 'bg-purple-500/10 text-purple-400',
  manager: 'bg-blue-500/10 text-blue-400', chef: 'bg-emerald-500/10 text-emerald-400',
  waiter: 'bg-amber-500/10 text-amber-400', courier: 'bg-cyan-500/10 text-cyan-400',
  accountant: 'bg-indigo-500/10 text-indigo-400', analyst: 'bg-pink-500/10 text-pink-400',
};

export function StaffAccounts() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'manager', first_name: '', last_name: '' });
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const load = () => {
    setLoading(true);
    api.getStaffAccounts()
      .then(setStaff)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.createStaffAccount(form);
      setShowForm(false);
      setForm({ username: '', password: '', role: 'manager', first_name: '', last_name: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить сотрудника?')) return;
    try { await api.deleteStaffAccount(id); load(); } catch {}
  };

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
          <h1 className="text-2xl font-bold text-white tracking-tight">Сотрудники</h1>
          <p className="text-slate-400 text-sm mt-0.5">Учётные записи для доступа к админ-панели</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-4 py-2 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition text-sm flex items-center gap-2 shadow-md">
          <UserPlus size={16} /> Добавить
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-[#112240]/60 backdrop-blur-sm border border-white/5 rounded-2xl p-5 mb-6 space-y-3">
          {error && <div className="bg-red-500/10 text-red-400 border border-red-500/20 text-sm px-4 py-2 rounded-xl">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required placeholder="Логин *"
              className="px-4 py-2 bg-transparent border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            <div className="relative">
              <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required type={showPw ? 'text' : 'password'} minLength={6} placeholder="Пароль *"
                className="w-full px-4 py-2 bg-transparent border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Имя"
              className="px-4 py-2 bg-transparent border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Фамилия"
              className="px-4 py-2 bg-transparent border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="px-4 py-2 bg-transparent border border-white/10 rounded-xl text-sm text-white outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
              <option value="manager">Менеджер</option>
              <option value="chef">Шеф-повар</option>
              <option value="waiter">Официант</option>
              <option value="courier">Курьер</option>
              <option value="accountant">Бухгалтер</option>
              <option value="analyst">Аналитик</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-5 py-2 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition text-sm flex items-center gap-2 shadow-md">
              <UserPlus size={14} /> Создать
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="text-slate-400 px-4 py-2 text-sm hover:text-white transition">Отмена</button>
          </div>
        </form>
      )}

      {staff.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Shield size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Нет сотрудников. Добавьте первую учётную запись.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <div key={s.id} className="bg-[#112240]/40 backdrop-blur-sm border border-white/5 rounded-xl px-5 py-3.5 flex items-center justify-between hover:border-cyan-500/20 transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-cyan-500/10 rounded-full flex items-center justify-center text-sm font-bold text-cyan-400">
                  {(s.first_name || s.username)[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-white text-sm">{s.first_name || s.username} {s.last_name || ''}</div>
                  <div className="text-xs text-slate-400">{s.username}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${ROLE_COLORS[s.role] || 'bg-white/5 text-slate-400'}`}>
                  {ROLE_LABELS[s.role] || s.role}
                </span>
                {!s.is_active && <span className="text-[11px] text-red-400 font-medium">Заблокирован</span>}
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
