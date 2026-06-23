import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { UserPlus, Trash2, Shield, Eye, EyeOff } from 'lucide-react';

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
    try {
      await api.deleteStaffAccount(id);
      load();
    } catch {}
  };

  const roleColors: Record<string, string> = {
    superadmin: 'bg-red-100 text-red-700', owner: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700', chef: 'bg-green-100 text-green-700',
    waiter: 'bg-amber-100 text-amber-700', courier: 'bg-cyan-100 text-cyan-700',
    accountant: 'bg-indigo-100 text-indigo-700', analyst: 'bg-pink-100 text-pink-700',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Сотрудники</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Учётные записи для доступа к админ-панели</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-xl hover:bg-zinc-800 transition text-sm flex items-center gap-2">
          <UserPlus size={16} /> Добавить
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 space-y-3">
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required placeholder="Логин *"
              className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
            <div className="relative">
              <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required type={showPw ? 'text' : 'password'} minLength={6} placeholder="Пароль *"
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Имя"
              className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
            <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Фамилия"
              className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400">
              <option value="manager">Менеджер</option>
              <option value="chef">Шеф-повар</option>
              <option value="waiter">Официант</option>
              <option value="courier">Курьер</option>
              <option value="accountant">Бухгалтер</option>
              <option value="analyst">Аналитик</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-orange-500 text-white font-medium px-5 py-2 rounded-xl hover:bg-orange-600 transition text-sm">Создать</button>
            <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="text-zinc-500 px-4 py-2 text-sm hover:text-zinc-700">Отмена</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">Нет сотрудников. Добавьте первую учётную запись.</div>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <div key={s.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-zinc-100 rounded-full flex items-center justify-center text-sm font-bold text-zinc-600">
                  {(s.first_name || s.username)[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-zinc-900 text-sm">{s.first_name || s.username} {s.last_name || ''}</div>
                  <div className="text-xs text-zinc-500">{s.username}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${roleColors[s.role] || 'bg-zinc-100 text-zinc-600'}`}>
                  {s.role}
                </span>
                {!s.is_active && <span className="text-[11px] text-red-500 font-medium">Заблокирован</span>}
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-zinc-400 hover:text-red-500 transition"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
