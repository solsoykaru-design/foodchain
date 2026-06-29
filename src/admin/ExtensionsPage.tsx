import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Puzzle, Download, Trash2, ToggleLeft, ToggleRight, Webhook, Activity, X, Plus, Copy, Check, Terminal } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

const BUILTIN_CATALOG = [
  { name: 'Яндекс Еда', description: 'Интеграция с Яндекс Еда', version: '2.0.0', developer: 'FoodChain', icon: '🍔', type: 'integration', builtin: true },
  { name: 'МойСклад', description: 'Синхронизация с МойСклад', version: '1.0.0', developer: 'FoodChain', icon: '📦', type: 'integration' },
  { name: 'Telegram Bot', description: 'Расширенный Telegram бот', version: '1.5.0', developer: 'FoodChain', icon: '🤖', type: 'integration', builtin: true },
  { name: 'Excel Reports', description: 'Расширенные Excel-отчёты', version: '1.0.0', developer: 'FoodChain', icon: '📊', type: 'integration' },
  { name: 'Email Marketing', description: 'Email-маркетинг', version: '1.2.0', developer: 'FoodChain', icon: '📧', type: 'integration', builtin: true },
  { name: 'CRM Битрикс24', description: 'Интеграция с Битрикс24', version: '1.1.0', developer: 'FoodChain', icon: '💼', type: 'integration', builtin: true },
  { name: 'OpenAPI', description: 'Генерация OpenAPI спецификации', version: '1.0.0', developer: 'FoodChain', icon: '📝', type: 'integration', builtin: true },
];

const EVENTS = [
  { value: 'order.created', label: 'Заказ создан' },
  { value: 'order.status_changed', label: 'Статус заказа изменён' },
  { value: 'order.paid', label: 'Заказ оплачен' },
  { value: '*', label: 'Все события' },
];

export default function ExtensionsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'installed' | 'catalog' | 'logs'>('installed');
  const [installed, setInstalled] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedExt, setSelectedExt] = useState<any>(null);
  const [newEndpoint, setNewEndpoint] = useState('');
  const [newEvent, setNewEvent] = useState('order.created');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { loadExtensions(); loadLogs(); }, []);

  const loadExtensions = async () => {
    try {
      const data = await api.getExtensions();
      setInstalled(data.installed || []);
    } catch (e) { console.error(e); }
  };

  const loadLogs = async () => {
    try {
      const data = await api.getExtensionWebhookLogs();
      setLogs(data || []);
    } catch (e) { console.error(e); }
  };

  const isInstalled = (name: string) => installed.some(i => i.name === name);

  const handleInstall = async (ext: any) => {
    try {
      await api.installExtension(ext);
      addToast(`${ext.name} установлен`, 'success');
      loadExtensions();
    } catch (e: any) { addToast(e.message || 'Ошибка установки', 'error'); }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.toggleExtension(id);
      loadExtensions();
    } catch (e: any) { addToast(e.message || 'Ошибка', 'error'); }
  };

  const handleUninstall = async (id: number) => {
    try {
      await api.uninstallExtension(id);
      addToast('Расширение удалено', 'success');
      loadExtensions();
      if (selectedExt?.id === id) setSelectedExt(null);
    } catch (e: any) { addToast(e.message || 'Ошибка удаления', 'error'); }
  };

  const handleAddHook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExt || !newEndpoint.trim()) return;
    try {
      await api.createExtensionHook({ extension_id: selectedExt.id, event: newEvent, endpoint: newEndpoint.trim() });
      addToast('Webhook добавлен', 'success');
      setNewEndpoint('');
      loadExtensions();
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  const handleDeleteHook = async (hookId: number) => {
    try {
      await api.deleteExtensionHook(hookId);
      addToast('Webhook удалён', 'success');
      loadExtensions();
    } catch (err: any) { addToast(err.message || 'Ошибка', 'error'); }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const selectedInstalled = installed.find(i => i.id === selectedExt?.id);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
          <Puzzle className="text-white" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Магазин приложений</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Управление расширениями, интеграциями и вебхуками</p>
        </div>
      </div>

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'installed', label: `Установленные (${installed.length})` },
          { key: 'catalog', label: 'Каталог' },
          { key: 'logs', label: 'Логи вебхуков' },
        ].map((item: any) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === item.key ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'installed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installed.length === 0 && (
            <div className="col-span-full text-center py-12 text-zinc-400">
              <Puzzle size={48} className="mx-auto mb-3 opacity-30" />
              <p>Нет установленных расширений</p>
            </div>
          )}
          {installed.map(ext => (
            <div key={ext.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{ext.icon || '🧩'}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-zinc-900 dark:text-white truncate">{ext.name}</h3>
                  {ext.version && <p className="text-xs text-zinc-400">v{ext.version}</p>}
                </div>
              </div>
              {ext.description && <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">{ext.description}</p>}
              {ext.developer && <p className="text-xs text-zinc-400 mb-3">Разработчик: {ext.developer}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => handleToggle(ext.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ext.is_active ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                  {ext.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {ext.is_active ? 'Вкл' : 'Выкл'}
                </button>
                <button onClick={() => setSelectedExt(ext)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all">
                  <Webhook size={14} />
                  Webhooks ({(ext.hooks || []).length})
                </button>
                <button onClick={() => handleUninstall(ext.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all">
                  <Trash2 size={14} />
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BUILTIN_CATALOG.map(ext => {
            const installed_ = isInstalled(ext.name);
            return (
              <div key={ext.name} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{ext.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-900 dark:text-white truncate">{ext.name}</h3>
                    <p className="text-xs text-zinc-400">v{ext.version}</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">{ext.description}</p>
                <p className="text-xs text-zinc-400 mb-3">Разработчик: {ext.developer}</p>
                <button onClick={() => handleInstall(ext)} disabled={installed_}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${installed_ ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.97]'}`}>
                  <Download size={16} />
                  {installed_ ? 'Установлено' : 'Установить'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Terminal size={18} /> Логи доставки вебхуков</h3>
            <button onClick={loadLogs} className="text-sm text-blue-500 hover:underline">Обновить</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500">
                <tr>
                  <th className="text-left p-3">Время</th>
                  <th className="text-left p-3">Событие</th>
                  <th className="text-left p-3">Endpoint</th>
                  <th className="text-left p-3">Статус</th>
                  <th className="text-left p-3">Ответ</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-zinc-400">Нет записей</td></tr>
                )}
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="p-3 text-zinc-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3"><span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium">{log.event}</span></td>
                    <td className="p-3 max-w-xs truncate" title={log.endpoint}>{log.endpoint}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${log.status >= 200 && log.status < 300 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {log.status || 'ERR'}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs truncate text-zinc-500" title={log.response}>{log.response}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedExt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedExt(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedInstalled?.icon || '🧩'}</span>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{selectedInstalled?.name || selectedExt.name}</h3>
                  <p className="text-xs text-zinc-500">Настройка вебхуков</p>
                </div>
              </div>
              <button onClick={() => setSelectedExt(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={20} /></button>
            </div>

            <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Секретный ключ подписи (X-Hook-Secret)</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-zinc-100 dark:bg-zinc-900 px-3 py-2 rounded-lg break-all">{selectedInstalled?.hook_secret}</code>
                <button onClick={() => copyToClipboard(selectedInstalled?.hook_secret, 'secret')} className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600">
                  {copiedId === 'secret' ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <form onSubmit={handleAddHook} className="mb-6 flex gap-2">
              <select value={newEvent} onChange={e => setNewEvent(e.target.value)} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm">
                {EVENTS.map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
              </select>
              <input type="url" required value={newEndpoint} onChange={e => setNewEndpoint(e.target.value)} placeholder="https://example.com/webhook" className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" />
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 flex items-center gap-1"><Plus size={16} /> Добавить</button>
            </form>

            <h4 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2"><Activity size={16} /> Активные вебхуки</h4>
            <div className="space-y-2">
              {(selectedInstalled?.hooks || []).length === 0 && <p className="text-sm text-zinc-400">Нет настроенных вебхуков</p>}
              {(selectedInstalled?.hooks || []).map((hook: any) => (
                <div key={hook.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div>
                    <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium mr-2">{hook.event}</span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{hook.endpoint}</span>
                  </div>
                  <button onClick={() => handleDeleteHook(hook.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
