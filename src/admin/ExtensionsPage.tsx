import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Puzzle, Download, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
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

export default function ExtensionsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'installed' | 'catalog'>('installed');
  const [installed, setInstalled] = useState<any[]>([]);

  useEffect(() => { loadExtensions(); }, []);

  const loadExtensions = async () => {
    try {
      const data = await api.getExtensions();
      setInstalled(data.installed || []);
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
    } catch (e: any) { addToast(e.message || 'Ошибка удаления', 'error'); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
          <Puzzle className="text-white" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Магазин приложений</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Управление расширениями и интеграциями</p>
        </div>
      </div>

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setTab('installed')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'installed' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
          Установленные ({installed.length})
        </button>
        <button onClick={() => setTab('catalog')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'catalog' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
          Каталог
        </button>
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
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(ext.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ext.is_active ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                  {ext.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {ext.is_active ? 'Вкл' : 'Выкл'}
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
    </div>
  );
}
