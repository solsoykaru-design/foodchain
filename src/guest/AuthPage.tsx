import { useState } from 'react';
import { useApp } from '../context';
import { Phone, User, ChevronRight, LogIn, Loader } from 'lucide-react';
import SocialAuth from '../SocialAuth';
import * as api from '../api';

const isNative = new URLSearchParams(window.location.search).has('native') || !!(window as any).Capacitor?.isNativePlatform();

export default function AuthPage({ onLogin, onSkip, branding }: { onLogin: () => void; onSkip?: () => void; branding?: any }) {
  const c = branding?.common || {};
  const bc = c.primaryColor || '#FF5722';
  const ringClass = 'focus:ring-2 outline-none transition-all';
  const btnStyle = { background: bc };
  const shadowStyle = { boxShadow: `0 10px 15px -3px ${bc}33` };
  const ringStyle = { '--tw-ring-color': bc } as React.CSSProperties;
  const { registerUser } = useApp();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | 'profile'>('phone');
  const [socialProvider, setSocialProvider] = useState<'google' | 'vk' | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);

  const [loginError, setLoginError] = useState('');
  const [regError, setRegError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async () => {
    if (phone.length < 5) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await api.login(phone, loginPassword, 'guest');
      const user = res.user || res;
      localStorage.setItem('foodchain_guest_user', JSON.stringify(user));
      onLogin();
    } catch (e: any) {
      // fallback: if server unreachable, allow local login
      if (e.message?.includes('fetch') || e.message?.includes('NetworkError')) {
        localStorage.setItem('foodchain_guest_user', JSON.stringify({ phone, name: phone }));
        onLogin();
        return;
      }
      setLoginError(e.message || 'Ошибка входа');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    if (step === 'phone' && phone.length > 5) { setStep('code'); return; }
    if (step === 'code' && code.length > 0) { setStep('profile'); setRegPassword(''); return; }
    if (step === 'profile' && name) {
      setRegLoading(true);
      setRegError('');
      try {
        const pwd = regPassword || undefined;
        const res = await api.register(name, phone, 'guest', pwd);
        const user = res.user || res;
        registerUser(name, phone, 'mobile_app');
        localStorage.setItem('foodchain_guest_user', JSON.stringify(user));
        onLogin();
      } catch (e: any) {
        // fallback: local-only registration
        if (e.message?.includes('fetch') || e.message?.includes('NetworkError')) {
          registerUser(name, phone, 'mobile_app');
          localStorage.setItem('foodchain_guest_user', JSON.stringify({ phone, name }));
          onLogin();
          return;
        }
        setRegError(e.message || 'Ошибка регистрации');
      } finally {
        setRegLoading(false);
      }
    }
  };

  const doSocialLogin = async (provider: 'google' | 'vk', displayName?: string) => {
    if (isNative) {
      setSocialLoading(true);
      try {
        if (provider === 'google') {
          const result = await SocialAuth.loginWithGoogle({ webClientId: '' });
          registerUser(result.name, result.email, 'mobile_app');
          localStorage.setItem('foodchain_guest_user', JSON.stringify({
            phone: result.email,
            name: result.name,
          }));
        } else {
          const result = await SocialAuth.loginWithVk();
          const phone = result.id || result.email || `vk_${Date.now()}`;
          registerUser(displayName || result.name, phone, 'mobile_app');
          localStorage.setItem('foodchain_guest_user', JSON.stringify({
            phone,
            name: result.name,
          }));
        }
        onLogin();
      } catch {
        // native plugin already shows a Toast on error
      } finally {
        setSocialLoading(false);
      }
      return;
    }
    // Web fallback — prompt for phone
    const phone = prompt('Введите номер телефона для входа:', '+7') || '';
    if (!phone) return;
    registerUser(displayName || provider, phone, 'website');
    localStorage.setItem('foodchain_guest_user', JSON.stringify({ phone, name: displayName || provider }));
    onLogin();
  };

  const handleSocialComplete = async () => {
    if (!name || !socialProvider) return;
    await doSocialLogin(socialProvider, name);
  };

  const handleSocialClick = (provider: 'google' | 'vk') => {
    if (isNative) {
      doSocialLogin(provider);
    } else {
      setSocialProvider(provider);
    }
  };

  if (socialProvider) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 shadow-2xl ring-1 ring-zinc-800">
          <h2 className="text-lg font-extrabold text-white text-center mb-1">
            {socialProvider === 'google' ? 'Google' : 'ВКонтакте'}
          </h2>
          <p className="text-xs text-zinc-500 text-center mb-4">Как к вам обращаться?</p>
          <div className="space-y-3">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Имя" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm text-center outline-none ring-1 ring-zinc-700 transition-all placeholder-zinc-600" style={ringStyle} />
            <button onClick={handleSocialComplete} className="w-full text-white font-extrabold py-3 rounded-xl" style={btnStyle}>Завершить</button>
            <button onClick={() => setSocialProvider(null)} className="w-full text-sm text-zinc-500 text-center">Назад</button>
          </div>
        </div>
      </div>
    );
  }

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

        {tab === 'register' ? (
          <div className="space-y-3">
            {step === 'phone' && (
              <>
                <h2 className="text-lg font-extrabold text-white text-center">Регистрация</h2>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 000-00-00" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm text-center outline-none ring-1 ring-zinc-700 transition-all placeholder-zinc-600" style={ringStyle} />
                <button onClick={handleRegister} className="w-full text-white font-extrabold py-3 rounded-xl" style={{ ...btnStyle, ...shadowStyle }}>Получить код</button>
              </>
            )}
            {step === 'code' && (
              <>
                <h2 className="text-lg font-extrabold text-white text-center">Код из SMS</h2>
                <p className="text-xs text-zinc-500 text-center">Введите 4 цифры</p>
                <input type="number" value={code} onChange={e => setCode(e.target.value)} placeholder="1234" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-lg text-center tracking-widest outline-none ring-1 ring-zinc-700 transition-all" style={ringStyle} />
                <button onClick={handleRegister} className="w-full text-white font-extrabold py-3 rounded-xl" style={{ ...btnStyle, ...shadowStyle }}>Подтвердить</button>
              </>
            )}
            {step === 'profile' && (
              <>
                <h2 className="text-lg font-extrabold text-white text-center">Как к вам обращаться?</h2>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Имя" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm text-center outline-none ring-1 ring-zinc-700 transition-all placeholder-zinc-600" style={ringStyle} />
                <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Пароль (можно оставить пустым)" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm text-center outline-none ring-1 ring-zinc-700 transition-all placeholder-zinc-600" style={ringStyle} />
                {regError && <p className="text-red-400 text-xs text-center">{regError}</p>}
                <button onClick={handleRegister} disabled={regLoading} className="w-full text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60" style={{ ...btnStyle, ...shadowStyle }}>{regLoading ? <Loader size={18} className="animate-spin" /> : null} Завершить</button>
              </>
            )}
            <button onClick={() => { setTab('login'); setStep('phone'); }} className="w-full text-sm text-zinc-500 text-center">Уже есть аккаунт? Войти</button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold text-white text-center">Вход</h2>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 000-00-00" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm text-center outline-none ring-1 ring-zinc-700 transition-all placeholder-zinc-600" style={ringStyle} />
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Пароль (можно оставить пустым)" className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm text-center outline-none ring-1 ring-zinc-700 transition-all placeholder-zinc-600" style={ringStyle} />
            {loginError && <p className="text-red-400 text-xs text-center">{loginError}</p>}
            <button onClick={handleLogin} disabled={loginLoading} className="w-full text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60" style={{ ...btnStyle, ...shadowStyle }}>{loginLoading ? <Loader size={18} className="animate-spin" /> : <LogIn size={18} />} Войти</button>

            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-600 font-medium">или</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <button
              onClick={() => handleSocialClick('google')}
              disabled={socialLoading}
              className="w-full bg-zinc-800 ring-1 ring-zinc-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] transition-transform"
            >
              {socialLoading ? <Loader size={18} className="animate-spin" /> : <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
              Google
            </button>
            <button
              onClick={() => handleSocialClick('vk')}
              disabled={socialLoading}
              className="w-full bg-[#0077FF] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] transition-transform shadow-lg shadow-blue-500/20"
            >
              {socialLoading ? <Loader size={18} className="animate-spin" /> : <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#fff" d="M45.2 34.6c-.6-1.1-2.4-2.4-5.1-5.2-1.4-1.4-2-2.3-2.3-3 0-.4.1-.8.6-1.4.4-.6 3-4.1 4.3-5.7 2-2.5 2.8-4.1 2.6-5.2l-.2-.2c-.3-.4-1.2-.6-2.1-.6h-5.8c-.7 0-1.1.2-1.4.6-.2.3-.3.8-.1 1.5.5 2.1 1.8 4.6 3.3 6.5 1.5 1.9 2.2 2.8 2.2 3.4 0 .4-.2 1-1 1.8-.8.8-5.5 5.5-6.3 6.2-.5.5-1.1.8-1.7.8-.4 0-.8-.1-1.3-.6-.4-.5-2.2-2.4-4.2-4.9-2.1-2.5-3.9-4.8-4.3-5.3-.5-.7-.8-1.1-.8-1.6 0-.5.2-1 .6-1.6.4-.6 3.8-5 5.3-7.1.9-1.2 1.3-2.2 1.3-2.8 0-.5-.1-.9-.6-1.3l-.6-.4c-.5-.3-1.2-.5-2.1-.5H13.9c-.9 0-1.5.2-1.8.6-.3.4-.4.9-.3 1.4.2 1 .6 2 1.2 3 .6 1 2.5 3.5 4.9 6.2 2.4 2.7 4.3 4.9 5.9 6.6 1.5 1.7 2.3 2.7 2.3 3.3 0 .4-.3 1-.8 1.7-.5.7-1 1.2-1.7 1.2-.7 0-1.4.1-2.1-.6-.7-.7-2.4-2.5-4-4.5-1.6-2-3.3-4.2-4.2-5.3-.9-1.1-1.6-1.8-2.1-2.1-.7-.5-1.2-.7-1.9-.7H5.8c-.9 0-1.7.2-2.1.7l-.2.2c-.5.5-.7 1.2-.5 2.1.2.9 1.5 3 3.2 5.3 1.7 2.3 4.3 5 6.8 7.2 2.5 2.2 4.9 4 7.2 5 1.5.7 3 .9 4.3.9 1 0 1.8-.2 2.3-.6.5-.4.9-1 1.3-1.8.4-.8.7-2.1 1.4-3.5.7-1.4 1.3-2.5 1.8-3.2.5-.7 1.1-1.1 1.8-1.1.5 0 1.2.3 1.9.9.7.6 1.8 1.9 3.1 3.4 1.3 1.5 2.5 2.8 3.3 3.5.8.7 1.5 1.1 2.2 1.1h4.8c.9 0 1.6-.2 2-.6.4-.4.5-1 .3-1.7z"/></svg>}
              ВКонтакте
            </button>

            <button onClick={() => { setTab('register'); setStep('phone'); }} className="w-full text-sm text-zinc-500 text-center">Нет аккаунта? Зарегистрироваться</button>
            {onSkip && <button onClick={onSkip} className="w-full text-sm text-zinc-600 hover:text-zinc-400 text-center mt-1">Пропустить — заказать без регистрации</button>}
          </div>
        )}
      </div>
    </div>
  );
}
