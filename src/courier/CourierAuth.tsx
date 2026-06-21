import { useState, useEffect, useRef } from 'react';
import { Bike, LogIn, Store } from 'lucide-react';
import * as api from '../api';

export default function CourierAuth({ onLogin }: { onLogin: (id: number, name: string) => void }) {
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

  const handleLogin = async () => {
    if (!tenantName.trim() || !username || !password) { setError('Заполните все поля'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.tenantLogin(tenantName.trim(), username, password);
      if (!res.user || res.user.role !== 'courier') {
        setError('У вас нет прав доступа к приложению курьера');
        setLoading(false);
        return;
      }
      const displayName = res.user.firstName + (res.user.lastName ? ' ' + res.user.lastName : '');
      localStorage.setItem('foodchain_last_tenant', tenantName.trim());
      localStorage.setItem('foodchain_last_login', username);
      onLogin(res.user.id, displayName);
    } catch (e: any) {
      setError(e.message || 'Ошибка входа');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3"><Bike size={32} className="text-green-600" /></div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">FoodChain Курьер</h1>
          <p className="text-zinc-500 text-sm mt-1">Вход для сотрудников доставки</p>
        </div>
        {error && <p className="text-red-500 text-xs text-center mb-3">{error}</p>}
        <div className="space-y-3">
          <div className="relative" ref={ref}>
            <div className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center px-4 bg-white dark:bg-zinc-800">
              <Store size={18} className="text-zinc-400 mr-2" />
              <input type="text" value={tenantName} onChange={async e => {
                setTenantName(e.target.value);
                if (e.target.value.length >= 2) {
                  try { setSuggestions(await api.searchTenants(e.target.value)); } catch { setSuggestions([]); }
                } else { setSuggestions([]); }
              }} placeholder="Ресторан"
                className="flex-1 py-3 text-sm bg-transparent text-zinc-900 dark:text-white outline-none" />
            </div>
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl mt-1 shadow-lg overflow-hidden">
                {suggestions.map(t => (
                  <button key={t.id} type="button" onClick={() => { setTenantName(t.nickname || t.name); setSuggestions([]); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                    {t.name} {t.nickname ? `(@${t.nickname})` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Логин" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
          <button onClick={handleLogin} disabled={loading} className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">{loading ? 'Вход...' : <><LogIn size={18} /> Войти</>}</button>
          <a href="#" onClick={e => { e.preventDefault(); setError('Обратитесь к администратору вашего ресторана для сброса пароля'); }} className="block text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 text-center mt-2">Забыли пароль?</a>
        </div>
      </div>
    </div>
  );
}
