import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <LogIn size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900">Вход в портал</h1>
          <p className="text-zinc-500 text-sm mt-1">Для партнёров FoodChain</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-sm">
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="partner@restaurant.ru"
              className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Пароль</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-60">
            {loading ? 'Вход...' : 'Войти'}
          </button>

          <p className="text-center text-xs text-zinc-500">
            Ещё нет аккаунта? <Link to="/register" className="text-orange-600 font-medium hover:underline">Зарегистрироваться</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
