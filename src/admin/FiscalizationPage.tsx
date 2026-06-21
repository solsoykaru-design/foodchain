import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import {
  Printer, Settings, RefreshCw, CheckCircle, XCircle, Loader,
  Save, Play, Eye, EyeOff, Filter, X, FileText, AlertTriangle,
  DollarSign, Clock, Search, Download, Trash2,
} from 'lucide-react';

const PROVIDERS = [
  { key: 'atol', label: 'Атол', desc: 'Серии 30Ф, 60Ф, 90Ф' },
  { key: 'shtrih', label: 'Штрих-М', desc: 'ФР-01Ф, ФР-20Ф' },
  { key: 'evotor', label: 'Эвотор', desc: 'Все модели' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'В очереди',
  printed: 'Напечатан',
  error: 'Ошибка',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  printed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

export default function FiscalizationPage() {
  const [tab, setTab] = useState<'settings' | 'receipts' | 'stats'>('settings');
  const [settings, setSettings] = useState<any[]>([]);
  const [activeProvider, setActiveProvider] = useState('atol');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; data: any } | null>(null);
  const [receipts, setReceipts] = useState<any>({ items: [], total: 0, page: 1, totalPages: 0 });
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptFilters, setReceiptFilters] = useState<{ status?: string }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [showKey, setShowKey] = useState(false);

  const getActiveSettings = () => {
    const s = settings.find(s => s.provider === activeProvider);
    if (!s) return {
      enabled: false, provider: activeProvider, is_test: 1,
      settings: { ip: '', port: 7777, login: '', password: '', api_key: '', group_code: '', inn: '', payment_address: '', vat: 'none', print_receipt: true },
    };
    return s;
  };

  const [form, setForm] = useState<any>({});

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.getFiscalSettings();
      setSettings(data);
      const active = data.find((s: any) => s.enabled) || data[0];
      if (active) setActiveProvider(active.provider);
    } catch (e) { console.error(e); }
  }, []);

  const loadReceipts = useCallback(async (page = 1, filters = receiptFilters) => {
    setReceiptsLoading(true);
    try {
      const data = await api.getFiscalReceipts({ page, limit: 20, ...filters });
      setReceipts(data);
      setReceiptPage(page);
    } catch (e) { console.error(e); } finally { setReceiptsLoading(false); }
  }, [receiptFilters]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getFiscalStats();
      setStats(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    Promise.all([loadSettings(), loadReceipts(), loadStats()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const s = getActiveSettings();
    const ps = s.parsedSettings || (typeof s.settings === 'object' ? s.settings : (() => { try { return JSON.parse(s.settings || '{}'); } catch { return {}; } })());
    setForm({
      enabled: s.enabled,
      is_test: s.is_test,
      ip: ps.ip || '',
      port: ps.port || 7777,
      login: ps.login || '',
      password: ps.password || '',
      api_key: ps.api_key || '',
      group_code: ps.group_code || '',
      inn: ps.inn || '',
      payment_address: ps.payment_address || '',
      vat: ps.vat || 'none',
      print_receipt: ps.print_receipt !== false,
    });
    setTestResult(null);
  }, [activeProvider, settings]);

  useEffect(() => { loadReceipts(1); }, [receiptFilters]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateFiscalSettings(activeProvider, {
        enabled: form.enabled,
        is_test: form.is_test,
        settings: {
          ip: form.ip, port: Number(form.port), login: form.login, password: form.password,
          api_key: form.api_key, group_code: form.group_code,
          inn: form.inn, payment_address: form.payment_address,
          vat: form.vat, print_receipt: form.print_receipt,
        },
      });
      await loadSettings();
      addToast('Настройки сохранены', 'success');
    } catch (e: any) { addToast(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testFiscalConnection(activeProvider, {
        ip: form.ip, port: Number(form.port), login: form.login, password: form.password,
        api_key: form.api_key, group_code: form.group_code,
      });
      setTestResult(result);
    } catch (e: any) { setTestResult({ ok: false, data: e.message }); } finally { setTesting(false); }
  };

  const handleRetry = async (receiptId: number) => {
    try {
      const result = await api.retryFiscalReceipt(receiptId);
      if (result.ok) addToast('Чек отправлен', 'success');
      else addToast(result.data || 'Ошибка', 'error');
      loadReceipts(receiptPage);
      loadStats();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleProcessQueue = async () => {
    try {
      const result = await api.processFiscalQueue();
      addToast(`Обработано: ${result.processed} из ${result.total}`, 'success');
      loadReceipts();
      loadStats();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const clearFilters = () => setReceiptFilters({});

  if (loading) return <div className="flex items-center justify-center h-64"><Loader className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
          <Printer size={22} className="text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Фискализация (54-ФЗ)</h1>
          <p className="text-sm text-zinc-500">Подключение и управление онлайн-кассами</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 text-sm w-fit">
        <button onClick={() => setTab('settings')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition ${tab === 'settings' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
          <Settings size={16} /> Настройки кассы
        </button>
        <button onClick={() => setTab('receipts')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition ${tab === 'receipts' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
          <FileText size={16} /> Чеки ({receipts.total})
        </button>
        <button onClick={() => setTab('stats')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition ${tab === 'stats' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
          <DollarSign size={16} /> Статистика
        </button>
      </div>

      {tab === 'settings' && (
        <div className="space-y-6">
          {/* Provider selector */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Printer size={18} className="text-zinc-500" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Модель кассы</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {PROVIDERS.map(p => {
                const s = settings.find(x => x.provider === p.key);
                const isActive = activeProvider === p.key;
                return (
                  <button key={p.key} onClick={() => setActiveProvider(p.key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                    <p className="font-bold text-zinc-900 dark:text-white">{p.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{p.desc}</p>
                    {s && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium mt-2 px-2 py-0.5 rounded-full ${s.enabled ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        {s.enabled ? 'Активна' : 'Отключена'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connection settings */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-zinc-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Параметры подключения</h2>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setForm({ ...form, enabled: !form.enabled })} className={`w-11 h-6 rounded-full transition-all relative ${form.enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${form.enabled ? 'left-6' : 'left-1'}`} />
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Касса включена</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">IP-адрес кассы</label>
                <input type="text" value={form.ip || ''} onChange={e => setForm({ ...form, ip: e.target.value })}
                  placeholder="192.168.1.100"
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Порт</label>
                <input type="number" value={form.port || ''} onChange={e => setForm({ ...form, port: e.target.value })}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Логин</label>
                <input type="text" value={form.login || ''} onChange={e => setForm({ ...form, login: e.target.value })}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Пароль</label>
                <div className="relative">
                  <input type={showKey ? 'text' : 'password'} value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 pr-10 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"><Eye size={16} /></button>
                </div>
              </div>
            </div>

            {/* Cloud API settings (for ATOL Online) */}
            {activeProvider === 'atol' && (
              <>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 mt-4">Настройки Атол Онлайн (облачные)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">API-ключ</label>
                    <input type="text" value={form.api_key || ''} onChange={e => setForm({ ...form, api_key: e.target.value })}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Group Code (код группы)</label>
                    <input type="text" value={form.group_code || ''} onChange={e => setForm({ ...form, group_code: e.target.value })}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
                  </div>
                </div>
              </>
            )}

            {/* Fiscal params */}
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 mt-4">Параметры фискализации</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">ИНН организации</label>
                <input type="text" value={form.inn || ''} onChange={e => setForm({ ...form, inn: e.target.value })}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Адрес расчётов (место установки)</label>
                <input type="text" value={form.payment_address || ''} onChange={e => setForm({ ...form, payment_address: e.target.value })}
                  placeholder="г. Москва, ул. Ленина, д. 1"
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">НДС</label>
                <select value={form.vat || 'none'} onChange={e => setForm({ ...form, vat: e.target.value })}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 outline-none transition-all">
                  <option value="none">Без НДС</option>
                  <option value="vat0">НДС 0%</option>
                  <option value="vat10">НДС 10%</option>
                  <option value="vat20">НДС 20%</option>
                  <option value="vat110">НДС 10/110</option>
                  <option value="vat120">НДС 20/120</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer mt-6">
                  <input type="checkbox" checked={form.print_receipt !== false} onChange={e => setForm({ ...form, print_receipt: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 text-blue-600" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Печатать бумажный чек</span>
                </label>
              </div>
            </div>

            {/* Test & Save */}
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleTest} disabled={testing}
                className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-50 flex items-center gap-2">
                {testing ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Проверить подключение
              </button>
              {testResult && (
                <span className={`flex items-center gap-1 text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {testResult.ok ? 'Касса доступна' : (testResult.data?.message || testResult.data || 'Ошибка')}
                </span>
              )}
              <div className="flex-1" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_test === 1 || form.is_test === true} onChange={e => setForm({ ...form, is_test: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-600" />
                <span className="text-sm text-zinc-500">Тестовый режим</span>
              </label>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'receipts' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-zinc-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Фискальные чеки</h2>
                <span className="text-xs text-zinc-400">({receipts.total})</span>
              </div>
              <div className="flex gap-2">
                <button onClick={handleProcessQueue} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50">
                  <Play size={12} /> Обработать очередь
                </button>
                <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${Object.keys(receiptFilters).length > 0 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                  <Filter size={12} /> Фильтр
                </button>
              </div>
            </div>
            {showFilters && (
              <div className="flex flex-wrap gap-2 mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">Статус:</span>
                  <select value={receiptFilters.status || ''} onChange={e => setReceiptFilters(f => ({ ...f, status: e.target.value || undefined }))}
                    className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                    <option value="">Все</option>
                    <option value="pending">В очереди</option>
                    <option value="printed">Напечатан</option>
                    <option value="error">Ошибка</option>
                  </select>
                </div>
                {Object.keys(receiptFilters).length > 0 && (
                  <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500"><X size={12} /> Сбросить</button>
                )}
              </div>
            )}
          </div>

          {receiptsLoading ? (
            <div className="flex justify-center py-12"><Loader className="w-5 h-5 animate-spin text-blue-500" /></div>
          ) : receipts.items?.length === 0 ? (
            <div className="py-12 text-center">
              <Printer size={36} className="mx-auto text-zinc-300 mb-3" />
              <p className="text-zinc-400 text-sm">Чеки не найдены</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                    <tr>
                      <th className="text-left p-3 text-zinc-500 font-medium text-xs">ID</th>
                      <th className="text-left p-3 text-zinc-500 font-medium text-xs">Дата</th>
                      <th className="text-left p-3 text-zinc-500 font-medium text-xs">Тип</th>
                      <th className="text-left p-3 text-zinc-500 font-medium text-xs">Заказ</th>
                      <th className="text-right p-3 text-zinc-500 font-medium text-xs">Сумма</th>
                      <th className="text-left p-3 text-zinc-500 font-medium text-xs">Оплата</th>
                      <th className="text-left p-3 text-zinc-500 font-medium text-xs">Статус</th>
                      <th className="text-left p-3 text-zinc-500 font-medium text-xs">Ошибка</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.items.map((r: any) => (
                      <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="p-3 text-xs text-zinc-500">#{r.id}</td>
                        <td className="p-3 text-xs text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{new Date(r.created_at).toLocaleString('ru-RU')}</td>
                        <td className="p-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.receipt_type === 'sell' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700'}`}>
                            {r.receipt_type === 'sell' ? 'Приход' : 'Возврат'}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-zinc-700 dark:text-zinc-300">#{r.order_id || '—'}</td>
                        <td className="p-3 text-right font-bold text-zinc-900 dark:text-white">{Math.abs(r.total).toLocaleString()}₽</td>
                        <td className="p-3 text-xs text-zinc-500">{r.payment_method === 'cash' ? 'Наличные' : r.payment_method === 'card' ? 'Карта' : r.payment_method || '—'}</td>
                        <td className="p-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || ''}`}>
                            {STATUS_LABELS[r.status] || r.status}
                          </span>
                        </td>
                        <td className="p-3 max-w-[150px]">
                          {r.error ? (
                            <span className="text-xs text-red-500 truncate block" title={r.error}>
                              <AlertTriangle size={10} className="inline mr-0.5" />
                              {r.error.length > 40 ? r.error.slice(0, 40) + '...' : r.error}
                            </span>
                          ) : <span className="text-xs text-zinc-400">—</span>}
                        </td>
                        <td className="p-3">
                          {r.status !== 'printed' && (
                            <button onClick={() => handleRetry(r.id)} className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
                              <RefreshCw size={10} /> Повтор
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {receipts.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-400">Страница {receiptPage} из {receipts.totalPages}</span>
                  <div className="flex gap-1">
                    <button disabled={receiptPage <= 1} onClick={() => loadReceipts(receiptPage - 1)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40">Назад</button>
                    <button disabled={receiptPage >= receipts.totalPages} onClick={() => loadReceipts(receiptPage + 1)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40">Вперёд</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <p className="text-xs text-zinc-500 mb-1"><Printer size={14} className="inline" /> Всего чеков</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats?.total || 0}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <p className="text-xs text-zinc-500 mb-1"><CheckCircle size={14} className="inline text-green-500" /> Напечатано</p>
              <p className="text-2xl font-bold text-green-500">{stats?.printed || 0}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <p className="text-xs text-zinc-500 mb-1"><Clock size={14} className="inline text-yellow-500" /> В очереди</p>
              <p className="text-2xl font-bold text-yellow-500">{stats?.pending || 0}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <p className="text-xs text-zinc-500 mb-1"><XCircle size={14} className="inline text-red-500" /> Ошибок</p>
              <p className="text-2xl font-bold text-red-500">{stats?.errors || 0}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <p className="text-xs text-zinc-500 mb-1"><DollarSign size={14} className="inline text-blue-500" /> Фискализовано</p>
              <p className="text-2xl font-bold text-blue-500">{(stats?.totalSum || 0).toLocaleString()}₽</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}