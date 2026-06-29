import { useEffect, useState } from 'react';
import * as api from '../../api';

const PROVIDERS = [
  { key: 'yandex', name: 'Яндекс Еда', fields: ['apiKey', 'restaurantId'] },
  { key: 'delivery_club', name: 'Delivery Club', fields: ['apiKey', 'restaurantId'] },
  { key: 'sbermarket', name: 'СберМаркет', fields: ['apiKey', 'merchantId'] },
];

export default function PosAggregatorsPanel({ darkMode }: { darkMode: boolean }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const load = async () => {
    try { setList(await api.request('/api/pos/aggregators')); } catch {}
  };
  useEffect(() => { load(); }, []);

  const update = async (provider: string, data: any) => {
    setLoading(prev => ({ ...prev, [provider]: true }));
    try { await api.request(`/api/pos/aggregators/${provider}`, { method: 'PUT', body: JSON.stringify(data) }); await load(); } finally { setLoading(prev => ({ ...prev, [provider]: false })); }
  };

  const test = async (provider: string, credentials: any) => {
    setLoading(prev => ({ ...prev, [provider + '_test']: true }));
    try {
      const res = await api.request(`/api/pos/aggregators/${provider}/test`, { method: 'POST', body: JSON.stringify({ credentials }) });
      alert(res.ok ? 'Подключение успешно' : 'Ошибка: ' + JSON.stringify(res.data));
    } catch (e: any) { alert(e.message); } finally { setLoading(prev => ({ ...prev, [provider + '_test']: false })); }
  };

  const syncMenu = async (provider: string) => {
    setLoading(prev => ({ ...prev, [provider + '_sync']: true }));
    try {
      const res = await api.request(`/api/pos/aggregators/${provider}/sync-menu`, { method: 'POST' });
      alert(res.ok ? 'Меню синхронизировано' : 'Ошибка: ' + JSON.stringify(res.data));
      await load();
    } catch (e: any) { alert(e.message); } finally { setLoading(prev => ({ ...prev, [provider + '_sync']: false })); }
  };

  return (
    <div className={`flex-1 overflow-y-auto p-4 ${darkMode ? 'text-zinc-100' : 'text-zinc-900'}`}>
      <h2 className="font-bold mb-3">Агрегаторы доставки</h2>
      <div className="space-y-3">
        {PROVIDERS.map(p => {
          const item = list.find((x: any) => x.provider === p.key) || { enabled: false, credentials: {} };
          return (
            <div key={p.key} className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{p.name}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={item.enabled} onChange={e => update(p.key, { enabled: e.target.checked, credentials: item.credentials })} />
                  Включено
                </label>
              </div>
              {p.fields.map(f => (
                <input key={f} type="text" value={item.credentials[f] || ''} placeholder={f}
                  onChange={e => update(p.key, { enabled: item.enabled, credentials: { ...item.credentials, [f]: e.target.value } })}
                  className={`w-full mb-2 px-3 py-2 rounded-xl border text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'}`} />
              ))}
              <div className="flex gap-2">
                <button onClick={() => test(p.key, item.credentials)} disabled={loading[p.key + '_test']} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">Проверить</button>
                <button onClick={() => syncMenu(p.key)} disabled={loading[p.key + '_sync']} className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold disabled:opacity-50">Синхронизировать меню</button>
              </div>
              {item.lastMenuSyncAt && <p className="text-[10px] opacity-60 mt-2">Последняя синхронизация: {new Date(item.lastMenuSyncAt).toLocaleString('ru-RU')}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
