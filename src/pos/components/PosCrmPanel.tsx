import { useEffect, useState } from 'react';
import * as api from '../../api';

const PROVIDERS = [
  { key: 'amocrm', name: 'amoCRM', fields: ['domain', 'client_id', 'client_secret', 'redirect_uri'] },
  { key: 'bitrix24', name: 'Bitrix24', fields: ['domain', 'webhook'] },
];

export default function PosCrmPanel({ darkMode }: { darkMode: boolean }) {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const load = async () => {
    const next: Record<string, any> = {};
    for (const p of PROVIDERS) {
      try { next[p.key] = await api.request(`/api/pos/crm/${p.key}/settings`); } catch {}
    }
    setSettings(next);
  };
  useEffect(() => { load(); }, []);

  const save = async (provider: string, data: any) => {
    setLoading(prev => ({ ...prev, [provider]: true }));
    try { await api.request(`/api/pos/crm/${provider}/settings`, { method: 'PUT', body: JSON.stringify(data) }); await load(); } finally { setLoading(prev => ({ ...prev, [provider]: false })); }
  };

  const test = async (provider: string, data: any) => {
    setLoading(prev => ({ ...prev, [provider + '_test']: true }));
    try {
      const res = await api.request(`/api/pos/crm/${provider}/test`, { method: 'POST', body: JSON.stringify(data) });
      alert(res.ok ? 'Подключение успешно' : 'Ошибка: ' + (res.error || JSON.stringify(res)));
    } catch (e: any) { alert(e.message); } finally { setLoading(prev => ({ ...prev, [provider + '_test']: false })); }
  };

  const oauth = async (provider: string) => {
    try {
      const res = await api.request(`/api/pos/crm/${provider}/auth-url`);
      if (res.url) window.open(res.url, '_blank');
    } catch (e: any) { alert(e.message); }
  };

  const exportClients = async (provider: string) => {
    setLoading(prev => ({ ...prev, [provider + '_export']: true }));
    try {
      const res = await api.request(`/api/pos/crm/${provider}/export-clients`, { method: 'POST' });
      alert(res.success ? `Экспортировано: ${res.exported}` : 'Ошибка: ' + res.error);
    } catch (e: any) { alert(e.message); } finally { setLoading(prev => ({ ...prev, [provider + '_export']: false })); }
  };

  return (
    <div className={`flex-1 overflow-y-auto p-4 ${darkMode ? 'text-zinc-100' : 'text-zinc-900'}`}>
      <h2 className="font-bold mb-3">CRM / лояльность</h2>
      <div className="space-y-3">
        {PROVIDERS.map(p => {
          const s = settings[p.key] || {};
          return (
            <div key={p.key} className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{p.name}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!s.enabled} onChange={e => save(p.key, { ...s, enabled: e.target.checked })} />
                  Включено
                </label>
              </div>
              {p.fields.map(f => (
                <input key={f} type="text" value={s[f] || ''} placeholder={f}
                  onChange={e => save(p.key, { ...s, [f]: e.target.value })}
                  className={`w-full mb-2 px-3 py-2 rounded-xl border text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
              ))}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => test(p.key, s)} disabled={loading[p.key + '_test']} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">Проверить</button>
                {p.key === 'amocrm' && <button onClick={() => oauth(p.key)} className="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold">OAuth amoCRM</button>}
                <button onClick={() => exportClients(p.key)} disabled={loading[p.key + '_export']} className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold disabled:opacity-50">Экспорт клиентов</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
