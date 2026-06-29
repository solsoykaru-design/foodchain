import { useState, useEffect } from 'react';
import { ShieldCheck, Settings2, Package, Search, CheckCircle, XCircle, FileText, RefreshCw, Plus, Send, Loader2, X } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function HonestSignPage() {
  const [tab, setTab] = useState<'settings' | 'products' | 'codes' | 'documents' | 'check'>('settings');
  const [settings, setSettings] = useState<any>({ enabled: false, api_key: '', organization_inn: '', fsrar_id: '', gost_key_path: '', test_mode: true, api_url: '' });
  const [products, setProducts] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [markingCode, setMarkingCode] = useState('');
  const [bulkCodes, setBulkCodes] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState({ product_id: '', gtin: '', product_type: 'inventory' });
  const [newDoc, setNewDoc] = useState({ type: 'act_write_off', reason: 'Реализация', items: [] as any[] });
  const [showProductModal, setShowProductModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, p, d] = await Promise.all([
        api.getHonestSignSettings(),
        api.getHonestSignProducts(),
        api.getHonestSignDocuments(),
      ]);
      if (s && s.id) setSettings({ ...s, test_mode: s.test_mode !== 0 });
      setProducts(p || []);
      setDocuments(d || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadCodes = async (productId: number) => {
    try {
      const c = await api.getHonestSignCodes(productId);
      setCodes(c || []);
    } catch (e) { console.error(e); }
  };

  const saveSettings = async () => {
    try {
      await api.updateHonestSignSettings({ ...settings, test_mode: settings.test_mode ? 1 : 0 });
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncHonestSignProducts();
      addToast(res.message, 'info');
    } catch (e: any) { addToast(e.message, 'error'); }
    setSyncing(false);
  };

  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.registerHonestSignProduct({ product_id: Number(newProduct.product_id), gtin: newProduct.gtin, product_type: newProduct.product_type });
      addToast('Товар зарегистрирован', 'success');
      setShowProductModal(false);
      setNewProduct({ product_id: '', gtin: '', product_type: 'inventory' });
      loadAll();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleAddCodes = async () => {
    if (!selectedProduct || !bulkCodes.trim()) return;
    try {
      const list = bulkCodes.split(/\n|,/).map(s => s.trim()).filter(Boolean);
      const res = await api.addHonestSignCodes(selectedProduct.id, list);
      addToast(`Добавлено кодов: ${res.added}`, 'success');
      setBulkCodes('');
      loadCodes(selectedProduct.id);
      loadAll();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const items = newDoc.items.length ? newDoc.items : [{ identity: 1, marking_code: markingCode, quantity: 1 }];
      await api.createHonestSignDocument({ type: newDoc.type, reason: newDoc.reason, items });
      addToast('Документ создан', 'success');
      setShowDocModal(false);
      setNewDoc({ type: 'act_write_off', reason: 'Реализация', items: [] });
      loadAll();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleSendDocument = async (id: number) => {
    try {
      const res = await api.sendHonestSignDocument(id);
      addToast(res.message, res.ok ? 'success' : 'info');
      loadAll();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-zinc-100 text-zinc-600',
      sent: 'bg-blue-100 text-blue-600',
      sent_demo: 'bg-amber-100 text-amber-600',
      confirmed: 'bg-emerald-100 text-emerald-600',
      registered: 'bg-blue-100 text-blue-600',
      pending: 'bg-amber-100 text-amber-600',
      available: 'bg-emerald-100 text-emerald-600',
      reserved: 'bg-amber-100 text-amber-600',
      used: 'bg-zinc-100 text-zinc-600',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-zinc-100 text-zinc-600'}`}>{status}</span>;
  };

  if (loading) {
    return <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm"><div className="text-center py-12 text-zinc-400">Загрузка...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <ShieldCheck size={22} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Честный знак / ЕГАИС</h1>
            <p className="text-sm text-zinc-500">Маркировка товаров, проверка кодов и документы ЕГАИС</p>
          </div>
        </div>
        <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-sm font-medium transition">
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> Синхронизировать
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([['settings', 'Настройки', Settings2], ['products', 'Товары', Package], ['codes', 'Коды', Search], ['documents', 'Документы', FileText], ['check', 'Проверка', Search]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${tab === key ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Настройки интеграции</h2>
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center justify-between">
              <div><p className="font-medium">Включить</p><p className="text-sm text-zinc-500">Интеграция с Честным знаком</p></div>
              <button onClick={() => setSettings((p: any) => ({ ...p, enabled: !p.enabled }))}
                className={`relative w-14 h-7 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-7' : ''}`} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="font-medium mb-1 text-sm">API ключ</p><input type="text" value={settings.api_key || ''} onChange={e => setSettings((p: any) => ({ ...p, api_key: e.target.value }))} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="API ключ Честного знака" /></div>
              <div><p className="font-medium mb-1 text-sm">ИНН организации</p><input type="text" value={settings.organization_inn || ''} onChange={e => setSettings((p: any) => ({ ...p, organization_inn: e.target.value }))} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="ИНН" /></div>
              <div><p className="font-medium mb-1 text-sm">FS RAR ID (ЕГАИС)</p><input type="text" value={settings.fsrar_id || ''} onChange={e => setSettings((p: any) => ({ ...p, fsrar_id: e.target.value }))} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="Идентификатор в ЕГАИС" /></div>
              <div><p className="font-medium mb-1 text-sm">URL API</p><input type="text" value={settings.api_url || ''} onChange={e => setSettings((p: any) => ({ ...p, api_url: e.target.value }))} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="https://..." /></div>
              <div className="md:col-span-2"><p className="font-medium mb-1 text-sm">Путь к ключу ГОСТ</p><input type="text" value={settings.gost_key_path || ''} onChange={e => setSettings((p: any) => ({ ...p, gost_key_path: e.target.value }))} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="/path/to/key.p12" /></div>
            </div>
            <div className="flex items-center gap-2">
              <input id="test_mode" type="checkbox" checked={settings.test_mode} onChange={e => setSettings((p: any) => ({ ...p, test_mode: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="test_mode" className="text-sm">Тестовый режим (демо-отправка без реального ЕГАИС)</label>
            </div>
            <button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition">Сохранить</button>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Маркированные товары</h2>
            <button onClick={() => setShowProductModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><Plus size={16} /> Добавить</button>
          </div>
          {products.length === 0 ? (
            <div className="text-center py-8 text-zinc-400"><p>Маркированные товары не найдены</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-200 dark:border-zinc-700"><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Товар</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">GTIN</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Тип</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Статус</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500"></th></tr></thead>
                <tbody>
                  {products.map((p: any) => (
                    <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2.5 font-medium">{p.product_name || `#${p.product_id}`}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{p.gtin || '—'}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{p.product_type}</td>
                      <td className="px-3 py-2.5">{statusBadge(p.status)}</td>
                      <td className="px-3 py-2.5"><button onClick={() => { setSelectedProduct(p); loadCodes(p.id); setTab('codes'); }} className="text-blue-600 hover:underline text-xs">Коды</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'codes' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Коды маркировки {selectedProduct ? `— ${selectedProduct.product_name || '#' + selectedProduct.id}` : ''}</h2>
          <div className="mb-4">
            <select value={selectedProduct?.id || ''} onChange={e => { const p = products.find((x: any) => x.id === Number(e.target.value)); setSelectedProduct(p || null); if (p) loadCodes(p.id); }} className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm">
              <option value="">Выберите товар</option>
              {products.map((p: any) => <option key={p.id} value={p.id}>{p.product_name || `#${p.id}`} {p.gtin ? `(GTIN: ${p.gtin})` : ''}</option>)}
            </select>
          </div>
          {selectedProduct && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Добавить коды (по одному на строку или через запятую)</p>
                <textarea value={bulkCodes} onChange={e => setBulkCodes(e.target.value)} rows={4} className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="0104630032..." />
                <button onClick={handleAddCodes} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><Plus size={16} /> Добавить коды</button>
              </div>
              {codes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-zinc-200 dark:border-zinc-700"><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Код</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Статус</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Источник</th></tr></thead>
                    <tbody>
                      {codes.map((c: any) => (
                        <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-2 font-mono text-xs truncate max-w-xs" title={c.code}>{c.code}</td>
                          <td className="px-3 py-2">{statusBadge(c.status)}</td>
                          <td className="px-3 py-2 text-zinc-500 text-xs">{c.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Документы ЕГАИС</h2>
            <button onClick={() => setShowDocModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><Plus size={16} /> Создать</button>
          </div>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-zinc-400"><p>Документы не найдены</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-200 dark:border-zinc-700"><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Номер</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Тип</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Причина</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Кол-во</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Статус</th><th className="text-left px-3 py-2 text-xs font-medium text-zinc-500"></th></tr></thead>
                <tbody>
                  {documents.map((d: any) => (
                    <tr key={d.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2 font-mono text-xs">{d.doc_number}</td>
                      <td className="px-3 py-2">{d.type}</td>
                      <td className="px-3 py-2 text-zinc-500">{d.reason}</td>
                      <td className="px-3 py-2">{d.total_quantity}</td>
                      <td className="px-3 py-2">{statusBadge(d.status)}</td>
                      <td className="px-3 py-2">
                        {d.status === 'draft' && <button onClick={() => handleSendDocument(d.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><Send size={12} /> Отправить</button>}
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
            <input type="text" value={markingCode} onChange={e => setMarkingCode(e.target.value)} className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none" placeholder="Введите код маркировки" />
            <button onClick={checkCode} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"><Search size={16} /> Проверить</button>
          </div>
          {checkResult && (
            <div className={`mt-4 p-4 rounded-xl text-sm font-medium flex items-center gap-3 ${checkResult.valid ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
              {checkResult.valid ? <CheckCircle size={20} /> : <XCircle size={20} />}
              <div>
                <p className="font-bold">{checkResult.valid ? 'Код корректен' : 'Ошибка'}</p>
                {checkResult.gtin && <p className="text-xs mt-0.5">GTIN: {checkResult.gtin}</p>}
                {checkResult.message && <p className="text-xs mt-0.5">{checkResult.message}</p>}
                {checkResult.error && <p className="text-xs mt-0.5">{checkResult.error}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowProductModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">Регистрация товара</h3><button onClick={() => setShowProductModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleRegisterProduct} className="space-y-4">
              <div><label className="text-sm font-medium">ID товара в справочнике</label><input type="number" required value={newProduct.product_id} onChange={e => setNewProduct(p => ({ ...p, product_id: e.target.value }))} className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm" /></div>
              <div><label className="text-sm font-medium">GTIN</label><input type="text" value={newProduct.gtin} onChange={e => setNewProduct(p => ({ ...p, gtin: e.target.value }))} className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm" placeholder="14 цифр" /></div>
              <div><label className="text-sm font-medium">Тип</label><select value={newProduct.product_type} onChange={e => setNewProduct(p => ({ ...p, product_type: e.target.value }))} className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm"><option value="inventory">Товар</option><option value="dish">Блюдо</option><option value="alcohol">Алкоголь</option></select></div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium">Зарегистрировать</button>
            </form>
          </div>
        </div>
      )}

      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDocModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">Создать документ ЕГАИС</h3><button onClick={() => setShowDocModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div><label className="text-sm font-medium">Тип документа</label><select value={newDoc.type} onChange={e => setNewDoc(p => ({ ...p, type: e.target.value }))} className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm"><option value="act_write_off">Акт списания</option></select></div>
              <div><label className="text-sm font-medium">Причина</label><input type="text" value={newDoc.reason} onChange={e => setNewDoc(p => ({ ...p, reason: e.target.value }))} className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm" /></div>
              <div><label className="text-sm font-medium">Код маркировки (для теста)</label><input type="text" value={markingCode} onChange={e => setMarkingCode(e.target.value)} className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm" placeholder="Оставьте пустым для создания пустого документа" /></div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium">Создать</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
