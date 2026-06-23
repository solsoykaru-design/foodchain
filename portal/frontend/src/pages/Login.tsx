import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { LogIn, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';

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
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a192f] via-[#0f1f3d] to-[#0a192f]"></div>
      <div className="absolute top-[-200px] right-[-200px] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-200px] left-[-200px] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-sm relative z-10 animate-[fadeUp_0.8s_ease]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
            <Shield size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Вход в портал</h1>
          <p className="text-slate-400 text-sm mt-1.5">Для партнёров FoodChain</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#112240]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0"></span>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="partner@restaurant.ru"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 outline-none transition" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Пароль</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 outline-none pr-10 transition" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-0.5 transition disabled:opacity-60 flex items-center justify-center gap-2 group">
            {loading ? 'Вход...' : <>Войти <ArrowRight size={16} className="group-hover:translate-x-0.5 transition" /></>}
          </button>

          <p className="text-center text-xs text-slate-500">
            Ещё нет аккаунта?{' '}
            <Link to="/register" className="text-cyan-400 font-medium hover:text-cyan-300 transition">Зарегистрироваться</Link>
          </p>
        </form>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
