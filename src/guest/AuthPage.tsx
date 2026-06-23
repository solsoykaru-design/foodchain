import { useState } from 'react';
import { useApp } from '../context';
import { Phone, LogIn, Loader } from 'lucide-react';
import SocialAuth from '../SocialAuth';
import * as api from '../api';

export default function AuthPage({ onLogin, branding }: { onLogin: () => void; branding?: any }) {
  const c = branding?.common || {};
  const bc = c.primaryColor || '#FF5722';
  const btnStyle = { background: bc };
  const shadowStyle = { boxShadow: `0 10px 15px -3px ${bc}33` };
  const ringStyle = { '--tw-ring-color': bc } as React.CSSProperties;
  const { registerUser } = useApp();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function normalizePhoneRaw(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return '+7' + digits;
    if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
    if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
    if (digits.length >= 10 && digits.length <= 15) return '+' + digits;
    return raw;
  }

  const handleLogin = async () => {
    if (phone.length < 5) return;
    setLoading(true);
    setError('');
    try {
      const normalized = normalizePhoneRaw(phone);
      const res = await api.phoneLogin(normalized);
      const user = res.user || res;
      if (res.token) {
        localStorage.setItem('fc_token', res.token);
      }
      try {
        const saved = localStorage.getItem('foodchain_settings_' + (user.phone || normalized));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.name) user.name = parsed.name;
          if (parsed.email) user.email = parsed.email;
          if (parsed.birthday) user.birthday = parsed.birthday;
        }
      } catch {}
      sessionStorage.setItem('foodchain_guest_user', JSON.stringify(user));
      registerUser(user.name || 'Гость', user.phone || normalized, 'mobile_app');
      onLogin();
    } catch (e: any) {
      if (e.message?.includes('fetch') || e.message?.includes('NetworkError')) {
        sessionStorage.setItem('foodchain_guest_user', JSON.stringify({ phone, name: phone }));
        onLogin();
        return;
      }
      setError(e.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4" style={c.loginBackground ? { backgroundImage: `url(${c.loginBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      <div className="w-full max-w-sm bg-zinc-900/95 backdrop-blur-sm rounded-3xl p-6 shadow-2xl ring-1 ring-zinc-800">
        <div className="text-center mb-8">
          {c.logoUrl ? (
            <img src={c.logoUrl} className="w-16 h-16 rounded-2xl mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ background: `linear-gradient(135deg, ${bc}, ${c.secondaryColor || '#FFC107'})` }}>
              <span className="text-3xl font-extrabold text-white">{c.restaurantName?.[0] || 'F'}</span>
            </div>
          )}
          <h1 className="text-3xl font-extrabold text-white">{c.restaurantName || 'FoodChain'}</h1>
          <p className="text-zinc-500 text-sm mt-1">{c.slogan || branding?.site?.slogan || 'Доставка вкусной еды'}</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-extrabold text-white text-center">Вход</h2>
          <p className="text-xs text-zinc-500 text-center">Введите номер телефона, чтобы войти или создать аккаунт</p>
          <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setError(''); }} placeholder="+7 (999) 000-00-00" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm text-center outline-none ring-1 ring-zinc-700 transition-all placeholder-zinc-600" style={ringStyle} />
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <button onClick={handleLogin} disabled={loading} className="w-full text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60" style={{ ...btnStyle, ...shadowStyle }}>{loading ? <Loader size={18} className="animate-spin" /> : <LogIn size={18} />} Войти</button>
        </div>
      </div>
    </div>
  );
}
