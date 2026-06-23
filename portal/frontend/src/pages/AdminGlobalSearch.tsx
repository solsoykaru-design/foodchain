import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ExternalLink, Users, UserCheck } from 'lucide-react';

export function AdminGlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({ tenants: [], users: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length < 2) { setResults({ tenants: [], users: [] }); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.globalSearch(query);
        setResults(r);
      } catch {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </button>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Глобальный поиск</h1>

      <div className="relative mb-8">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по названию, ИНН, email, ФИО..."
          className="w-full pl-11 pr-4 py-3 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
      </div>

      {loading && <div className="animate-pulse text-zinc-400 text-center py-8">Поиск...</div>}

      {!loading && results.tenants?.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold text-zinc-900 mb-3 flex items-center gap-2"><ExternalLink size={16} /> Арендаторы</h2>
          <div className="space-y-2">
            {results.tenants.map((t: any) => (
              <div key={t.id} className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm hover:shadow-sm transition cursor-pointer"
                onClick={() => navigate('/admin')}>
                <div className="font-medium text-zinc-900">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.email} · {t.inn}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && results.users?.length > 0 && (
        <div>
          <h2 className="font-bold text-zinc-900 mb-3 flex items-center gap-2"><Users size={16} /> Пользователи</h2>
          <div className="space-y-2">
            {results.users.map((u: any) => (
              <div key={u.id} className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm">
                <div className="font-medium text-zinc-900">{u.full_name || u.email}</div>
                <div className="text-xs text-zinc-500">{u.email} · {u.role} · {u.tenant_name || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && query.length >= 2 && !results.tenants?.length && !results.users?.length && (
        <p className="text-center text-zinc-400 text-sm py-8">Ничего не найдено</p>
      )}
    </div>
  );
}
