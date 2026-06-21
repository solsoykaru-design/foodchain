import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, Settings, PhoneCall, HelpCircle, CheckCircle, XCircle, Play, Save } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

const PROVIDERS = [
  { value: 'telphin', label: 'Telphin' },
  { value: 'mango', label: 'Mango Office' },
  { value: 'zadarma', label: 'Zadarma' },
];

const HELP = {
  telphin: {
    title: 'Telphin',
    steps: [
      'Войдите в личный кабинет Telphin',
      'Перейдите в раздел "Настройки API"',
      'Создайте API-ключ и скопируйте его',
      'Укажите Widget URL из раздела "Виджеты"',
      'Вставьте данные в поля ниже и нажмите "Сохранить"',
      'URL API: https://api.telphin.ru или ваш корпоративный URL',
    ],
  },
  mango: {
    title: 'Mango Office',
    steps: [
      'Войдите в личный кабинет Mango Office',
      'Перейдите в раздел "Интеграции" → "API"',
      'Скопируйте ключ API и секретный ключ',
      'Укажите URL вашего сервера для webhook-уведомлений',
      'Вставьте данные в поля ниже и нажмите "Сохранить"',
      'URL API: https://app.mango-office.ru/api',
    ],
  },
  zadarma: {
    title: 'Zadarma',
    steps: [
      'Войдите в личный кабинет Zadarma',
      'Перейдите в раздел "API / SIP-настройки"',
      'Скопируйте свой API-ключ и секретный ключ',
      'Настройте Callback URL на ваш сервер',
      'Вставьте данные в поля ниже и нажмите "Сохранить"',
      'URL API: https://api.zadarma.com',
    ],
  },
};

export default function TelephonyPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'settings' | 'logs' | 'help'>('settings');

  const [provider, setProvider] = useState('telphin');
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [widgetUrl, setWidgetUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const s = await api.getTelephonySettings();
      if (s && s.id) {
        setProvider(s.provider || 'telphin');
        setEnabled(!!s.enabled);
        setApiKey(s.api_key || '');
        setApiSecret(s.api_secret || '');
        setApiUrl(s.api_url || '');
        setWidgetUrl(s.widget_url || '');
      }
    } catch (e) { console.error(e); }
  };

  const loadLogs = async () => {
    try {
      const data = await api.getTelephonyLogs();
      setLogs(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateTelephonySettings({ provider, enabled, api_key: apiKey, api_secret: apiSecret, api_url: apiUrl, widget_url: widgetUrl });
      addToast('Настройки сохранены', 'success');
      loadSettings();
    } catch (e: any) { addToast(e.message || 'Ошибка', 'error'); } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testTelephonyConnection();
      setTestResult(r);
    } catch (e: any) { setTestResult({ ok: false, message: e.message }); } finally { setTesting(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
          <Phone className="text-white" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">IP-телефония</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Интеграция с Telphin, Mango Office, Zadarma</p>
        </div>
      </div>

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setTab('settings')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'settings' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
          <Settings size={16} /> Настройки
        </button>
        <button onClick={() => setTab('logs')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'logs' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
          <PhoneCall size={16} /> Журнал звонков
        </button>
        <button onClick={() => setTab('help')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'help' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
          <HelpCircle size={16} /> Помощь
        </button>
      </div>

      {tab === 'settings' && (
        <div className="max-w-2xl">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Провайдер</label>
              <select value={provider} onChange={e => setProvider(e.target.value)} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 bg-zinc-300 dark:bg-zinc-600 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{enabled ? 'Интеграция включена' : 'Интеграция выключена'}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">API Key</label>
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Ваш API ключ" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">API Secret</label>
              <input value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="Секретный ключ" type="password" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">API URL</label>
              <input value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="https://api.telphin.ru" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Widget URL (iframe)</label>
              <input value={widgetUrl} onChange={e => setWidgetUrl(e.target.value)} placeholder="URL виджета телефонии" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 active:scale-[0.97] transition-all disabled:opacity-50">
                <Save size={16} />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all disabled:opacity-50">
                <Play size={16} />
                {testing ? 'Тестирование...' : 'Тест подключения'}
              </button>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${testResult.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500'}`}>
                {testResult.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {testResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <PhoneCall size={48} className="mx-auto mb-3 opacity-30" />
              <p>Нет записей звонков</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left">
                    <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">Дата</th>
                    <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">Направление</th>
                    <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">Звонящий</th>
                    <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">Кому</th>
                    <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">Длительность</th>
                    <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">Статус</th>
                    <th className="px-4 py-3 font-semibold text-zinc-500 dark:text-zinc-400">Запись</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-900 dark:text-white whitespace-nowrap">{log.created_at}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${log.direction === 'incoming' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}>
                          {log.direction === 'incoming' ? 'Входящий' : 'Исходящий'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-900 dark:text-white">{log.caller_phone}</td>
                      <td className="px-4 py-3 text-zinc-900 dark:text-white">{log.callee_phone}</td>
                      <td className="px-4 py-3 text-zinc-500">{log.duration ? `${log.duration} сек` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${log.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : log.status === 'missed' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                          {log.status === 'completed' ? 'Завершён' : log.status === 'missed' ? 'Пропущен' : log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.recording_url ? (
                          <a href={log.recording_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 underline text-xs">Прослушать</a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'help' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(HELP).map(([key, h]) => (
            <div key={key} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
              <h3 className="font-bold text-zinc-900 dark:text-white mb-3">{h.title}</h3>
              <ol className="space-y-2">
                {h.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
