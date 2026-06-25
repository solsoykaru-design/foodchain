import { useState } from 'react';
import { Lock, User, Sparkles } from 'lucide-react';
import * as api from '../api';
import TechCardsPage from '../admin/TechCardsPage';
import SubscriptionGate from './SubscriptionGate';

const SERVER_URL = 'https://foodchain.onrender.com';

export default function TechCardStandaloneApp() {
  const [username, setUsername] = useState(localStorage.getItem('foodchain_techcard_login') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('fc_token'));

  const handleLogin = async () => {
    if (!username.trim() || !password) { setError('Введите логин и пароль'); return; }
    setError('');
    setLoading(true);
    try {
      localStorage.setItem('foodchain_api_url', SERVER_URL);
      const res = await api.adminLogin(username.trim(), password);
      const user = res.user || res;
      if (res.token) localStorage.setItem('fc_token', res.token);
      localStorage.setItem('foodchain_admin_user', JSON.stringify(user));
      localStorage.setItem('foodchain_techcard_login', username.trim());
      setLoggedIn(true);
    } catch (e: any) {
      setError(e.message || 'Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('fc_token');
    localStorage.removeItem('foodchain_admin_user');
    setLoggedIn(false);
  };

  if (loggedIn) {
    return (
      <SubscriptionGate>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
          <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 h-14 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-amber-500" />
              <span className="font-bold text-zinc-900 dark:text-white">AI Техкарты</span>
            </div>
            <button onClick={handleLogout} className="text-xs text-zinc-400 hover:text-red-500 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
              Выйти
            </button>
          </header>
          <div className="p-4">
            <TechCardsPage />
          </div>
        </div>
      </SubscriptionGate>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-600 via-orange-700 to-red-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sparkles size={32} className="text-amber-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">AI Техкарты</h1>
          <p className="text-zinc-500 text-sm mt-1">Только для владельца</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Логин"
              className="w-full pl-10 pr-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Пароль"
              className="w-full pl-10 pr-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
}
