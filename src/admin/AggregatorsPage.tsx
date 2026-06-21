import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Globe, RefreshCw, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, ChevronDown, ChevronUp, Clock, ArrowUpDown, FileText, Loader } from 'lucide-react';

type VerificationStatus = 'unchecked' | 'checking' | 'success' | 'error' | 'active';

interface AggregatorState {
  provider: string;
  name: string;
  logo: string;
  enabled: boolean;
  credentials: Record<string, string>;
  lastChecked: string | null;
  lastSyncAt: string | null;
  lastMenuSyncAt: string | null;
  verificationStatus: VerificationStatus;
  verifiedCredentials: Record<string, string> | null;
}

const PROVIDER_META: Record<string, { name: string; icon: string; color: string; fields: { key: string; label: string; type: string; placeholder: string }[] }> = {
  yandex: {
    name: 'Яндекс Еда',
    icon: '🔴',
    color: '#E53935',
    fields: [
      { key: 'api_key', label: 'API-ключ', type: 'password', placeholder: 'Введите API-ключ' },
      { key: 'api_secret', label: 'Секретный ключ', type: 'password', placeholder: 'Введите секретный ключ' },
      { key: 'place_id', label: 'ID ресторана', type: 'text', placeholder: 'Например: 12345' },
      { key: 'campaign_id', label: 'ID кампании', type: 'text', placeholder: 'Например: 67890' },
    ],
  },
  delivery_club: {
    name: 'Delivery Club',
    icon: '🟢',
    color: '#43A047',
    fields: [
      { key: 'api_key', label: 'API-ключ', type: 'password', placeholder: 'Введите API-ключ' },
      { key: 'api_secret', label: 'Секретный ключ', type: 'password', placeholder: 'Введите секретный ключ' },
      { key: 'restaurant_id', label: 'ID ресторана', type: 'text', placeholder: 'Например: 54321' },
    ],
  },
  sbermarket: {
    name: 'СберМаркет',
    icon: '🟡',
    color: '#FB8C00',
    fields: [
      { key: 'api_key', label: 'API-ключ', type: 'password', placeholder: 'Введите API-ключ' },
      { key: 'client_id', label: 'ID клиента', type: 'text', placeholder: 'Введите ID клиента' },
      { key: 'store_id', label: 'ID магазина', type: 'text', placeholder: 'Например: 333' },
    ],
  },
};

const STATUS_CONFIG: Record<VerificationStatus, { dot: string; label: string; dotClass: string }> = {
  unchecked: { dot: '●', label: 'Не проверено', dotClass: 'text-zinc-300 dark:text-zinc-600' },
  checking: { dot: '◐', label: 'Проверка...', dotClass: 'text-yellow-400 animate-spin inline-block' },
  success: { dot: '●', label: 'Подключение успешно', dotClass: 'text-green-500' },
  error: { dot: '●', label: 'Ошибка подключения', dotClass: 'text-red-500' },
  active: { dot: '✓', label: 'Интеграция активна', dotClass: 'text-green-500 font-bold' },
};

const OPERATION_LABELS: Record<string, string> = {
  menu_sync: 'Синхронизация меню',
  status_update: 'Обновление статуса',
  order_receive: 'Получение заказа',
  status_receive: 'Получение статуса',
  webhook_received: 'Вебхук получен',
  test_connection: 'Тест соединения',
};

export default function AggregatorsPage() {
  const [aggregators, setAggregators] = useState<AggregatorState[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState<Record<string, boolean>>({});
  const [logsPanel, setLogsPanel] = useState<string | null>(null);
  const [logs, setLogs] = useState<any>({ items: [], total: 0, page: 1, totalPages: 0 });
  const [logsLoading, setLogsLoading] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const getStatus = (agg: AggregatorState): VerificationStatus => {
    if (agg.enabled) return 'active';
    return agg.verificationStatus;
  };

  const hasCredentialsChanged = (agg: AggregatorState): boolean => {
    if (!agg.verifiedCredentials) return Object.values(agg.credentials).some(v => v.length > 0);
    return Object.keys(agg.credentials).some(k => agg.credentials[k] !== (agg.verifiedCredentials![k] || ''));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAggregators();
      setAggregators(data.map((a: any) => ({
        provider: a.provider,
        name: a.name,
        logo: a.logo,
        enabled: a.enabled,
        credentials: a.credentials || {},
        lastChecked: a.lastChecked || null,
        lastSyncAt: a.lastSyncAt || null,
        lastMenuSyncAt: a.lastMenuSyncAt || null,
        verificationStatus: a.enabled ? ('active' as VerificationStatus) : (a.lastChecked ? ('success' as VerificationStatus) : ('unchecked' as VerificationStatus)),
        verifiedCredentials: a.enabled ? { ...(a.credentials || {}) } : null,
      })));
    } catch (e: any) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setCred = (provider: string, key: string, value: string) => {
    setAggregators(prev => prev.map(a => {
      if (a.provider !== provider) return a;
      const newCreds = { ...a.credentials, [key]: value };
      const changed = Object.keys(a.verifiedCredentials || {}).some(k => newCreds[k] !== (a.verifiedCredentials![k] || ''))
        || Object.keys(newCreds).some(k => (a.verifiedCredentials || {})[k] === undefined && newCreds[k] !== '');
      return {
        ...a,
        credentials: newCreds,
        verificationStatus: changed ? 'unchecked' as VerificationStatus : a.verificationStatus,
      };
    }));
  };

  const handleCheck = async (provider: string) => {
    const agg = aggregators.find(a => a.provider === provider);
    if (!agg) return;

    setChecking(provider);
    setCheckError(null);
    setAggregators(prev => prev.map(a =>
      a.provider === provider ? { ...a, verificationStatus: 'checking' as VerificationStatus } : a
    ));

    try {
      const result = await api.testAggregatorConnection(provider, agg.credentials);
      if (result.ok) {
        setAggregators(prev => prev.map(a =>
          a.provider === provider ? {
            ...a,
            verificationStatus: 'success' as VerificationStatus,
            verifiedCredentials: { ...a.credentials },
            lastChecked: new Date().toISOString(),
          } : a
        ));
      } else {
        const msg = result.data?.message || result.data || 'Ошибка подключения. Проверьте ключи и попробуйте снова.';
        setCheckError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        setAggregators(prev => prev.map(a =>
          a.provider === provider ? { ...a, verificationStatus: 'error' as VerificationStatus } : a
        ));
      }
    } catch (e: any) {
      if (e.message?.includes('fetch') || e.message?.includes('NetworkError') || e.message?.includes('timeout')) {
        setCheckError('Сервис временно недоступен. Попробуйте позже.');
      } else {
        setCheckError(e.message || 'Ошибка подключения. Проверьте ключи и попробуйте снова.');
      }
      setAggregators(prev => prev.map(a =>
        a.provider === provider ? { ...a, verificationStatus: 'error' as VerificationStatus } : a
      ));
    }
    setChecking(null);
  };

  const handleEnable = async (provider: string) => {
    const agg = aggregators.find(a => a.provider === provider);
    if (!agg || agg.enabled) return;

    if (agg.verificationStatus !== 'success') {
      setCheckError('Сначала выполните проверку подключения');
      return;
    }

    try {
      await api.updateAggregator(provider, { enabled: true, credentials: agg.credentials });
      setAggregators(prev => prev.map(a =>
        a.provider === provider ? { ...a, enabled: true, verificationStatus: 'active' as VerificationStatus } : a
      ));
      setCheckError(null);
    } catch (e: any) {
      setCheckError(e.message || 'Ошибка при включении интеграции');
    }
  };

  const handleDisable = async (provider: string) => {
    try {
      await api.updateAggregator(provider, { enabled: false });
      setAggregators(prev => prev.map(a =>
        a.provider === provider ? { ...a, enabled: false, verificationStatus: a.verificationStatus === 'active' ? 'success' as VerificationStatus : a.verificationStatus } : a
      ));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleSave = async (provider: string) => {
    const agg = aggregators.find(a => a.provider === provider);
    if (!agg) return;

    if (agg.verificationStatus !== 'success') {
      setCheckError('Сначала выполните проверку подключения');
      return;
    }

    try {
      await api.updateAggregator(provider, { enabled: false, credentials: agg.credentials });
      setCheckError(null);
    } catch (e: any) {
      setCheckError(e.message || 'Ошибка при сохранении');
    }
  };

  const handleSyncMenu = async (provider: string) => {
    if (!confirm('Выгрузить текущее меню в агрегатор?')) return;
    setSyncing(provider);
    try {
      const result = await api.syncAggregatorMenu(provider);
      if (result.ok) {
        load();
      } else {
        addToast(`Ошибка: ${result.data?.message || JSON.stringify(result.data)}`, 'error');
      }
    } catch (e: any) { addToast(e.message, 'error'); }
    setSyncing(null);
  };

  const handleSyncStatuses = async (provider: string) => {
    setSyncing(provider);
    try {
      const result = await api.syncAggregatorStatuses(provider);
      addToast(`Синхронизировано статусов: ${result.synced}`, 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
    setSyncing(null);
  };

  const loadLogs = async (provider: string, page = 1) => {
    setLogsLoading(true);
    try {
      const data = await api.getAggregatorLogs(provider, { page, limit: 20 });
      setLogs(data);
    } catch (e: any) { console.error(e); }
    setLogsLoading(false);
  };

  const toggleLogs = (provider: string) => {
    if (logsPanel === provider) { setLogsPanel(null); return; }
    setLogsPanel(provider);
    loadLogs(provider);
  };

  if (loading) return <div className="p-6 text-zinc-500">Загрузка...</div>;

  const selectedAgg = aggregators.find(a => a.provider === selected);
  const meta = selected ? PROVIDER_META[selected] : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Интеграция с агрегаторами</h1>
          <p className="text-sm text-zinc-500 mt-1">Подключение Яндекс Еды, Delivery Club и СберМаркета</p>
        </div>
        <button onClick={load} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {aggregators.map(agg => {
          const m = PROVIDER_META[agg.provider];
          if (!m) return null;
          const status = getStatus(agg);
          const sc = STATUS_CONFIG[status];
          return (
            <div
              key={agg.provider}
              onClick={() => { setSelected(agg.provider); setCheckError(null); }}
              className={`bg-white dark:bg-zinc-900 rounded-2xl p-5 border-2 shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${
                selected === agg.provider ? 'border-blue-500 dark:border-blue-400' : 'border-zinc-100 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{m.icon}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${sc.dotClass}`}>
                    {sc.dot}
                  </span>
                  {status !== 'active' ? (
                    <div className={`w-11 h-6 rounded-full bg-zinc-300 dark:bg-zinc-600 opacity-50 cursor-not-allowed`}>
                      <div className="w-4 h-4 bg-white rounded-full absolute top-1 left-1 shadow" />
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDisable(agg.provider); }}
                      className="w-11 h-6 bg-green-500 rounded-full relative transition-colors"
                    >
                      <div className="w-4 h-4 bg-white rounded-full absolute top-1 left-6 shadow transition-all" />
                    </button>
                  )}
                </div>
              </div>
              <h3 className="font-bold text-zinc-900 dark:text-white text-lg">{m.name}</h3>
              <p className={`text-xs mt-1.5 ${sc.dotClass}`}>{sc.label}</p>
              <div className="mt-2 space-y-1 text-xs text-zinc-500">
                {agg.lastChecked && (
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>Проверено: {new Date(agg.lastChecked).toLocaleString('ru-RU')}</span>
                  </div>
                )}
                {agg.lastSyncAt && (
                  <div className="flex items-center gap-1">
                    <ArrowUpDown size={12} />
                    <span>Синхр.: {new Date(agg.lastSyncAt).toLocaleString('ru-RU')}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected && meta && selectedAgg && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>{meta.icon}</span> {meta.name}
            </h2>
            <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-600 text-sm">Закрыть</button>
          </div>

          {/* Status indicator */}
          <div className="mb-4 flex items-center gap-3 text-sm">
            <span className="text-zinc-500">Статус:</span>
            {(() => {
              const status = getStatus(selectedAgg);
              const sc = STATUS_CONFIG[status];
              return (
                <span className={`flex items-center gap-1.5 font-medium ${sc.dotClass}`}>
                  {status === 'checking' ? <Loader size={14} className="animate-spin" /> : <span>{sc.dot}</span>}
                  {sc.label}
                </span>
              );
            })()}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {meta.fields.map(field => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-zinc-500 mb-1 block">{field.label}</label>
                  <div className="relative">
                    <input
                      type={showCredentials[field.key] ? 'text' : field.type}
                      value={selectedAgg.credentials[field.key] || ''}
                      onChange={e => setCred(selected, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pr-10"
                    />
                    {field.type === 'password' && (
                      <button
                        onClick={() => setShowCredentials(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        {showCredentials[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Error message */}
            {checkError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {checkError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Check button */}
              <button
                onClick={() => handleCheck(selected)}
                disabled={checking === selected}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] flex items-center gap-2"
              >
                {checking === selected ? (
                  <><Loader size={14} className="animate-spin" /> Проверка...</>
                ) : (
                  'Проверить подключение'
                )}
              </button>

              {/* Save button - only active after successful check */}
              <button
                onClick={() => handleSave(selected)}
                disabled={selectedAgg.verificationStatus !== 'success'}
                className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Сохранить ключи
              </button>

              {/* Enable toggle - only after successful check */}
              {!selectedAgg.enabled ? (
                <button
                  onClick={() => handleEnable(selected)}
                  disabled={selectedAgg.verificationStatus !== 'success'}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] flex items-center gap-2"
                >
                  {selectedAgg.verificationStatus === 'success' ? '✅ Включить интеграцию' : '🔒 Включить интеграцию'}
                </button>
              ) : (
                <button
                  onClick={() => handleDisable(selected)}
                  className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
                >
                  Отключить интеграцию
                </button>
              )}

              {/* Sync buttons - only when enabled */}
              {selectedAgg.enabled && (
                <>
                  <button
                    onClick={() => handleSyncMenu(selected)}
                    disabled={syncing === selected}
                    className="bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-600 active:scale-[0.97] transition-all disabled:opacity-50"
                  >
                    {syncing === selected ? 'Выгрузка...' : 'Выгрузить меню'}
                  </button>
                  <button
                    onClick={() => handleSyncStatuses(selected)}
                    disabled={syncing === selected}
                    className="bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-600 active:scale-[0.97] transition-all disabled:opacity-50"
                  >
                    Принудительно синхр. статусы
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logs section */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-900 dark:text-white">Лог операций</h3>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {aggregators.map(agg => {
            const m = PROVIDER_META[agg.provider];
            if (!m) return null;
            const isOpen = logsPanel === agg.provider;
            return (
              <div key={agg.provider}>
                <button
                  onClick={() => toggleLogs(agg.provider)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span>{m.icon}</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{m.name}</span>
                  </div>
                  {isOpen ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    {logsLoading ? (
                      <div className="text-sm text-zinc-400 py-4 text-center">Загрузка...</div>
                    ) : logs.items?.length === 0 ? (
                      <div className="text-sm text-zinc-400 py-4 text-center">Логов пока нет</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                                <th className="text-left py-2 pr-2">Время</th>
                                <th className="text-left py-2 pr-2">Операция</th>
                                <th className="text-left py-2 pr-2">Статус</th>
                                <th className="text-left py-2 pr-2">Ответ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {logs.items?.map((log: any) => (
                                <tr key={log.id} className="border-b border-zinc-50 dark:border-zinc-800/50">
                                  <td className="py-2 pr-2 text-zinc-500 whitespace-nowrap">
                                    {new Date(log.created_at).toLocaleString('ru-RU')}
                                  </td>
                                  <td className="py-2 pr-2 text-zinc-700 dark:text-zinc-300">
                                    {OPERATION_LABELS[log.operation] || log.operation}
                                  </td>
                                  <td className="py-2 pr-2">
                                    {log.status === 'success' ? (
                                      <span className="text-green-600 flex items-center gap-1"><CheckCircle size={10} /> Успех</span>
                                    ) : (
                                      <span className="text-red-600 flex items-center gap-1"><AlertTriangle size={10} /> Ошибка</span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-2 text-zinc-500 max-w-[200px] truncate">
                                    {log.error_message || (log.response ? (typeof log.response === 'string' ? log.response.slice(0, 80) : JSON.stringify(log.response).slice(0, 80)) : '—')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {logs.totalPages > 1 && (
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <button
                              onClick={() => loadLogs(agg.provider, (logs.page || 1) - 1)}
                              disabled={logs.page <= 1}
                              className="px-3 py-1 text-xs rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30"
                            >
                              Назад
                            </button>
                            <span className="text-xs text-zinc-500">{logs.page} / {logs.totalPages}</span>
                            <button
                              onClick={() => loadLogs(agg.provider, (logs.page || 1) + 1)}
                              disabled={logs.page >= logs.totalPages}
                              className="px-3 py-1 text-xs rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30"
                            >
                              Вперёд
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
