import { useState } from 'react';
import { User, Phone, LogIn, Loader } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';
import * as api from '../../api';

export default function AuthPage() {
  const ctx = useWebsite();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!phone.trim()) { setError('Введите номер телефона'); return; }
    setLoading(true);
    setError('');
    try {
      const normalized = phone.startsWith('+') ? phone : '+7' + phone.replace(/\D/g, '').slice(-10);
      const res = await api.phoneLogin(normalized);
      const user = res.user || res;
      localStorage.setItem('website_user', JSON.stringify(user));
      ctx.setUser(user);
      ctx.setPage('home');
    } catch (e: any) {
      setError(e.message || 'Ошибка входа');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-3 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center">
              <User size={24} className="text-[var(--color-primary)]" />
            </div>
            <h1 className="text-xl font-bold">Вход</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Введите номер телефона, чтобы войти или создать аккаунт</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <div className="space-y-3">
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Номер телефона"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:border-[var(--color-primary)] outline-none transition-colors" />
            </div>

            <button onClick={handleLogin} disabled={loading}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader size={16} className="animate-spin" /> Вход...</> : <><LogIn size={16} /> Войти</>}
            </button>
          </div>

          <p className="mt-6 text-xs text-center text-[var(--color-text-secondary)]">
            Продолжая, вы принимаете условия <a href="#" className="text-[var(--color-primary)] hover:underline">пользовательского соглашения</a>
          </p>
        </div>
      </div>
    </div>
  );
}
