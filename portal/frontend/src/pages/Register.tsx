import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

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
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserPlus size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900">Регистрация ресторана</h1>
          <p className="text-zinc-500 text-sm mt-1">14 дней бесплатного доступа</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-sm">
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Название ресторана *</label>
              <input value={form.restaurant_name} onChange={handleChange('restaurant_name')} required placeholder="ООО «Ваш Ресторан»"
                className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">ИНН *</label>
              <input value={form.inn} onChange={handleChange('inn')} required placeholder="7701234567" maxLength={12}
                className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Телефон *</label>
              <input value={form.phone} onChange={handleChange('phone')} required placeholder="+7 (999) 123-45-67" type="tel"
                className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Ваше имя *</label>
              <input value={form.full_name} onChange={handleChange('full_name')} required placeholder="Иван Иванов"
                className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email *</label>
              <input value={form.email} onChange={handleChange('email')} required type="email" placeholder="partner@restaurant.ru"
                className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Пароль *</label>
              <div className="relative">
                <input value={form.password} onChange={handleChange('password')} required type={showPw ? 'text' : 'password'} minLength={6} placeholder="Минимум 6 символов"
                  className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Адрес</label>
              <input value={form.address} onChange={handleChange('address')} placeholder="г. Москва, ул. Тверская, 15"
                className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60">
            {loading ? 'Регистрация...' : 'Зарегистрировать ресторан'}
          </button>

          <p className="text-center text-xs text-zinc-500">
            Уже есть аккаунт? <Link to="/login" className="text-orange-600 font-medium hover:underline">Войти</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
