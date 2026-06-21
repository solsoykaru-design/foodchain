import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { CreditCard, CheckCircle, XCircle, Eye, EyeOff, RefreshCw, Wallet, AlertTriangle, Loader2, Copy, Link } from 'lucide-react';

const PROVIDER_META: Record<string, {
  name: string; icon: string; color: string;
  fields: { key: string; label: string; type: string; placeholder: string }[];
}> = {
  yookassa: {
    name: 'ЮKassa',
    icon: '🔵',
    color: '#1A5CFF',
    fields: [
      { key: 'shop_id', label: 'Shop ID', type: 'text', placeholder: 'Введите ID магазина' },
      { key: 'api_key', label: 'Секретный ключ', type: 'password', placeholder: 'Введите секретный ключ' },
    ],
  },
  cloudpayments: {
    name: 'CloudPayments',
    icon: '☁️',
    color: '#FF6600',
    fields: [
      { key: 'public_id', label: 'Public ID', type: 'text', placeholder: 'Введите Public ID' },
      { key: 'api_secret', label: 'API Secret', type: 'password', placeholder: 'Введите API Secret' },
    ],
  },
  tbank: {
    name: 'Т-Банк (Т-Касса)',
    icon: '💳',
    color: '#FFDD2D',
    fields: [
      { key: 'terminal_key', label: 'Terminal Key', type: 'text', placeholder: 'Введите Terminal Key (ID терминала)' },
      { key: 'api_key', label: 'Secret Key', type: 'password', placeholder: 'Введите Secret Key (пароль)' },
    ],
  },
  sberbank: {
    name: 'Сбербанк (SberPay)',
    icon: '🏦',
    color: '#1B9E4A',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Введите Client ID' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'Введите Client Secret' },
    ],
  },
};

const PAYMENT_METHOD_ICONS: Record<string, string> = {
  cash: '💵',
  card: '💳',
  online: '🌐',
  in_venue: '🏪',
};

type ConnStatus = 'empty' | 'untested' | 'testing' | 'success' | 'error' | 'saved';

export default function PaymentSettingsPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [showCredentials, setShowCredentials] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<Record<string, ConnStatus>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([
        api.getPaymentSettings(),
        api.getPaymentMethods().catch(() => []),
      ]);
      setProviders(p);
      setMethods(m);
      const status: Record<string, ConnStatus> = {};
      for (const prov of p) {
        const meta = PROVIDER_META[prov.provider];
        if (!meta) continue;
        const hasAllFields = prov.provider === 'sberbank'
          ? prov.sber_client_id?.trim() && prov.sber_client_secret?.trim()
          : meta.fields.every((f: any) => prov.credentials[f.key]?.trim());
        status[prov.provider] = hasAllFields ? 'saved' : 'empty';
      }
      setConnStatus(status);
    } catch (e: any) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setCred = (provider: string, key: string, value: string) => {
    setProviders(prev => prev.map(p =>
      p.provider === provider
        ? { ...p, credentials: { ...p.credentials, [key]: value } }
        : p
    ));
    setConnStatus(prev => {
      const cur = prev[provider];
      return cur === 'saved' || cur === 'success' || cur === 'error'
        ? { ...prev, [provider]: 'untested' }
        : prev;
    });
  };

  const setField = (provider: string, key: string, value: any) => {
    setProviders(prev => prev.map(p =>
      p.provider === provider ? { ...p, [key]: value } : p
    ));
    setConnStatus(prev => {
      const cur = prev[provider];
      return cur === 'saved' || cur === 'success' || cur === 'error'
        ? { ...prev, [provider]: 'untested' }
        : prev;
    });
  };

  const hasAllFields = (prov: any) => {
    const meta = PROVIDER_META[prov.provider];
    return meta ? meta.fields.every((f: any) => prov.credentials[f.key]?.trim()) : false;
  };

  const hasSberFields = (prov: any) => {
    return prov?.sber_client_id?.trim() && prov?.sber_client_secret?.trim();
  };

  const handleTest = async (provider: string) => {
    const prov = providers.find(p => p.provider === provider);
    if (!prov) return;
    if (provider === 'sberbank') {
      if (!hasSberFields(prov)) { addToast('Заполните Client ID и Client Secret', 'warning'); return; }
    } else if (!hasAllFields(prov)) return;

    setConnStatus(prev => ({ ...prev, [provider]: 'testing' }));
    try {
      const result = await api.testPaymentConnection(provider);
      setConnStatus(prev => ({
        ...prev,
        [provider]: result.ok ? 'success' : 'error',
      }));
      if (!result.ok) {
        addToast(`Ошибка: ${result.data?.error_description || result.data?.Message || result.data?.message || JSON.stringify(result.data)}`, 'error');
      }
    } catch (e: any) {
      setConnStatus(prev => ({ ...prev, [provider]: 'error' }));
      addToast(e.message, 'error');
    }
  };

  const saveAndEnable = async (provider: string) => {
    const prov = providers.find(p => p.provider === provider);
    if (!prov) return;
    if (connStatus[provider] !== 'success') { addToast('Сначала проверьте подключение', 'warning'); return; }
    setSaving(provider);
    try {
      const body: any = { enabled: true, test_mode: 0 };
      body.notification_url = prov.notification_url || `${window.location.origin}/api/webhooks/payment`;
      if (provider === 'sberbank') {
        body.sber_enabled = 1;
        body.sber_client_id = prov.sber_client_id || '';
        body.sber_client_secret = prov.sber_client_secret || '';
        body.credentials = prov.credentials || {};
      } else {
        body.credentials = prov.credentials;
      }
      if (provider === 'tbank') {
        body.sbp_enabled = prov.sbp_enabled ? 1 : 0;
      }
      await api.updatePaymentSettings(provider, body);
      setProviders(prev => prev.map(p =>
        p.provider === provider ? { ...p, enabled: true } : p
      ));
      setConnStatus(prev => ({ ...prev, [provider]: 'saved' }));
    } catch (e: any) { addToast(e.message, 'error'); }
    setSaving(null);
  };

  const toggleEnabled = (provider: string, current: boolean) => {
    const prov = providers.find(p => p.provider === provider);
    if (!prov) return;
    if (connStatus[provider] !== 'saved') { addToast('Сначала проверьте подключение и сохраните', 'warning'); return; }
    const newEnabled = !current;
    setProviders(prev => prev.map(p =>
      p.provider === provider ? { ...p, enabled: newEnabled } : p
    ));
    api.updatePaymentSettings(provider, { enabled: newEnabled }).catch((e: any) => addToast(e.message, 'error'));
  };

  const toggleSbp = (provider: string, current: boolean) => {
    const newVal = !current;
    setField(provider, 'sbp_enabled', newVal);
    const prov = providers.find(p => p.provider === provider);
    if (prov) {
      api.updatePaymentSettings(provider, { sbp_enabled: newVal ? 1 : 0 }).catch((e: any) => addToast(e.message, 'error'));
    }
  };

  const toggleSber = (provider: string, current: boolean) => {
    const newVal = !current;
    setField(provider, 'sber_enabled', newVal);
    const prov = providers.find(p => p.provider === provider);
    if (prov) {
      api.updatePaymentSettings(provider, { sber_enabled: newVal ? 1 : 0 }).catch((e: any) => addToast(e.message, 'error'));
    }
  };

  const toggleMethod = async (id: number, current: boolean) => {
    try {
      const updated = await api.updatePaymentMethod(id, { is_active: !current });
      setMethods(prev => prev.map(m => m.id === id ? updated : m));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  if (loading) return <div className="p-6 text-zinc-500">Загрузка...</div>;

  const statusBadge = (prov: any) => {
    const s = connStatus[prov.provider] || 'empty';
    if (prov.enabled && s === 'saved') {
      return <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle size={12} /> Активно</span>;
    }
    switch (s) {
      case 'saved':
        return <span className="flex items-center gap-1 text-xs text-zinc-500 font-medium"><XCircle size={12} /> Выключено</span>;
      case 'success':
        return <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle size={12} /> Подключение успешно</span>;
      case 'testing':
        return <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><Loader2 size={12} className="animate-spin" /> Проверка...</span>;
      case 'error':
        return <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={12} /> Ошибка</span>;
      case 'untested':
        return <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><AlertTriangle size={12} /> Не проверено</span>;
      default:
        return <span className="flex items-center gap-1 text-xs text-zinc-400 font-medium"><XCircle size={12} /> Не настроено</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard size={28} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Платёжные системы</h1>
        </div>
        <button onClick={load} className="p-2 text-zinc-400 hover:text-blue-500 transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map(prov => {
          const meta = PROVIDER_META[prov.provider];
          if (!meta) return null;
          const s = connStatus[prov.provider] || 'empty';
          const canSave = s === 'success';

          return (
            <div key={prov.provider} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white">{meta.name}</h3>
                      <div className="mt-0.5">{statusBadge(prov)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleEnabled(prov.provider, prov.enabled)}
                    disabled={s !== 'saved'}
                    className={`w-11 h-6 rounded-full transition-colors relative ${prov.enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'} ${s !== 'saved' ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title={s !== 'saved' ? 'Сначала проверьте подключение и сохраните' : ''}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow ${prov.enabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                {prov.provider === 'sberbank' ? (
                  <div className="space-y-3">
                    {meta.fields.map(field => (
                      <div key={field.key}>
                        <label className="text-xs font-medium text-zinc-500 mb-1 block">{field.label}</label>
                        <div className="relative">
                          <input
                            type={showCredentials[field.key] ? 'text' : field.type}
                            value={field.key === 'client_id' ? (prov.sber_client_id || '') : (prov.sber_client_secret || '')}
                            onChange={e => setField(prov.provider, field.key === 'client_id' ? 'sber_client_id' : 'sber_client_secret', e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 pr-9"
                          />
                          {field.type === 'password' && (
                            <button
                              onClick={() => setShowCredentials(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            >
                              {showCredentials[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {meta.fields.map(field => (
                      <div key={field.key}>
                        <label className="text-xs font-medium text-zinc-500 mb-1 block">{field.label}</label>
                        <div className="relative">
                          <input
                            type={showCredentials[field.key] ? 'text' : field.type}
                            value={prov.credentials[field.key] || ''}
                            onChange={e => setCred(prov.provider, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 pr-9"
                          />
                          {field.type === 'password' && (
                            <button
                              onClick={() => setShowCredentials(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            >
                              {showCredentials[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1">
                      <Link size={12} /> URL для уведомлений (Notification URL)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={prov.notification_url || `${window.location.origin}/api/webhooks/payment`}
                        onChange={e => setField(prov.provider, 'notification_url', e.target.value)}
                        placeholder={`${window.location.origin}/api/webhooks/payment`}
                        className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(prov.notification_url || `${window.location.origin}/api/webhooks/payment`).then(() => addToast('URL скопирован!', 'success'))}
                        className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                        title="Копировать URL"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">Укажите этот URL в личном кабинете Т-Банка в разделе «Уведомления»</p>
                  </div>
                </div>

                {prov.provider === 'tbank' && (
                  <div className="mt-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">СБП через QR-код</span>
                      <button
                        onClick={() => toggleSbp(prov.provider, !!prov.sbp_enabled)}
                        disabled={s !== 'saved'}
                        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${prov.sbp_enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'} ${s !== 'saved' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all shadow ${prov.sbp_enabled ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    {s !== 'saved' && <p className="text-[10px] text-zinc-400 mt-1">Сначала сохраните ключи Т-Банка</p>}
                  </div>
                )}
              </div>

              <div className="px-5 pb-5 flex gap-2">
                <button
                  onClick={() => saveAndEnable(prov.provider)}
                  disabled={!canSave || saving === prov.provider}
                  className={`flex-1 text-sm font-bold py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${
                    canSave
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                  }`}
                  title={!canSave ? 'Сначала проверьте подключение' : ''}
                >
                  {saving === prov.provider ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Сохранение...</span>
                  ) : (
                    <>💾 Сохранить и включить</>
                  )}
                </button>
                <button
                  onClick={() => handleTest(prov.provider)}
                  disabled={s === 'testing'}
                  className={`flex-1 text-sm font-medium py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${
                    s === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                      : s === 'error'
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700'
                      : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {s === 'testing' ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Проверка...</span>
                  ) : s === 'success' ? (
                    '✓ Проверено'
                  ) : s === 'error' ? (
                    '✗ Повторить'
                  ) : (
                    'Проверить'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <Wallet size={22} className="text-blue-500" />
          <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Способы оплаты для гостей</h3>
        </div>
        <p className="text-sm text-zinc-500 mb-4">Включите или отключите доступные способы оплаты на витрине</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {methods.map(m => (
            <div key={m.id} className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{PAYMENT_METHOD_ICONS[m.key] || '💳'}</span>
                <div>
                  <p className="font-medium text-sm text-zinc-700 dark:text-zinc-300">{m.name}</p>
                  <p className="text-[10px] text-zinc-400">{m.description}</p>
                </div>
              </div>
              <button
                onClick={() => toggleMethod(m.id, m.isActive)}
                className={`w-10 h-6 rounded-full transition-colors relative ${m.isActive ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow ${m.isActive ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
          ))}
          {methods.length === 0 && (
            <p className="col-span-full text-center py-8 text-zinc-400 text-sm">Способы оплаты не найдены</p>
          )}
        </div>
      </div>
    </div>
  );
}
