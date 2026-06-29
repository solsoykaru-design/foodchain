import { useEffect, useState } from 'react';
import * as api from '../api';
import { Plus, Search, Check, Trash2, X, PackageSearch } from 'lucide-react';
import { addToast } from '../ToastContext';

export default function InventoryCountsPage() {
  const [counts, setCounts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [allItems, setAllItems] = useState<any[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const load = async () => {
    setLoading(true);
    try { setCounts(await api.request('/api/inventory-counts')); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const loadItems = async () => {
    try { const r = await api.request('/api/inventory-items?limit=1000'); setAllItems(r.items || []); } catch {}
  };
  useEffect(() => { loadItems(); }, []);

  const openCount = async (id: number) => {
    try { setSelected(await api.request(`/api/inventory-counts/${id}`)); } catch {}
  };

  const create = async () => {
    try {
      await api.request('/api/inventory-counts', {
        method: 'POST',
        body: JSON.stringify({ itemIds: selectedItemIds }),
      });
      addToast('Акт пересчёта создан', 'success');
      setShowCreate(false);
      setSelectedItemIds([]);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const updateActual = async (countId: number, itemRowId: number, actual: number) => {
    try {
      await api.request(`/api/inventory-counts/${countId}/items/${itemRowId}`, { method: 'PUT', body: JSON.stringify({ actualQuantity: actual }) });
      openCount(countId);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const apply = async (id: number) => {
    try {
      await api.request(`/api/inventory-counts/${id}/apply`, { method: 'POST' });
      addToast('Акт проведён, остатки скорректированы', 'success');
      load(); openCount(id);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить акт?')) return;
    try {
      await api.request(`/api/inventory-counts/${id}`, { method: 'DELETE' });
      addToast('Акт удалён', 'success');
      load(); setSelected(null);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const filteredItems = allItems.filter((i: any) => i.name?.toLowerCase().includes(itemSearch.toLowerCase()) || i.barcode?.includes(itemSearch)).slice(0, 50);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><PackageSearch /> Акты пересчёта</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2"><Plus size={18} /> Создать акт</button>
      </div>
      {loading && <p>Загрузка...</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {counts.map(c => (
            <div key={c.id} onClick={() => openCount(c.id)} className={`p-3 rounded-xl border cursor-pointer transition ${selected?.id === c.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
              <div className="flex justify-between items-center"><span className="font-bold">#{c.id}</span><span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'applied' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-700'}`}>{c.status === 'applied' ? 'Проведён' : 'Черновик'}</span></div>
              <p className="text-xs opacity-70">{c.itemsCount || 0} поз. · {new Date(c.createdAt).toLocaleString('ru-RU')}</p>
            </div>
          ))}
        </div>
        {selected && (
          <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">Акт #{selected.id}</h2>
              <div className="flex gap-2">
                {selected.status !== 'applied' && <button onClick={() => apply(selected.id)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"><Check size={14} /> Провести</button>}
                {selected.status !== 'applied' && <button onClick={() => remove(selected.id)} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg flex items-center gap-1"><Trash2 size={14} /> Удалить</button>}
                <button onClick={() => setSelected(null)} className="p-1"><X size={18} /></button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {selected.items?.map((row: any) => (
                <div key={row.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                  <div>
                    <p className="text-sm font-semibold">{row.itemName}</p>
                    <p className="text-xs opacity-70">Ожидалось: {row.expectedQuantity} {row.unit}</p>
                  </div>
                  {selected.status === 'applied' ? (
                    <div className="text-sm font-bold">{row.actualQuantity} {row.unit} <span className={`text-xs ${row.difference > 0 ? 'text-green-500' : row.difference < 0 ? 'text-red-500' : ''}`}>({row.difference > 0 ? '+' : ''}{row.difference})</span></div>
                  ) : (
                    <input type="number" defaultValue={row.actualQuantity ?? row.expectedQuantity} onBlur={e => updateActual(selected.id, row.id, Number(e.target.value))} className="w-24 px-2 py-1 rounded border dark:bg-zinc-900 dark:border-zinc-700 text-sm" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-3">Создать акт пересчёта</h2>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
              <input type="text" value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Поиск по названию или штрихкоду" className="w-full pl-9 pr-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 mb-3">
              {filteredItems.map((i: any) => (
                <label key={i.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                  <input type="checkbox" checked={selectedItemIds.includes(i.id)} onChange={e => setSelectedItemIds(prev => e.target.checked ? [...prev, i.id] : prev.filter(id => id !== i.id))} />
                  <span className="text-sm">{i.name} · {i.currentBalance || i.currentStock || 0} {i.unit}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 font-semibold">Отмена</button>
              <button onClick={create} disabled={selectedItemIds.length === 0} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">Создать ({selectedItemIds.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
