import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import {
  GitCompare, Settings, RefreshCw, CheckCircle, XCircle, Loader,
  Clock, ArrowUpDown, FileText, Save, Play, Eye, EyeOff,
  Filter, ChevronDown, ChevronUp, AlertTriangle, Database, Package,
  ShoppingBag, Users, ChefHat, DollarSign, Truck, Search, X,
} from 'lucide-react';

const SYNC_OPERATIONS = [
  { key: 'export_orders', label: 'Выгружать заказы в 1С', icon: ShoppingBag, dir: 'export', desc: 'Заказы клиентов для бухгалтерского учёта' },
  { key: 'import_goods', label: 'Импортировать товары из 1С', icon: Package, dir: 'import', desc: 'Номенклатура склада (ингредиенты, материалы)' },
  { key: 'import_contragents', label: 'Импортировать контрагентов', icon: Users, dir: 'import', desc: 'Поставщики и клиенты из 1С' },
  { key: 'import_menu', label: 'Импортировать меню из 1С', icon: ChefHat, dir: 'import', desc: 'Блюда, категории, цены из 1С' },
  { key: 'export_tech_cards', label: 'Выгружать техкарты в 1С', icon: FileText, dir: 'export', desc: 'Состав блюд и нормы закладки' },
  { key: 'sync_prices', label: 'Синхронизировать цены', icon: DollarSign, dir: 'export', desc: 'Двусторонняя синхронизация цен товаров и блюд' },
  { key: 'export_remains', label: 'Выгружать остатки в 1С', icon: Database, dir: 'export', desc: 'Текущие складские остатки' },
];

export default function Integration1CPage() {
  const [settings, setSettings] = useState<any>({
    enabled: false, api_url: '', api_key: '', login: '', password: '',
    sync_interval: 'manual', sync_hour: 3,
    export_orders: true, import_goods: true, import_contragents: false,
    import_menu: false, export_tech_cards: false, sync_prices: false, export_remains: false,
    last_sync_at: null, last_sync_status: 'never',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; data: any } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [showKey, setShowKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logs, setLogs] = useState<any>({ items: [], total: 0, page: 1, totalPages: 0 });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logFilters, setLogFilters] = useState<{ direction?: string; status?: string; operation?: string }>({});
  const [showFilters, setShowFilters] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.get1CSettings();
      setSettings(data);
    } catch (e) { console.error(e); }
  }, []);

  const loadLogs = useCallback(async (page = 1, filters = logFilters) => {
    setLogsLoading(true);
    try {
      const data = await api.get1CLogs({ page, limit: 20, ...filters });
      setLogs(data);
      setLogPage(page);
    } catch (e) { console.error(e); } finally { setLogsLoading(false); }
  }, [logFilters]);

  useEffect(() => {
    Promise.all([loadSettings(), loadLogs()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadLogs(1); }, [logFilters]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.update1CSettings(settings);
      if (result) {
        await loadSettings();
        setTestResult(null);
        addToast('Настройки сохранены', 'success');
      }
    } catch (e: any) { addToast(e.message, 'error'); } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.test1CConnection();
      setTestResult(result);
    } catch (e: any) { setTestResult({ ok: false, data: e.message }); } finally { setTesting(false); }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncResults(null);
    try {
      const result = await api.sync1C();
      setSyncResults(result);
      await loadLogs();
      await loadSettings();
    } catch (e: any) { setSyncResults({ ok: false, data: { error: e.message } }); } finally { setSyncing(false); }
  };

  const handleSingleSync = async (operation: string) => {
    setSyncing(true);
    try {
      const result = await api.request(`/api/admin/integrations/1c/sync/${operation}`, { method: 'POST' });
      setSyncResults({ ok: result.ok, data: { [operation]: result.data } });
      await loadLogs();
      await loadSettings();
    } catch (e: any) { setSyncResults({ ok: false, data: { error: e.message } }); } finally { setSyncing(false); }
  };

  const update = (key: string, value: any) => setSettings((prev: any) => ({ ...prev, [key]: value }));

  const clearFilters = () => setLogFilters({});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <GitCompare size={22} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Интеграция с 1С</h1>
          <p className="text-sm text-zinc-500">Двусторонний обмен данными с 1С:Предприятие</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => update('enabled', settings.enabled ? 0 : 1)} className={`w-11 h-6 rounded-full transition-all relative ${settings.enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.enabled ? 'left-6' : 'left-1'}`} />
            </div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Включено</span>
          </label>
          <span className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
            settings.last_sync_status === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
            settings.last_sync_status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
            'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
          }`}>
            {settings.last_sync_status === 'success' ? <CheckCircle size={14} /> : settings.last_sync_status === 'error' ? <XCircle size={14} /> : <Clock size={14} />}
            {settings.last_sync_status === 'success' ? 'Успешно' : settings.last_sync_status === 'error' ? 'Ошибка' : 'Нет синхронизации'}
          </span>
        </div>
      </div>

      {/* Settings card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Settings size={18} className="text-zinc-500" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Настройки подключения к 1С</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">URL сервера 1С</label>
            <input type="text" value={settings.api_url || ''} onChange={e => update('api_url', e.target.value)}
              placeholder="https://1c-server.example.com/api/v1"
              className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">API-ключ (или оставьте пустым)</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={settings.api_key || ''} onChange={e => update('api_key', e.target.value)}
                placeholder="Bearer token"
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 pr-10 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Логин (Basic Auth)</label>
            <input type="text" value={settings.login || ''} onChange={e => update('login', e.target.value)}
              placeholder="Логин от 1С"
              className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Пароль (Basic Auth)</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={settings.password || ''} onChange={e => update('password', e.target.value)}
                placeholder="Пароль от 1С"
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 pr-10 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Периодичность синхронизации</label>
            <select value={settings.sync_interval || 'manual'} onChange={e => update('sync_interval', e.target.value)}
              className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
              <option value="manual">Вручную</option>
              <option value="hourly">Каждый час</option>
              <option value="daily">Ежедневно</option>
            </select>
          </div>
          {settings.sync_interval === 'daily' && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Час синхронизации</label>
              <select value={settings.sync_hour ?? 3} onChange={e => update('sync_hour', Number(e.target.value))}
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Test connection */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleTest} disabled={testing}
            className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-50 flex items-center gap-2">
            {testing ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Проверить соединение
          </button>
          {testResult && (
            <span className={`flex items-center gap-1 text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {testResult.ok ? 'Соединение установлено' : (testResult.data?.message || testResult.data || 'Ошибка')}
            </span>
          )}
        </div>

        {/* Sync directions */}
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Направления синхронизации</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SYNC_OPERATIONS.map(op => (
              <label key={op.key} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                <input type="checkbox" checked={!!(settings as any)[op.key]} onChange={e => update(op.key, e.target.checked ? 1 : 0)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <op.icon size={16} className="text-zinc-500 shrink-0" />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{op.label}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${op.dir === 'export' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                      {op.dir === 'export' ? 'Экспорт' : 'Импорт'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{op.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Save & last sync info */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
            Сохранить настройки
          </button>
          {settings.last_sync_at && (
            <span className="text-xs text-zinc-400">
              Последняя синхронизация: {new Date(settings.last_sync_at).toLocaleString('ru-RU')}
            </span>
          )}
        </div>
      </div>

      {/* Sync section */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Play size={18} className="text-zinc-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Синхронизация</h2>
          </div>
          <button onClick={handleSyncAll} disabled={syncing || !settings.enabled}
            className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition disabled:opacity-50 flex items-center gap-2">
            {syncing ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {syncing ? 'Выполняется...' : 'Полная синхронизация'}
          </button>
        </div>

        {/* Individual sync buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {SYNC_OPERATIONS.map(op => (
            <button key={op.key} onClick={() => handleSingleSync(op.key)} disabled={syncing || !settings.enabled || !(settings as any)[op.key]}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
              <op.icon size={12} />
              {op.label.replace(/^.*? /, '').replace(/ в 1С| из 1С/, '')}
            </button>
          ))}
        </div>

        {syncResults && (
          <div className={`p-4 rounded-xl text-sm ${syncResults.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
            <p className="font-medium mb-2">{syncResults.ok ? 'Синхронизация завершена' : 'Ошибка синхронизации'}</p>
            {syncResults.data && typeof syncResults.data === 'object' ? (
              <div className="space-y-1">
                {Object.entries(syncResults.data).map(([k, v]) => {
                  const op = SYNC_OPERATIONS.find(o => o.key === k);
                  const val = v as any;
                  const isOk = val?.ok !== false;
                  return (
                    <div key={k} className={`flex items-center gap-2 text-xs ${isOk ? 'opacity-80' : 'opacity-100'}`}>
                      {isOk ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      <span className="font-medium">{op?.label || k}:</span>
                      <span>{val?.note || val?.message || val?.error || JSON.stringify(val)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs opacity-80">{typeof syncResults.data === 'string' ? syncResults.data : syncResults.error || ''}</p>
            )}
          </div>
        )}
      </div>

      {/* Logs section */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-zinc-500" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Журнал синхронизации</h2>
              <span className="text-xs text-zinc-400">({logs.total} записей)</span>
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${Object.keys(logFilters).length > 0 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
              <Filter size={12} />
              Фильтр {Object.keys(logFilters).length > 0 && `(${Object.keys(logFilters).length})`}
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-500">Операция:</span>
                <select value={logFilters.operation || ''} onChange={e => setLogFilters(f => ({ ...f, operation: e.target.value || undefined }))}
                  className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                  <option value="">Все</option>
                  {SYNC_OPERATIONS.map(op => <option key={op.key} value={op.key}>{op.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-500">Направление:</span>
                <select value={logFilters.direction || ''} onChange={e => setLogFilters(f => ({ ...f, direction: e.target.value || undefined }))}
                  className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                  <option value="">Все</option>
                  <option value="export">Экспорт</option>
                  <option value="import">Импорт</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-500">Статус:</span>
                <select value={logFilters.status || ''} onChange={e => setLogFilters(f => ({ ...f, status: e.target.value || undefined }))}
                  className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                  <option value="">Все</option>
                  <option value="success">Успех</option>
                  <option value="error">Ошибка</option>
                </select>
              </div>
              {Object.keys(logFilters).length > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium">
                  <X size={12} /> Сбросить
                </button>
              )}
            </div>
          )}
        </div>

        {logsLoading ? (
          <div className="flex justify-center py-12"><Loader className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : logs.items?.length === 0 ? (
          <div className="py-12 text-center">
            <FileText size={36} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">Журнал синхронизации пуст</p>
            <p className="text-xs text-zinc-400 mt-1">Выполните синхронизацию, чтобы увидеть записи</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Дата</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Операция</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Направление</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Статус</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Запрос / Ответ</th>
                    <th className="text-left p-3 text-zinc-500 font-medium text-xs">Ошибка</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.items.map((log: any) => {
                    const opDef = SYNC_OPERATIONS.find(o => o.key === log.operation);
                    const OpIcon = opDef?.icon || RefreshCw;
                    return (
                      <tr key={log.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="p-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap text-xs">{new Date(log.created_at).toLocaleString('ru-RU')}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <OpIcon size={12} className="text-zinc-500 shrink-0" />
                            <span className="text-zinc-700 dark:text-zinc-300 text-xs">{opDef?.label || log.operation}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            log.direction === 'export' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          }`}>
                            <ArrowUpDown size={10} />
                            {log.direction === 'export' ? 'Экспорт' : 'Импорт'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                            log.status === 'success' ? 'text-green-600' : log.status === 'error' ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {log.status === 'success' ? <CheckCircle size={12} /> : log.status === 'error' ? <XCircle size={12} /> : <Clock size={12} />}
                            {log.status === 'success' ? 'Успех' : log.status === 'error' ? 'Ошибка' : 'В обработке'}
                          </span>
                        </td>
                        <td className="p-3 max-w-[200px]">
                          {log.response_body && log.response_body !== 'null' && log.response_body !== '""' ? (
                            <span className="text-xs text-zinc-500 truncate block" title={log.response_body}>
                              {log.response_body.length > 60 ? log.response_body.slice(0, 60) + '...' : log.response_body}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="p-3 max-w-[200px]">
                          {log.error_message ? (
                            <span className="text-xs text-red-500 truncate block" title={log.error_message}>
                              <AlertTriangle size={10} className="inline mr-1" />
                              {log.error_message.length > 60 ? log.error_message.slice(0, 60) + '...' : log.error_message}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {logs.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs text-zinc-400">Страница {logPage} из {logs.totalPages}</span>
                <div className="flex gap-1">
                  <button disabled={logPage <= 1} onClick={() => loadLogs(logPage - 1)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 transition">
                    Назад
                  </button>
                  <button disabled={logPage >= logs.totalPages} onClick={() => loadLogs(logPage + 1)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 transition">
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}