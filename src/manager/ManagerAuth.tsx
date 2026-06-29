import { useState } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Building2, LogIn, User, Lock } from 'lucide-react';

interface Props {
  onLogin: (user: any) => void;
}

export default function ManagerAuth({ onLogin }: Props) {
  const [tenantName, setTenantName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName || !login || !password) {
      addToast('Заполните все поля', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await api.tenantLogin(tenantName.trim(), login.trim(), password);
      if (data?.token && data?.user) {
        localStorage.setItem('foodchain_token', data.token);
        onLogin({ ...data.user, tenantName });
      } else {
        addToast('Ошибка входа', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Ошибка входа', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl mx-auto flex items-center justify-center mb-3">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">FoodChain Manager</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Управление рестораном с телефона</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Building2 className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              type="text"
              value={tenantName}
              onChange={e => setTenantName(e.target.value)}
              placeholder="Название ресторана (nickname)"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <User className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="Логин"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Пароль"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? 'Вход...' : <><LogIn size={18} /> Войти</>}
          </button>
        </form>
      </div>
    </div>
  );
}
