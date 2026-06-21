import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Warehouse, Plus, X, Edit3, Trash2, Search, ArrowUpDown, AlertTriangle, History, Download } from 'lucide-react';

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', category: 'ingredient', unit: 'г', price_per_unit: 0, current_balance: 0, supplier_id: 0 });
  const [showTxForm, setShowTxForm] = useState(false);
  const [txForm, setTxForm] = useState({ item_id: 0, type: 'incoming', quantity: 0, price_per_unit: 0, supplier_id: 0, note: '' });
  const [tab, setTab] = useState<'items' | 'transactions' | 'suppliers'>('items');
  const [supForm, setSupForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' });
  const [showSupForm, setShowSupForm] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any[] | null>(null);

  const load = async () => {
    try {
      const [inv, sups] = await Promise.all([api.getInventory(), api.getSuppliers()]);
      setItems(inv);
      setSuppliers(sups);
    } catch {}
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (tab === 'transactions') api.getInventoryTransactions().then(setTransactions).catch(() => {});
  }, [tab]);

  const filtered = items.filter((i: any) => i.name?.toLowerCase().includes(search.toLowerCase()));

  const save = async () => {
    try {
      if (editItem) await api.updateInventoryItem(editItem.id, form);
      else await api.createInventoryItem(form);
      setShowForm(false); setEditItem(null); load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const delItem = async (id: number) => {
    if (!confirm('Удалить позицию?')) return;
    try { await api.deleteInventoryItem(id); load(); } catch (e: any) { addToast(e.message, 'error'); }
  };

  const saveTx = async () => {
    try {
      await api.createInventoryTransaction(txForm);
      setShowTxForm(false);
      load();
      api.getInventoryTransactions().then(setTransactions).catch(() => {});
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const saveSupplier = async () => {
    try {
      await api.createSupplier(supForm);
      setShowSupForm(false);
      setSupForm({ name: '', contact_person: '', phone: '', email: '', address: '' });
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const exportCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(item => columns.map(c => `"${String(item[c.key] ?? '')}"`).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportItems = () => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Название' },
      { key: 'article', label: 'Артикул' },
      { key: 'currentBalance', label: 'Количество' },
      { key: 'unit', label: 'Единица' },
      { key: 'pricePerUnit', label: 'Цена' },
    ];
    exportCSV(items, 'inventory.csv', columns);
  };

  const delSupplier = async (id: number) => {
    if (!confirm('Удалить поставщика?')) return;
    try { await api.deleteSupplier(id); load(); } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Склад</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Всего: {items.length} позиций
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'items' && <button onClick={() => { setEditItem(null); setForm({ name: '', category: 'ingredient', unit: 'кг', price_per_unit: 0, current_balance: 0, supplier_id: 0 }); setShowForm(true); }} className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600 active:scale-[0.97]"><Plus size={18} /> Добавить</button>}
          {tab === 'items' && <button onClick={() => setShowTxForm(true)} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-600 active:scale-[0.97]"><ArrowUpDown size={18} /> Операция</button>}
          {tab === 'items' && <button onClick={handleExportItems} className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-600 active:scale-[0.97] transition-all"><Download size={18} /> Экспорт CSV</button>}
          {tab === 'suppliers' && <button onClick={() => setShowSupForm(true)} className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600 active:scale-[0.97]"><Plus size={18} /> Поставщик</button>}
        </div>
      </div>

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 text-sm w-fit">
        {(['items', 'transactions', 'suppliers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg font-medium transition ${tab === t ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-zinc-500'}`}>
            {t === 'items' ? 'Товары' : t === 'transactions' ? 'Движение' : 'Поставщики'}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
          </div>
          <div className="grid gap-3">
            {filtered.map((item: any) => {
              const balance = item.currentBalance ?? item.currentStock ?? 0;
              const supplier = suppliers.find((s: any) => s.id === item.supplierId);
              return (
                <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${item.category === 'ingredient' ? 'bg-green-500' : item.category === 'packaging' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                        {item.category === 'ingredient' ? 'И' : item.category === 'packaging' ? 'У' : 'Р'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-zinc-900 dark:text-white">{item.name}</h4>
                        <p className="text-xs text-zinc-500">{item.category === 'ingredient' ? 'Ингредиент' : item.category === 'packaging' ? 'Упаковка' : 'Расходник'} • {item.pricePerUnit}₽/{item.unit}</p>
                        {supplier && <p className="text-xs text-zinc-400">Поставщик: {supplier.name}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${balance <= 0 ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>{balance} {item.unit}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button onClick={() => { setEditItem(item); setForm({ name: item.name, category: item.category, unit: item.unit, price_per_unit: item.pricePerUnit, current_balance: balance, supplier_id: item.supplierId || 0 }); setShowForm(true); }} className="p-1.5 text-zinc-400 hover:text-blue-500"><Edit3 size={14} /></button>
                    <button onClick={() => delItem(item.id)} className="p-1.5 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
                    <button onClick={async () => { try { const h = await api.getPriceHistory(item.id); setPriceHistory(h); } catch { setPriceHistory([]); } }} className="p-1.5 text-zinc-400 hover:text-purple-500" title="История цен"><History size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'transactions' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-bold text-zinc-900 dark:text-white">Движение товаров</h3>
            <button onClick={() => setShowTxForm(true)} className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-600 active:scale-[0.97]"><Plus size={14} className="inline" /> Операция</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr><th className="text-left p-3 text-zinc-500 font-medium text-xs">Товар</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Тип</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Кол-во</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Цена</th><th className="text-right p-3 text-zinc-500 font-medium text-xs">Сумма</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Поставщик</th><th className="text-left p-3 text-zinc-500 font-medium text-xs">Дата</th></tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="p-3 text-zinc-900 dark:text-white">{tx.itemName || items.find((i: any) => i.id === tx.itemId)?.name || `#${tx.itemId}`}</td>
                    <td className="p-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tx.type === 'incoming' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : tx.type === 'outgoing' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700'}`}>{tx.type === 'incoming' ? 'Приход' : tx.type === 'outgoing' ? 'Расход' : 'Списание'}</span></td>
                    <td className="p-3 text-right font-medium text-zinc-900 dark:text-white">{tx.quantity}</td>
                    <td className="p-3 text-right text-zinc-500">{tx.pricePerUnit}₽</td>
                    <td className="p-3 text-right font-bold text-zinc-900 dark:text-white">{tx.total?.toLocaleString() || (tx.quantity * tx.pricePerUnit).toLocaleString()}₽</td>
                    <td className="p-3 text-zinc-500 text-xs">{tx.supplierName || suppliers.find((s: any) => s.id === tx.supplierId)?.name || '—'}</td>
                    <td className="p-3 text-zinc-400 text-xs">{tx.createdAt ? new Date(tx.createdAt).toLocaleString('ru') : ''}</td>
                  </tr>
                ))}
                {transactions.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-zinc-400">Нет операций</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="grid gap-3">
          {suppliers.map((s: any) => (
            <div key={s.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-white">{s.name}</h4>
                  <p className="text-xs text-zinc-500">{s.contactPerson} • {s.phone} • {s.email}</p>
                  <p className="text-xs text-zinc-400">{s.address}</p>
                </div>
                <button onClick={() => delSupplier(s.id)} className="p-1.5 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && <p className="text-center text-zinc-400 py-8">Нет поставщиков</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">{editItem ? 'Редактировать' : 'Добавить'} товар</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Название</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500">Категория</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                    <option value="ingredient">Ингредиент</option><option value="packaging">Упаковка</option><option value="consumable">Расходник</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Ед. изм.</label>
                  <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                    <option>кг</option><option>г</option><option>л</option><option>шт</option><option>уп</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Цена за ед.</label><input type="number" min={0} step={0.1} value={form.price_per_unit || ''} onChange={e => setForm({...form, price_per_unit: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Тек. остаток (авто)</label><input type="number" value={form.current_balance || 0} readOnly className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed" /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Поставщик</label>
                <select value={form.supplier_id} onChange={e => setForm({...form, supplier_id: Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                  <option value={0}>Нет</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button onClick={save} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97]">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {showTxForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowTxForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">Операция со складом</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Товар</label>
                <select value={txForm.item_id} onChange={e => setTxForm({...txForm, item_id: Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                  <option value={0}>Выберите товар</option>
                  {items.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.currentBalance ?? i.currentStock ?? 0} {i.unit})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Тип</label>
                <select value={txForm.type} onChange={e => setTxForm({...txForm, type: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                  <option value="incoming">Приход</option><option value="outgoing">Расход</option><option value="write_off">Списание</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-500">Количество</label><input type="number" value={txForm.quantity || ''} onChange={e => setTxForm({...txForm, quantity: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Цена за ед.</label><input type="number" value={txForm.price_per_unit || ''} onChange={e => setTxForm({...txForm, price_per_unit: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Поставщик</label>
                <select value={txForm.supplier_id} onChange={e => setTxForm({...txForm, supplier_id: Number(e.target.value)})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                  <option value={0}>Нет</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Примечание</label>
                <input value={txForm.note} onChange={e => setTxForm({...txForm, note: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
              <button onClick={saveTx} className="w-full bg-green-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-green-600 active:scale-[0.97]">Провести операцию</button>
            </div>
          </div>
        </div>
      )}

      {showSupForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSupForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">Новый поставщик</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs font-medium text-zinc-500">Название</label><input value={supForm.name} onChange={e => setSupForm({...supForm, name: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Контактное лицо</label><input value={supForm.contact_person} onChange={e => setSupForm({...supForm, contact_person: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Телефон</label><input value={supForm.phone} onChange={e => setSupForm({...supForm, phone: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Email</label><input value={supForm.email} onChange={e => setSupForm({...supForm, email: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
                <div><label className="text-xs font-medium text-zinc-500">Адрес</label><input value={supForm.address} onChange={e => setSupForm({...supForm, address: e.target.value})} className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" /></div>
              </div>
              <button onClick={saveSupplier} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97]">Добавить</button>
            </div>
          </div>
        </div>
      )}

      {priceHistory !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPriceHistory(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">История цен</h3>
              <button onClick={() => setPriceHistory(null)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            {priceHistory.length === 0 ? (
              <p className="text-zinc-500 text-sm">Нет истории изменений цен</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {priceHistory.map((p: any, i: number) => (
                  <div key={i} className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-2">
                    <span className="text-xs text-zinc-400">{new Date(p.createdAt).toLocaleDateString('ru')}</span>
                    <span className="ml-2">{p.oldPrice || '—'} → {p.newPrice}₽</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
