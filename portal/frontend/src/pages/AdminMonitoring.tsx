import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Check, ExternalLink } from 'lucide-react';

export function AdminMonitoring() {
  const [status, setStatus] = useState<any[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([api.getUptimeStatus(), api.getResourceUsage()]);
      setStatus(s);
      setUsage(u);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runCheck = async () => {
    setRunning(true);
    await api.runUptimeCheck();
    await load();
    setRunning(false);
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'ok': return <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />;
      case 'degraded': return <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />;
      case 'down': return <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />;
      default: return <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 inline-block" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Мониторинг доступности</h1>
        <button onClick={runCheck} disabled={running}
          className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-xl hover:bg-zinc-800 transition text-sm flex items-center gap-2">
          {running ? 'Проверка...' : 'Проверить сейчас'}
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>
      ) : (
        <>
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden mb-8">
            <div className="px-5 py-3 border-b border-zinc-100 font-medium text-sm text-zinc-700">Статус арендаторов</div>
            <div className="divide-y divide-zinc-100">
              {status.map((s: any) => (
                <div key={s.tenant_id} className="px-5 py-3 flex items-center justify-between text-sm hover:bg-zinc-50">
                  <div className="flex items-center gap-3">
                    {statusIcon(s.status)}
                    <span className="text-zinc-900">{s.tenant_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.status === 'ok' ? 'bg-green-100 text-green-700' :
                      s.status === 'degraded' ? 'bg-amber-100 text-amber-700' :
                      s.status === 'down' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {s.status === 'ok' ? 'Работает' : s.status === 'degraded' ? 'Частично' : s.status === 'down' ? 'Не работает' : 'Неизвестно'}
                    </span>
                    {s.last_check?.response_time && (
                      <span className="text-xs text-zinc-400">{s.last_check.response_time}ms</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {usage.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100 font-medium text-sm text-zinc-700">Загрузка API (запросов за 30 дней)</div>
              <div className="divide-y divide-zinc-100">
                {usage.map((u: any) => (
                  <div key={u.tenant_id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <span className="text-zinc-900">{u.tenant_name}</span>
                    <span className="font-bold text-zinc-700">{u.api_requests_30d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
