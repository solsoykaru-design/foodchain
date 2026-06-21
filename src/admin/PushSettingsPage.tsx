import { useState, useEffect } from 'react';
import { Save, Plug, Info } from 'lucide-react';
import { addToast } from '../ToastContext';

interface FcmSettings {
  apiKey: string;
  projectId: string;
  senderId: string;
  appId: string;
  isEnabled: boolean;
}

export default function PushSettingsPage() {
  const [settings, setSettings] = useState<FcmSettings>({
    apiKey: '', projectId: '', senderId: '', appId: '', isEnabled: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetch(`/api/push-settings?tenant_id=1`);
      const data = await res.json();
      if (data) setSettings(data);
    } catch { /* use defaults */ }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/push-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: 1, ...settings }),
      });addToast('Настройки сохранены.', 'success');
    } catch (e) {
      addToast(`Ошибка сохранения: ${e}`, 'error');
    } finally { setSaving(false); }
  }

  async function handleTest() {
    try {
      await fetch(`/api/push-settings/test?tenant_id=1`, { method: 'POST' });
      addToast('Соединение с FCM успешно установлено.', 'success');
    } catch (e) {
      addToast(`Ошибка подключения: ${e}`, 'error');
    }
  }

  function update<K extends keyof FcmSettings>(key: K, value: FcmSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Push-настройки</h1>

      <div className="max-w-lg bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
        <Field label="API-ключ" value={settings.apiKey} onChange={v => update('apiKey', v)} />
        <Field label="Project ID" value={settings.projectId} onChange={v => update('projectId', v)} />
        <Field label="Sender ID" value={settings.senderId} onChange={v => update('senderId', v)} />
        <Field label="App ID" value={settings.appId} onChange={v => update('appId', v)} />

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.isEnabled} onChange={e => update('isEnabled', e.target.checked)}
            className="accent-blue-500 w-4 h-4" />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Включить push-уведомления</span>
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 h-9 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
            <Save size={15} /> {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button onClick={handleTest}
            className="flex items-center gap-2 px-4 h-9 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
            <Plug size={15} /> Проверить соединение
          </button>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex gap-2">
          <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Настройки Firebase</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              API-ключ и Project ID можно получить в консоли Firebase (Cloud Messaging → Настройки).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-9 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}
