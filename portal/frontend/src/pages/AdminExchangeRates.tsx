import { useEffect, useState } from 'react';
import { Globe, Plus, Save, RefreshCw, Trash2 } from 'lucide-react';
import { api, AVAILABLE_CURRENCIES } from '../api/client';

export function AdminExchangeRates() {
  const [rates, setRates] = useState<any[]>([]);
  const [newRate, setNewRate] = useState({ currency_code: 'USD', rate: 1 });
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    try {
      const r = await api.adminGetExchangeRates();
      setRates(Array.isArray(r) ? r : []);
    } catch {}
  };

  const addRate = async () => {
    try {
      const ci = AVAILABLE_CURRENCIES.find(c => c.code === newRate.currency_code);
      await api.adminCreateExchangeRate({
        currency_code: newRate.currency_code,
        name: ci?.name || newRate.currency_code,
        symbol: ci?.symbol || '',
        rate: newRate.rate,
      });
      setNewRate({ currency_code: 'USD', rate: 1 });
      loadRates();
    } catch (err: any) { alert(err.message); }
  };

  const updateRate = async (id: number, rate: number) => {
    try {
      await api.adminUpdateExchangeRate(id, { rate });
      loadRates();
    } catch (err: any) { alert(err.message); }
  };

  const deleteRate = async (id: number) => {
    try {
      await api.adminDeleteExchangeRate(id);
      loadRates();
    } catch (err: any) { alert(err.message); }
  };

  const autoUpdateRates = async () => {
    setLoading(true);
    try {
      const result = await api.adminAutoUpdateExchangeRates();
      alert(`Обновлено ${result.updated} курсов`);
      loadRates();
    } catch (err: any) { alert(err.message); }
    setLoading(false);
  };

  const getCurrencyInfo = (code: string) => AVAILABLE_CURRENCIES.find(c => c.code === code);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><Globe size={24} /> Курсы валют</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Управление курсами валют для всех ресторанов</p>
        </div>
        <button onClick={autoUpdateRates} disabled={loading}
          className="border border-zinc-300 text-zinc-700 font-medium px-4 py-2 rounded-xl hover:bg-zinc-50 transition text-sm flex items-center gap-2">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Авто-обновление
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6">
        <h2 className="font-bold text-sm text-zinc-700 mb-4">Текущие курсы</h2>
        <div className="space-y-2">
          {rates.map(r => {
            const ci = getCurrencyInfo(r.currency_code);
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 text-sm">
                <span className="w-8 text-lg text-center shrink-0">{ci?.symbol || r.symbol || '?'}</span>
                <span className="w-12 font-bold shrink-0 text-zinc-900">{r.currency_code}</span>
                <span className="flex-1 text-xs text-zinc-500">{ci?.name || r.name || r.currency_code}</span>
                <input type="number" step="0.0001" defaultValue={r.rate}
                  onBlur={e => { const v = parseFloat(e.target.value); if (v && v !== r.rate) updateRate(r.id, v); }}
                  className="w-28 px-2 py-1 rounded-lg bg-white border border-zinc-300 text-sm text-right font-mono focus:ring-2 focus:ring-orange-400 outline-none"
                />
                {!r.is_base && (
                  <button onClick={() => deleteRate(r.id)} className="text-red-400 hover:text-red-500 p-1"><Trash2 size={15} /></button>
                )}
              </div>
            );
          })}
          {rates.length === 0 && <p className="text-center py-6 text-zinc-400 text-sm">Нет курсов валют. Добавьте первую валюту.</p>}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6">
        <h2 className="font-bold text-sm text-zinc-700 mb-4">Добавить валюту</h2>
        <div className="flex items-center gap-3">
          <select value={newRate.currency_code} onChange={e => setNewRate({ ...newRate, currency_code: e.target.value })}
            className="flex-1 px-3 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400">
            {AVAILABLE_CURRENCIES.filter(c => !rates.find(r => r.currency_code === c.code)).map(c => (
              <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
            ))}
          </select>
          <input type="number" step="0.0001" value={newRate.rate} onChange={e => setNewRate({ ...newRate, rate: parseFloat(e.target.value) || 1 })}
            placeholder="Курс"
            className="w-28 px-3 py-2 border border-zinc-300 rounded-xl text-sm text-right font-mono outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button onClick={addRate} className="bg-zinc-900 text-white p-2.5 rounded-xl hover:bg-zinc-800 transition"><Plus size={18} /></button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <p className="text-sm text-amber-700">
          <strong>Как это работает:</strong> Курсы валют применяются ко всем ресторанам платформы.
          Базовая валюта (RUB) имеет курс 1. Цены в меню хранятся в базовой валюте и конвертируются при отображении гостю.
          Курсы можно обновить автоматически через Центральный банк РФ.
        </p>
      </div>
    </div>
  );
}