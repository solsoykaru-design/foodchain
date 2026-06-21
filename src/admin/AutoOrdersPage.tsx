import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, RefreshCw, Play, AlertTriangle, FileText, Check, X, Send, Package, Settings, Save } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function AutoOrdersPage() {
  const [tab, setTab] = useState<'overview' | 'settings'>('overview');
  const [status, setStatus] = useState<{ enabled: boolean; lastCheck: string | null }>({ enabled: false, lastCheck: null });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [autoOrders, setAutoOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  // Settings
  const [settings, setSettings] = useState<any>({ enabled: 0, check_interval: 6, target_formula: '2x_min', target_fixed_value: 0, target_percent: 200, auto_approve: 0, notify_admin: 1, notify_email: '' });
  const [settingsLoading, setSettingsLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusData, lowStockData, docsData, settingsData] = await Promise.all([
        api.getAutoOrdersStatus().catch(() => ({ enabled: false, lastCheck: null })),
        api.getLowStockItems().catch(() => []),
        api.getDocuments({ search: 'Автоматический', limit: 50 }).catch(() => ({ items: [] })),
        api.getAutoOrderSettings().catch(() => settings),
      ]);
      setStatus(statusData);
      setLowStockItems(lowStockData);
      setAutoOrders((docsData.items || []).filter((d: any) => d.note && d.note.includes('Автоматический')));
      setSettings(settingsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleEnabled = async () => {
    try {
      const newVal = !status.enabled;
      await api.toggleAutoOrders(newVal);
      setStatus(prev => ({ ...prev, enabled: newVal }));
      addToast(newVal ? 'Автозаказы включены' : 'Автозаказы отключены', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const runNow = async () => {
    setRunning(true);
    setResultMessage(null);
    try {
      const result = await api.runAutoOrdersCheck();
      const msg = `Создано заказов: ${result.created}. ${result.message}`;
      setResultMessage(result.created > 0 ? msg : `✓ ${result.message}`);
      addToast(msg, result.created > 0 ? 'success' : 'info');
      loadAll();
    } catch (e: any) {
      setResultMessage(`Ошибка: ${e.message}`);
      addToast(e.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const saveSettings = async () => {
    setSettingsLoading(true);
    try {
      const updated = await api.saveAutoOrderSettings(settings);
      setSettings(updated);
      addToast('Настройки сохранены', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
    setSettingsLoading(false);
  };

  const doAction = async (id: number, action: 'approve' | 'reject' | 'send' | 'receive') => {
    setBusyIds(prev => new Set(prev).add(id));
    try {
      const labels: Record<string, string> = { approve: 'утверждён', reject: 'отклонён', send: 'отправлен', receive: 'принят' };
      const fns: Record<string, (id: number) => Promise<any>> = {
        approve: api.approveAutoOrder, reject: api.rejectAutoOrder, send: api.sendAutoOrder, receive: api.receiveAutoOrder,
      };
      const result = await fns[action](id);
      if (result.success) {
        addToast(`Заказ ${labels[action]}`, 'success');
        loadAll();
        setSelectedDoc(null);
      } else {
        addToast(result.error || 'Ошибка', 'error');
      }
    } catch (e: any) { addToast(e.message, 'error'); }
    setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="text-center py-12 text-zinc-400">Загрузка...</div>
      </div>
    );
  }

  const statusLabels: Record<string, string> = { draft: 'Черновик', confirmed: 'Подтверждён', completed: 'Завершён', cancelled: 'Отменён' };
  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
    confirmed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };

  const formulaLabels: Record<string, string> = {
    '2x_min': '2 × Минимальный остаток',
    'fixed': 'Фиксированное значение',
    'percent': '% от минимального остатка',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <ShoppingCart size={22} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Автоматические заказы поставщикам</h1>
            <p className="text-sm text-zinc-500">Управление автозаказами при снижении остатков ниже минимального уровня</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('overview')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === 'overview' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
            <FileText size={16} className="inline mr-1" /> Обзор
          </button>
          <button onClick={() => setTab('settings')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === 'settings' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
            <Settings size={16} className="inline mr-1" /> Настройки
          </button>
        </div>
      </div>

      {resultMessage && (
        <div className={`p-4 rounded-xl text-sm font-medium ${resultMessage.includes('Ошибка') ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : resultMessage.includes('✓') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
          {resultMessage}
        </div>
      )}

      {tab === 'overview' && (
        <>
          {/* Toggle card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">Автоматические заказы</p>
                <p className="text-sm text-zinc-500 mt-1">
                  При включении система будет автоматически создавать черновики заказов контрагентам,
                  когда остаток товара падает ниже минимального.
                </p>
                {status.lastCheck && (
                  <p className="text-xs text-zinc-400 mt-2">
                    Последняя проверка: {new Date(status.lastCheck).toLocaleString('ru-RU')}
                  </p>
                )}
              </div>
              <button onClick={toggleEnabled}
                className={`relative w-14 h-7 rounded-full transition-colors ${status.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${status.enabled ? 'translate-x-7' : ''}`} />
              </button>
            </div>
          </div>

          {/* Low stock */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Товары ниже минимального остатка</h2>
              </div>
              <button onClick={runNow} disabled={running}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                Запустить проверку
              </button>
            </div>
            {lowStockItems.length === 0 ? (
              <div className="text-center py-8 text-zinc-400">
                <p className="text-lg mb-1">✓ Все товары в норме</p>
                <p className="text-sm">Нет товаров с остатком ниже минимального уровня</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Продукт</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Остаток</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Мин. остаток</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Поставщик</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">К заказу</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((item: any) => (
                      <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-white">{item.name}</td>
                        <td className="px-3 py-2.5 text-red-600 font-medium">{item.current_stock ?? item.currentBalance ?? 0}</td>
                        <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{item.min_stock}</td>
                        <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{item.supplier_name || '—'}</td>
                        <td className="px-3 py-2.5 text-emerald-600 font-medium">{Math.ceil(item.min_stock * 2 - (item.current_stock ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Order detail modal */}
          {selectedDoc && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDoc(null)}>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Заказ #{selectedDoc.number}</h3>
                  <button onClick={() => setSelectedDoc(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                    <X size={18} className="text-zinc-500" />
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-500">Поставщик:</span><span className="font-medium">{selectedDoc.counterparty}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Дата:</span><span>{selectedDoc.date}</span></div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Статус:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedDoc.status] || ''}`}>
                      {statusLabels[selectedDoc.status] || selectedDoc.status}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-zinc-500">Сумма:</span><span className="font-bold">{selectedDoc.sum} ₽</span></div>
                  {selectedDoc.note && <div className="text-zinc-400 italic">{selectedDoc.note}</div>}

                  <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                    <p className="font-semibold mb-2">Товары ({(() => { try { return JSON.parse(selectedDoc.items || '[]').length; } catch { return 0; } })()} шт.)</p>
                    <div className="space-y-2">
                      {(() => {
                        try {
                          const items = JSON.parse(selectedDoc.items || '[]');
                          return items.map((i: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2">
                              <div><span className="font-medium">{i.name}</span><span className="text-zinc-400 ml-2">× {i.quantity} {i.unit || 'шт'}</span></div>
                              <span className="font-medium">{i.total} ₽</span>
                            </div>
                          ));
                        } catch { return <div className="text-zinc-400">Ошибка загрузки товаров</div>; }
                      })()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                    {selectedDoc.status === 'draft' && (
                      <>
                        <button onClick={() => doAction(selectedDoc.id, 'approve')} disabled={busyIds.has(selectedDoc.id)}
                          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                          <Check size={16} /> Утвердить
                        </button>
                        <button onClick={() => doAction(selectedDoc.id, 'reject')} disabled={busyIds.has(selectedDoc.id)}
                          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                          <X size={16} /> Отклонить
                        </button>
                      </>
                    )}
                    {selectedDoc.status === 'confirmed' && (
                      <button onClick={() => doAction(selectedDoc.id, 'send')} disabled={busyIds.has(selectedDoc.id)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                        <Send size={16} /> Отправить поставщику
                      </button>
                    )}
                    {(selectedDoc.status === 'confirmed' || selectedDoc.status === 'completed') && (
                      <button onClick={() => doAction(selectedDoc.id, 'receive')} disabled={busyIds.has(selectedDoc.id)}
                        className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                        <Package size={16} /> Принять товар
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders list */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={20} className="text-blue-500" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Автоматические заказы</h2>
            </div>

            {autoOrders.length === 0 ? (
              <div className="text-center py-8 text-zinc-400">
                <p className="text-sm">Автоматические заказы ещё не создавались</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Номер</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Дата</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Поставщик</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Сумма</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Статус</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoOrders.map((doc: any) => (
                      <tr key={doc.id} className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${doc.status === 'draft' ? 'bg-amber-50 dark:bg-amber-900/5' : ''}`}>
                        <td className="px-3 py-2.5 font-mono text-xs font-medium">
                          <button onClick={() => setSelectedDoc(doc)} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {doc.number}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{doc.date}</td>
                        <td className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300">{doc.counterparty}</td>
                        <td className="px-3 py-2.5 font-medium">{doc.sum} ₽</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${statusColors[doc.status] || ''}`}>
                            {doc.status === 'draft' && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                            {statusLabels[doc.status] || doc.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => setSelectedDoc(doc)} className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                              Детали
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm max-w-2xl">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Настройки автозаказов</h2>

          <div className="space-y-5">
            {/* Enabled */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">Глобальное включение</p>
                <p className="text-sm text-zinc-500">Включить или отключить функцию автоматических заказов</p>
              </div>
              <button onClick={() => setSettings((prev: any) => ({ ...prev, enabled: prev.enabled ? 0 : 1 }))}
                className={`relative w-14 h-7 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-7' : ''}`} />
              </button>
            </div>
            <hr className="border-zinc-200 dark:border-zinc-700" />

            {/* Check interval */}
            <div>
              <p className="font-medium text-zinc-900 dark:text-white mb-1">Частота проверки</p>
              <p className="text-sm text-zinc-500 mb-2">Как часто система проверяет остатки и создаёт заказы</p>
              <select value={settings.check_interval} onChange={e => setSettings((prev: any) => ({ ...prev, check_interval: Number(e.target.value) }))}
                className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none w-full max-w-xs">
                <option value={1}>Каждый час</option>
                <option value={6}>Каждые 6 часов</option>
                <option value={12}>Каждые 12 часов</option>
                <option value={24}>Раз в день</option>
              </select>
            </div>
            <hr className="border-zinc-200 dark:border-zinc-700" />

            {/* Target formula */}
            <div>
              <p className="font-medium text-zinc-900 dark:text-white mb-1">Формула расчёта целевого остатка</p>
              <p className="text-sm text-zinc-500 mb-2">Определяет, сколько товара заказывать</p>
              <select value={settings.target_formula} onChange={e => setSettings((prev: any) => ({ ...prev, target_formula: e.target.value }))}
                className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none w-full max-w-xs">
                <option value="2x_min">2 × Минимальный остаток</option>
                <option value="percent">% от минимального остатка</option>
                <option value="fixed">Фиксированное значение</option>
              </select>
              {settings.target_formula === 'fixed' && (
                <input type="number" value={settings.target_fixed_value} onChange={e => setSettings((prev: any) => ({ ...prev, target_fixed_value: Number(e.target.value) }))}
                  className="mt-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none w-full max-w-xs" placeholder="Целевой остаток (ед.)" />
              )}
              {settings.target_formula === 'percent' && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" value={settings.target_percent} onChange={e => setSettings((prev: any) => ({ ...prev, target_percent: Number(e.target.value) }))}
                    className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none w-24" placeholder="200" />
                  <span className="text-zinc-500">% от минимального остатка</span>
                </div>
              )}
            </div>
            <hr className="border-zinc-200 dark:border-zinc-700" />

            {/* Auto-approve */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">Авто-утверждение</p>
                <p className="text-sm text-zinc-500">Если включено — заказы утверждаются автоматически без ручного подтверждения</p>
              </div>
              <button onClick={() => setSettings((prev: any) => ({ ...prev, auto_approve: prev.auto_approve ? 0 : 1 }))}
                className={`relative w-14 h-7 rounded-full transition-colors ${settings.auto_approve ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.auto_approve ? 'translate-x-7' : ''}`} />
              </button>
            </div>
            <hr className="border-zinc-200 dark:border-zinc-700" />

            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">Уведомления администратору</p>
                <p className="text-sm text-zinc-500">Отправлять уведомление при создании автоматического заказа</p>
              </div>
              <button onClick={() => setSettings((prev: any) => ({ ...prev, notify_admin: prev.notify_admin ? 0 : 1 }))}
                className={`relative w-14 h-7 rounded-full transition-colors ${settings.notify_admin ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.notify_admin ? 'translate-x-7' : ''}`} />
              </button>
            </div>
            <hr className="border-zinc-200 dark:border-zinc-700" />

            {/* Email */}
            <div>
              <p className="font-medium text-zinc-900 dark:text-white mb-1">Email для уведомлений</p>
              <p className="text-sm text-zinc-500 mb-2">Дополнительный email для оповещений (опционально)</p>
              <input type="email" value={settings.notify_email} onChange={e => setSettings((prev: any) => ({ ...prev, notify_email: e.target.value }))}
                className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none w-full max-w-xs" placeholder="admin@example.com" />
            </div>

            <button onClick={saveSettings} disabled={settingsLoading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50">
              <Save size={16} /> {settingsLoading ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
