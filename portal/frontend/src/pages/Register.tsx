import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { UserPlus, Eye, EyeOff, ArrowRight } from 'lucide-react';

export function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '', password: '', full_name: '',
    restaurant_name: '', inn: '', phone: '', address: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a192f] via-[#0f1f3d] to-[#0a192f]"></div>
      <div className="absolute top-[-250px] left-[-250px] w-[600px] h-[600px] bg-cyan-500/8 rounded-full blur-[150px]"></div>
      <div className="absolute bottom-[-200px] right-[-200px] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-md relative z-10 animate-[fadeUp_0.8s_ease]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
            <UserPlus size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Регистрация ресторана</h1>
          <p className="text-slate-400 text-sm mt-1.5">14 дней бесплатного доступа. Без привязки карты.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#112240]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0"></span>
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Название ресторана *</label>
              <input value={form.restaurant_name} onChange={handleChange('restaurant_name')} required placeholder="ООО «Ваш Ресторан»"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 outline-none transition" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">ИНН *</label>
              <input value={form.inn} onChange={handleChange('inn')} required placeholder="7701234567" maxLength={12}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Телефон *</label>
              <input value={form.phone} onChange={handleChange('phone')} required placeholder="+7 (999) 123-45-67" type="tel"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Ваше имя *</label>
              <input value={form.full_name} onChange={handleChange('full_name')} required placeholder="Иван Иванов"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 outline-none transition" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
              <input value={form.email} onChange={handleChange('email')} required type="email" placeholder="partner@restaurant.ru"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 outline-none transition" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Пароль *</label>
              <div className="relative">
                <input value={form.password} onChange={handleChange('password')} required type={showPw ? 'text' : 'password'} minLength={6} placeholder="Минимум 6 символов"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 outline-none pr-10 transition" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Адрес</label>
              <input value={form.address} onChange={handleChange('address')} placeholder="г. Москва, ул. Тверская, 15"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 outline-none transition" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-0.5 transition disabled:opacity-60 flex items-center justify-center gap-2 group">
            {loading ? 'Регистрация...' : <>Зарегистрировать ресторан <ArrowRight size={16} className="group-hover:translate-x-0.5 transition" /></>}
          </button>

          <p className="text-center text-xs text-slate-500">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-cyan-400 font-medium hover:text-cyan-300 transition">Войти</Link>
          </p>
        </form>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
