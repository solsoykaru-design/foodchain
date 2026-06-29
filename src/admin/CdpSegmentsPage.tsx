import { useEffect, useState } from 'react';
import * as api from '../api';
import { Users, RefreshCw, User } from 'lucide-react';
import { addToast } from '../ToastContext';

const SEGMENT_NAMES: Record<string, string> = {
  champions: 'Чемпионы',
  loyal: 'Лояльные',
  new: 'Новые',
  potential: 'Потенциал',
  at_risk: 'В зоне риска',
  hibernating: 'Спящие',
  others: 'Остальные',
};

const SEGMENT_COLORS: Record<string, string> = {
  champions: 'bg-yellow-100 text-yellow-800',
  loyal: 'bg-green-100 text-green-800',
  new: 'bg-blue-100 text-blue-800',
  potential: 'bg-purple-100 text-purple-800',
  at_risk: 'bg-orange-100 text-orange-800',
  hibernating: 'bg-zinc-100 text-zinc-800',
  others: 'bg-zinc-50 text-zinc-600',
};

export default function CdpSegmentsPage() {
  const [segments, setSegments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { setSegments(await api.request('/api/cdp/segments')); } catch {}
  };
  const loadProfiles = async (segment: string) => {
    try {
      const r = await api.request(`/api/cdp/profiles?segment=${encodeURIComponent(segment)}&limit=50`);
      setProfiles(Array.isArray(r) ? r : []);
    } catch {}
  };
  const recalc = async () => {
    setLoading(true);
    try { await api.request('/api/cdp/rfm/calculate', { method: 'POST' }); addToast('RFM пересчитан', 'success'); load(); } catch (e: any) { addToast(e.message, 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users /> CDP / RFM сегменты</h1>
        <button onClick={recalc} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2 disabled:opacity-50"><RefreshCw size={18} /> Пересчитать RFM</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {segments.map(s => (
          <button key={s.segment} onClick={() => loadProfiles(s.segment)} className={`p-4 rounded-xl border text-left transition hover:shadow ${SEGMENT_COLORS[s.segment] || 'bg-white dark:bg-zinc-900'}`}>
            <p className="text-xs opacity-70 uppercase">{SEGMENT_NAMES[s.segment] || s.segment}</p>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs opacity-80">{Number(s.avgMonetary).toFixed(0)}₽ LTV · {Math.round(s.avgRecency)} дн.</p>
          </button>
        ))}
      </div>
      {profiles.length > 0 && (
        <div className="rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="font-bold mb-3 flex items-center gap-2"><User size={18} /> Клиенты сегмента</h2>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-800"><tr><th className="px-3 py-2 text-left">Имя</th><th className="px-3 py-2 text-left">Телефон</th><th className="px-3 py-2 text-right">Заказов</th><th className="px-3 py-2 text-right">LTV</th><th className="px-3 py-2 text-right">Recency</th></tr></thead>
              <tbody>
                {profiles.map((p: any) => (
                  <tr key={p.user.id} className="border-t dark:border-zinc-800">
                    <td className="px-3 py-2">{p.user.name || '—'}</td>
                    <td className="px-3 py-2">{p.user.phone || '—'}</td>
                    <td className="px-3 py-2 text-right">{p.rfm?.frequency || 0}</td>
                    <td className="px-3 py-2 text-right">{Number(p.rfm?.monetary || 0).toFixed(0)}₽</td>
                    <td className="px-3 py-2 text-right">{p.rfm?.recencyDays || 0} дн.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
