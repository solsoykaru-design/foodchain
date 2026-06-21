import { useState, useEffect, useRef } from 'react';
import { ChefHat, Lock, LogIn, Store } from 'lucide-react';
import * as api from '../api';

export default function KitchenAuth({ onLogin }: { onLogin: (user: any) => void }) {
  const [tenantName, setTenantName] = useState(localStorage.getItem('foodchain_last_tenant') || '');
  const [username, setUsername] = useState(localStorage.getItem('foodchain_last_login') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setSuggestions([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !username || !password) { setError('Заполните все поля'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.tenantLogin(tenantName.trim(), username, password);
      if (!res.user || !(res.user.role === 'chef' || res.user.role === 'manager' || res.user.role === 'superadmin')) {
        setError('У вас нет прав доступа к приложению кухни');
        setLoading(false);
        return;
      }
      localStorage.setItem('foodchain_kitchen_token', res.token || '');
      localStorage.setItem('foodchain_last_tenant', tenantName.trim());
      localStorage.setItem('foodchain_last_login', username);
      onLogin(res.user);
    } catch (e: any) {
      setError(e.message || 'Ошибка входа');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
            <ChefHat size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Приложение кухни</h1>
          <p className="text-zinc-500 text-sm mt-1">Войдите в систему</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative" ref={ref}>
            <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 flex items-center px-4">
              <Store size={20} className="text-zinc-500 mr-3" />
              <input value={tenantName} onChange={async e => {
                setTenantName(e.target.value);
                if (e.target.value.length >= 2) {
                  try { setSuggestions(await api.searchTenants(e.target.value)); } catch { setSuggestions([]); }
                } else { setSuggestions([]); }
              }} placeholder="Ресторан"
                className="flex-1 bg-transparent py-3.5 text-white text-sm outline-none placeholder-zinc-600" />
            </div>
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-zinc-800 border border-zinc-700 rounded-xl mt-1 shadow-lg overflow-hidden">
                {suggestions.map(t => (
                  <button key={t.id} type="button" onClick={() => { setTenantName(t.nickname || t.name); setSuggestions([]); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
                    {t.name} {t.nickname ? `(@${t.nickname})` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 flex items-center px-4">
            <ChefHat size={20} className="text-zinc-500 mr-3" />
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Логин"
              className="flex-1 bg-transparent py-3.5 text-white text-sm outline-none placeholder-zinc-600" autoFocus />
          </div>
          <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 flex items-center px-4">
            <Lock size={20} className="text-zinc-500 mr-3" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль"
              className="flex-1 bg-transparent py-3.5 text-white text-sm outline-none placeholder-zinc-600" />
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 text-center">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-green-500 text-white font-bold py-3.5 rounded-xl active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogIn size={18} />}
            {loading ? 'Вход...' : 'Войти'}
          </button>
          <a href="#" onClick={e => { e.preventDefault(); setError('Обратитесь к администратору вашего ресторана для сброса пароля'); }} className="block text-xs text-zinc-500 hover:text-zinc-300 text-center mt-2">Забыли пароль?</a>
        </form>
      </div>
    </div>
  );
}
