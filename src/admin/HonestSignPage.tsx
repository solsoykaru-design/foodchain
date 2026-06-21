import { useState, useEffect } from 'react';
import { ShieldCheck, Settings2, Package, Search, CheckCircle, XCircle } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function HonestSignPage() {
  const [tab, setTab] = useState<'settings' | 'products' | 'check'>('settings');
  const [settings, setSettings] = useState<any>({ enabled: false, api_key: '', organization_inn: '' });
  const [products, setProducts] = useState<any[]>([]);
  const [markingCode, setMarkingCode] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getHonestSignSettings().then(s => { if (s && s.id) setSettings(s); }).catch(() => {}),
      api.getHonestSignProducts().then(setProducts).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const saveSettings = async () => {
    try {
      await api.updateHonestSignSettings(settings);
      addToast('Настройки сохранены', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const checkCode = async () => {
    if (!markingCode) return;
    try {
      const result = await api.checkHonestSignCode(markingCode);
      setCheckResult(result);
    } catch (e: any) { setCheckResult({ valid: false, error: e.message }); }
  };

  if (loading) {
    return <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm"><div className="text-center py-12 text-zinc-400">Загрузка...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <ShieldCheck size={22} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Честный знак</h1>
          <p className="text-sm text-zinc-500">Маркировка товаров и проверка кодов</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([['settings', 'Настройки', Settings2], ['products', 'Товары', Package], ['check', 'Проверка', Search]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${tab === key ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Настройки интеграции</h2>
          <div className="space-y-4 max-w-md">
            <div className="flex items-center justify-between">
              <div><p className="font-medium">Включить</p><p className="text-sm text-zinc-500">Интеграция с Честным знаком</p></div>
              <button onClick={() => setSettings((p: any) => ({ ...p, enabled: !p.enabled }))}
                className={`relative w-14 h-7 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-7' : ''}`} />
              </button>
            </div>
            <div>
              <p className="font-medium mb-1">API ключ</p>
              <input type="text" value={settings.api_key} onChange={e => setSettings((p: any) => ({ ...p, api_key: e.target.value }))}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="Введите API ключ" />
            </div>
            <div>
              <p className="font-medium mb-1">ИНН организации</p>
              <input type="text" value={settings.organization_inn} onChange={e => setSettings((p: any) => ({ ...p, organization_inn: e.target.value }))}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="Введите ИНН" />
            </div>
            <button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">Сохранить</button>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Маркированные товары</h2>
          {products.length === 0 ? (
            <div className="text-center py-8 text-zinc-400"><p>Маркированные товары не найдены</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Товар</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">GTIN</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => (
                    <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2.5 font-medium">{p.product_name || `#${p.product_id}`}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{p.gtin || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'confirmed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                          {p.status === 'confirmed' ? 'Подтверждён' : 'Ожидает'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'check' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Проверка кода маркировки</h2>
          <div className="flex gap-2 max-w-md">
            <input type="text" value={markingCode} onChange={e => setMarkingCode(e.target.value)}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="Введите код маркировки" />
            <button onClick={checkCode} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2">
              <Search size={16} /> Проверить
            </button>
          </div>
          {checkResult && (
            <div className={`mt-4 p-4 rounded-xl text-sm font-medium flex items-center gap-3 ${checkResult.valid ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
              {checkResult.valid ? <CheckCircle size={20} /> : <XCircle size={20} />}
              <div>
                <p className="font-bold">{checkResult.valid ? 'Код корректен' : 'Ошибка'}</p>
                {checkResult.valid && <p className="text-xs mt-0.5">GTIN: {checkResult.product_gtin}</p>}
                {checkResult.error && <p className="text-xs mt-0.5">{checkResult.error}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
