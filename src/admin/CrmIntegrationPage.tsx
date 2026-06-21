import { useState, useEffect } from 'react';
import { GitCompare, Save, RefreshCw, Upload, ExternalLink } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

const PROVIDERS = [
  { id: 'amocrm', label: 'amoCRM', docs: 'https://www.amocrm.ru/developers' },
  { id: 'bitrix24', label: 'Bitrix24', docs: 'https://dev.1c-bitrix.ru/rest_help/' },
];

export default function CrmIntegrationPage() {
  const [provider, setProvider] = useState('amocrm');
  const [settings, setSettings] = useState<any>({ enabled: false });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const providerInfo = PROVIDERS.find(p => p.id === provider);

  useEffect(() => {
    setLoading(true);
    api.request(`/api/admin/crm/settings/${provider}`).then(setSettings).catch(() => {}).finally(() => setLoading(false));
  }, [provider]);

  const save = async () => {
    try {
      await api.request(`/api/admin/crm/settings/${provider}`, { method: 'PUT', body: JSON.stringify(settings) });
      addToast('Настройки сохранены', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await api.request(`/api/admin/crm/test/${provider}`, { method: 'POST' });
      addToast(res.success ? 'Подключение работает' : res.error || 'Ошибка', res.success ? 'success' : 'error');
    } catch (e: any) { addToast(e.message, 'error'); }
    setTesting(false);
  };

  const exportClients = async () => {
    setExporting(true);
    try {
      const res = await api.request(`/api/admin/crm/export/${provider}`, { method: 'POST' });
      addToast(`Экспортировано: ${res.exported} контактов`, 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
    setExporting(false);
  };

  if (loading) {
    return <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm"><div className="text-center py-12 text-zinc-400">Загрузка...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
          <GitCompare size={22} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">CRM интеграции</h1>
          <p className="text-sm text-zinc-500">amoCRM и Bitrix24 — синхронизация клиентов</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-2xl p-2 shadow-sm w-fit">
        {PROVIDERS.map(p => (
          <button key={p.id} onClick={() => setProvider(p.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${provider === p.id ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm space-y-5">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} className="rounded" />
          <span className="text-sm font-medium">Включить интеграцию с {providerInfo?.label}</span>
        </label>

        {provider === 'amocrm' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500">Домен (поддомен)</label>
              <input type="text" value={settings.domain || ''} onChange={e => setSettings({ ...settings, domain: e.target.value })}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" placeholder="yourdomain" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Client ID</label>
              <input type="text" value={settings.client_id || ''} onChange={e => setSettings({ ...settings, client_id: e.target.value })}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Client Secret</label>
              <input type="password" value={settings.client_secret || ''} onChange={e => setSettings({ ...settings, client_secret: e.target.value })}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Redirect URI</label>
              <input type="text" value={settings.redirect_uri || ''} onChange={e => setSettings({ ...settings, redirect_uri: e.target.value })}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Код авторизации</label>
              <input type="text" value={settings.code || ''} onChange={e => setSettings({ ...settings, code: e.target.value })}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" />
            </div>
          </div>
        )}

        {provider === 'bitrix24' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500">Домен (поддомен)</label>
              <input type="text" value={settings.domain || ''} onChange={e => setSettings({ ...settings, domain: e.target.value })}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" placeholder="yourdomain" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Webhook URL (код после /rest/)</label>
              <input type="text" value={settings.webhook || ''} onChange={e => setSettings({ ...settings, webhook: e.target.value })}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-transparent text-sm mt-1" placeholder="xxxxx/xxxxxxxxxxxxx/" />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">
            <Save size={16} /> Сохранить
          </button>
          <button onClick={test} disabled={testing} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-5 py-2.5 rounded-xl text-sm font-medium transition">
            {testing ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Проверить подключение
          </button>
          {settings.enabled && (
            <button onClick={exportClients} disabled={exporting} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:bg-zinc-400">
              {exporting ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
              Экспортировать клиентов
            </button>
          )}
          {providerInfo?.docs && (
            <a href={providerInfo.docs} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline ml-auto">
              Документация <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
