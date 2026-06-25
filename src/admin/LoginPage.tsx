import { useState, useEffect, useRef } from 'react';
import { Shield, Lock, User, Smartphone, Store, Server } from 'lucide-react';
import * as api from '../api';

const SAVED_TENANT = localStorage.getItem('foodchain_last_tenant') || '';
const SAVED_SERVER_URL = localStorage.getItem('foodchain_api_url') || '';

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [tenantName, setTenantName] = useState(SAVED_TENANT);
  const [serverUrl, setServerUrl] = useState(SAVED_SERVER_URL);
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [username, setUsername] = useState(localStorage.getItem('foodchain_last_login') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [token2FA, setToken2FA] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [remember, setRemember] = useState(!!SAVED_TENANT);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setSuggestions([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    if (isNative || !SAVED_SERVER_URL) setShowServerUrl(true);
  }, []);

  const handleLogin = async () => {
    if (!serverUrl.trim() && !SAVED_SERVER_URL) {
      setError('Укажите адрес сервера (нажмите на иконку слева внизу)');
      return;
    }
    if (!tenantName.trim() || !username.trim() || !password) {
      setError('Заполните все поля');
      return;
    }
    setError('');
    setLoading(true);
    localStorage.setItem('foodchain_api_url', serverUrl.trim());
    try {
      const res = await api.tenantLogin(tenantName.trim(), username.trim(), password);
      if (res.require2fa) {
        setPendingUser(res.user);
        if (res.token) localStorage.setItem('fc_token', res.token);
        setShow2FA(true);
        setLoading(false);
        return;
      }
      completeLogin(res.user, res.token);
    } catch (e: any) {
      // fallback: try old admin-login for superadmin
      try {
        const res = await api.adminLogin(username, password);
        const user = res.user || res;
        completeLogin(user, res.token);
        return;
      } catch {}
      setError(e.message || 'Ошибка входа');
      setLoading(false);
    }
  };

  const handle2FA = async () => {
    if (token2FA.length < 6) return;
    setLoading(true);
    try {
      const res = await api.tenantLogin(tenantName.trim(), username.trim(), password, token2FA);
      if (res.require2fa) {
        setError('Неверный код');
        setLoading(false);
        return;
      }
      completeLogin(res.user, res.token);
    } catch (e: any) {
      setError(e.message || 'Неверный код');
      setLoading(false);
    }
  };

  const completeLogin = (user: any, token?: string) => {
    localStorage.setItem('foodchain_admin_user', JSON.stringify(user));
    localStorage.setItem('foodchain_admin_session', 'admin_' + btoa(JSON.stringify({ user: username, time: Date.now(), rand: Math.random() })));
    if (token) localStorage.setItem('fc_token', token);
    if (remember) {
      localStorage.setItem('foodchain_last_tenant', tenantName.trim());
      localStorage.setItem('foodchain_last_login', username.trim());
    } else {
      localStorage.removeItem('foodchain_last_tenant');
      localStorage.removeItem('foodchain_last_login');
    }
    onLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-indigo-800 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            {show2FA ? <Smartphone size={32} className="text-blue-600" /> : <Shield size={32} className="text-blue-600" />}
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Панель управления</h1>
          <p className="text-zinc-500 text-sm mt-1">{show2FA ? 'Введите код из приложения' : 'Вход в систему'}</p>
        </div>

        {!show2FA ? (
          <div className="space-y-3">
            {showServerUrl && (
              <div className="relative">
                <Server size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type="text" value={serverUrl} onChange={e => { setServerUrl(e.target.value); localStorage.setItem('foodchain_api_url', e.target.value); }} placeholder="https://ваш-сервер.ру" className="w-full pl-10 pr-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
            )}
            <div className="relative" ref={ref}>
              <Store size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="text" value={tenantName} onChange={async e => {
                setTenantName(e.target.value);
                if (e.target.value.length >= 2) {
                  try { setSuggestions(await api.searchTenants(e.target.value)); } catch { setSuggestions([]); }
                } else { setSuggestions([]); }
              }} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Ресторан" className="w-full pl-10 pr-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
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
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Логин" className="w-full pl-10 pr-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Пароль" className="w-full pl-10 pr-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded border-zinc-300 accent-blue-500" />
              Запомнить меня
            </label>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button onClick={handleLogin} disabled={loading} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition-colors">{loading ? 'Вход...' : 'Войти'}</button>
            <div className="flex items-center justify-between mt-2">
              <button onClick={() => setShowServerUrl(!showServerUrl)} className="text-xs text-zinc-400 hover:text-blue-500 flex items-center gap-1">
                <Server size={12} /> {showServerUrl ? 'Скрыть URL сервера' : 'URL сервера'}
              </button>
              <a href="#" onClick={e => { e.preventDefault(); setError('Обратитесь к администратору вашего ресторана для сброса пароля'); }} className="text-xs text-zinc-400 hover:text-blue-500">Забыли пароль?</a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 text-center">Введите 6-значный код из приложения аутентификатора</p>
            <input type="text" value={token2FA} onChange={e => setToken2FA(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && handle2FA()} placeholder="000000" maxLength={6}
              className="w-full text-center text-2xl tracking-[0.5em] font-bold border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button onClick={handle2FA} disabled={loading || token2FA.length < 6} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition-colors">{loading ? 'Проверка...' : 'Подтвердить'}</button>
            <button onClick={() => { setShow2FA(false); setToken2FA(''); setError(''); }} className="w-full text-zinc-400 text-sm hover:text-zinc-600 py-2">Назад</button>
          </div>
        )}
      </div>
    </div>
  );
}
