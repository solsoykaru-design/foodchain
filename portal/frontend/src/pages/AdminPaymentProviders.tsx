import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Check, X, AlertCircle, Eye, EyeOff, Save } from 'lucide-react';

export function AdminPaymentProviders() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.adminGetPaymentProviders()
      .then(setProviders)
      .catch(() => setMessage('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (code: string, isActive: boolean) => {
    setSaving(prev => ({ ...prev, [code]: true }));
    try {
      const updated = await api.adminUpdatePaymentProvider(code, { is_active: isActive });
      setProviders(prev => prev.map(p => p.code === code ? updated : p));
      setMessage(`Провайдер ${isActive ? 'активирован' : 'деактивирован'}`);
    } catch (err: any) { setMessage(err.message || 'Ошибка'); }
    setSaving(prev => ({ ...prev, [code]: false }));
  };

  const handleSaveConfig = async (code: string, config: any) => {
    setSaving(prev => ({ ...prev, [code]: true }));
    try {
      const updated = await api.adminUpdatePaymentProvider(code, { config });
      setProviders(prev => prev.map(p => p.code === code ? updated : p));
      setMessage('Настройки сохранены');
    } catch (err: any) { setMessage(err.message || 'Ошибка'); }
    setSaving(prev => ({ ...prev, [code]: false }));
  };

  const PROVIDER_LABELS: Record<string, string> = {
    payme: 'Payme Uzbekistan',
    yookassa: 'ЮKassa',
    cloudpayments: 'CloudPayments',
    tbank: 'Т-Банк (Т-Касса)',
  };

  const PROVIDER_DESCRIPTIONS: Record<string, string> = {
    payme: 'Платёжная система для Узбекистана',
    yookassa: 'Приём платежей в России: карты, СБП, T-Pay, SberPay, Mir Pay',
    cloudpayments: 'Подписки с автосписанием для России',
    tbank: 'Приём платежей через Т-Банк: карты, T-Pay, SberPay, Mir Pay, СБП',
  };

  const getConfigFields = (code: string) => {
    if (code === 'yookassa') return [
      { key: 'shopId', label: 'Shop ID', type: 'text' },
      { key: 'secretKey', label: 'Секретный ключ', type: 'password' },
    ];
    if (code === 'cloudpayments') return [
      { key: 'publicId', label: 'Public ID', type: 'text' },
      { key: 'apiSecret', label: 'API Secret', type: 'password' },
    ];
    if (code === 'tbank') return [
      { key: 'terminalKey', label: 'Terminal Key', type: 'text' },
      { key: 'password', label: 'Пароль', type: 'password' },
      { key: 'secretKey', label: 'Secret Key', type: 'password' },
    ];
    return [];
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-zinc-400">Загрузка...</div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Платёжные провайдеры</h1>
      <p className="text-sm text-zinc-500 mb-6">Настройка платёжных систем для приёма платежей от арендаторов</p>

      {message && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-blue-50 text-blue-700 flex items-center gap-2">
          <AlertCircle size={16} /> {message}
          <button onClick={() => setMessage('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <div className="space-y-4">
        {providers.map(p => {
          const config = p.config || {};
          const fields = getConfigFields(p.code);
          return (
            <div key={p.code} className={`bg-white border-2 rounded-2xl p-5 ${p.is_active ? 'border-green-200' : 'border-zinc-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-zinc-900">{PROVIDER_LABELS[p.code] || p.name}</h3>
                  <p className="text-xs text-zinc-400">{PROVIDER_DESCRIPTIONS[p.code]}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={!!p.is_active} onChange={e => handleToggle(p.code, e.target.checked)}
                    disabled={saving[p.code]} className="sr-only peer" />
                  <div className="w-10 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>

              {p.is_active && fields.length > 0 && (
                <ProviderConfigForm
                  code={p.code}
                  config={config}
                  fields={fields}
                  showKeys={showKeys}
                  onToggleShow={(k) => setShowKeys(prev => ({ ...prev, [k]: !prev[k] }))}
                  onSave={(cfg) => handleSaveConfig(p.code, cfg)}
                  saving={!!saving[p.code]}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProviderConfigForm({ code, config, fields, showKeys, onToggleShow, onSave, saving }: {
  code: string; config: any; fields: { key: string; label: string; type: string }[];
  showKeys: Record<string, boolean>; onToggleShow: (k: string) => void;
  onSave: (cfg: any) => void; saving: boolean;
}) {
  const [localConfig, setLocalConfig] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = config[f.key] || '';
    return init;
  });

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = config[f.key] || '';
    setLocalConfig(init);
  }, [config]);

  return (
    <div className="border-t border-zinc-100 pt-3 mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">{f.label}</label>
            <div className="relative">
              <input type={f.type === 'password' && !showKeys[f.key] ? 'password' : 'text'}
                value={localConfig[f.key] || ''}
                onChange={e => setLocalConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm pr-8" />
              {f.type === 'password' && (
                <button onClick={() => onToggleShow(f.key)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400">
                  {showKeys[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onSave(localConfig)} disabled={saving}
        className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-1">
        <Save size={14} /> {saving ? 'Сохранение...' : 'Сохранить ключи'}
      </button>
    </div>
  );
}
