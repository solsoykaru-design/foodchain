import { useState, useEffect } from 'react';
import { Globe, Plus, Save, RefreshCw, Trash2, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import { addToast } from '../ToastContext';

const CURRENCIES = [
  { code: 'RUB', name: 'Российский рубль', symbol: '₽' },
  { code: 'USD', name: 'Доллар США', symbol: '$' },
  { code: 'EUR', name: 'Евро', symbol: '€' },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸' },
  { code: 'BYN', name: 'Белорусский рубль', symbol: 'Br' },
  { code: 'UZS', name: 'Узбекский сум', symbol: "so'm" },
  { code: 'AMD', name: 'Армянский драм', symbol: '֏' },
  { code: 'KGS', name: 'Киргизский сом', symbol: 'с' },
  { code: 'CNY', name: 'Китайский юань', symbol: '¥' },
  { code: 'TRY', name: 'Турецкая лира', symbol: '₺' },
  { code: 'GBP', name: 'Фунт стерлингов', symbol: '£' },
  { code: 'AED', name: 'Дирхам ОАЭ', symbol: 'د.إ' },
];

export default function CurrencySettingsPage() {
  const { t } = useTranslation();
  const [rates, setRates] = useState<any[]>([]);
  const [baseCurrency, setBaseCurrency] = useState('RUB');
  const [newRate, setNewRate] = useState({ currency_code: 'USD', rate: 1 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadRates();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await api.getTenantSettings();
      if (s?.base_currency) setBaseCurrency(s.base_currency);
    } catch {}
  };

  const loadRates = async () => {
    try {
      const r = await api.getExchangeRates();
      setRates(Array.isArray(r) ? r : []);
    } catch {}
  };

  const saveBaseCurrency = async () => {
    try {
      await api.updateTenantSettings({ base_currency: baseCurrency });
      addToast('Базовая валюта сохранена', 'success');
    } catch (e: any) { addToast('Ошибка: ' + e.message, 'error'); }
  };

  const addRate = async () => {
    try {
      await api.createExchangeRate(newRate);
      addToast('Курс добавлен', 'success');
      setNewRate({ currency_code: 'USD', rate: 1 });
      loadRates();
    } catch (e: any) { addToast('Ошибка: ' + e.message, 'error'); }
  };

  const updateRate = async (id: number, rate: number) => {
    try {
      await api.updateExchangeRate(id, rate);
      addToast('Курс обновлён', 'success');
      loadRates();
    } catch {}
  };

  const deleteRate = async (id: number) => {
    try {
      await api.deleteExchangeRate(id);
      loadRates();
    } catch {}
  };

  const autoUpdateRates = async () => {
    setLoading(true);
    try {
      await api.autoUpdateExchangeRates();
      addToast('Курсы обновлены через ЦБ РФ', 'success');
      loadRates();
    } catch (e: any) { addToast('Ошибка: ' + e.message, 'error'); }
    setLoading(false);
  };

  const getCurrencyInfo = (code: string) => CURRENCIES.find(c => c.code === code);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Globe size={24} /> Настройки валют</h1>

      {/* Base currency */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 mb-6">
        <h2 className="font-bold text-sm mb-3">Базовая валюта</h2>
        <div className="flex items-center gap-3">
          <select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm">
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
          </select>
          <button onClick={saveBaseCurrency} className="px-4 py-2 rounded-xl font-bold text-sm bg-blue-500 hover:bg-blue-600 text-white transition flex items-center gap-2">
            <Save size={16} /> Сохранить
          </button>
        </div>
        <p className="text-xs text-zinc-400 mt-2">Базовая валюта используется для всех внутренних расчётов и отчётов.</p>
      </div>

      {/* Exchange rates */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm">Курсы валют</h2>
          <button onClick={autoUpdateRates} disabled={loading}
            className="px-3 py-1.5 rounded-xl font-bold text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center gap-1.5"
          ><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Авто-обновление</button>
        </div>

        <div className="space-y-2 mb-4">
          {rates.map(r => {
            const ci = getCurrencyInfo(r.currency_code);
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-sm">
                <span className="w-8 text-lg text-center shrink-0">{ci?.symbol || '💱'}</span>
                <span className="w-12 font-bold shrink-0">{r.currency_code}</span>
                <span className="flex-1 text-xs text-zinc-400">{ci?.name || r.currency_code}</span>
                <input type="number" step="0.0001" defaultValue={r.rate}
                  onBlur={e => { const v = parseFloat(e.target.value); if (v && v !== r.rate) updateRate(r.id, v); }}
                  className="w-28 px-2 py-1 rounded bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-sm text-right font-mono"
                />
                {!r.is_base && (
                  <button onClick={() => deleteRate(r.id)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                )}
              </div>
            );
          })}
          {rates.length === 0 && <p className="text-center py-4 text-zinc-400 text-xs">Нет курсов валют. Добавьте хотя бы одну.</p>}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <h3 className="text-xs font-bold text-zinc-400 mb-2">Добавить валюту</h3>
          <div className="flex items-center gap-2">
            <select value={newRate.currency_code} onChange={e => setNewRate({ ...newRate, currency_code: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm">
              {CURRENCIES.filter(c => !rates.find(r => r.currency_code === c.code) && c.code !== baseCurrency).map(c => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
              ))}
            </select>
            <input type="number" step="0.0001" value={newRate.rate} onChange={e => setNewRate({ ...newRate, rate: parseFloat(e.target.value) || 1 })}
              placeholder="Курс"
              className="w-24 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm text-right font-mono"
            />
            <button onClick={addRate} className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition"><Plus size={16} /></button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          <strong>Как это работает:</strong> Гость в приложении может выбрать любую валюту из списка.
          Цены конвертируются по текущему курсу. В админ-панели цены всегда отображаются в базовой валюте.
          Отчёты формируются в базовой валюте, но можно указать валюту отчёта.
        </p>
      </div>
    </div>
  );
}
