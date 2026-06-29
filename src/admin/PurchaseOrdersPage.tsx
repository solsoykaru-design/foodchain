import { useEffect, useState } from 'react';
import * as api from '../api';
import { Plus, Search, Check, Trash2, X, ShoppingCart } from 'lucide-react';
import { addToast } from '../ToastContext';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<{ itemId: number; quantity: number; pricePerUnit: number; unit: string }[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    try { setOrders(await api.request('/api/purchase-orders')); } catch {}
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.request('/api/suppliers').then(r => setSuppliers(Array.isArray(r) ? r : [])).catch(() => {});
    api.request('/api/inventory-items?limit=1000').then(r => setItems(r.items || [])).catch(() => {});
  }, []);

  const open = async (id: number) => {
    try { setSelected(await api.request(`/api/purchase-orders/${id}`)); } catch {}
  };

  const addRow = (item: any) => {
    if (rows.find(r => r.itemId === item.id)) return;
    setRows(prev => [...prev, { itemId: item.id, quantity: 1, pricePerUnit: item.lastPrice || item.pricePerUnit || 0, unit: item.unit || 'шт' }]);
  };

  const updateRow = (idx: number, field: string, value: any) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const create = async () => {
    try {
      await api.request('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({ supplierId: Number(supplierId), note, expectedDelivery, items: rows }),
      });
      addToast('Заказ поставщику создан', 'success');
      setShowCreate(false);
      setRows([]); setSupplierId(''); setNote(''); setExpectedDelivery('');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const receive = async (id: number) => {
    try {
      const order = await api.request(`/api/purchase-orders/${id}`);
      const receivedItems = order.items.map((i: any) => ({ itemId: i.itemId, quantity: i.quantity - (i.receivedQuantity || 0) })).filter((i: any) => i.quantity > 0);
      if (receivedItems.length === 0) return addToast('Все позиции уже приняты', 'info');
      await api.request(`/api/purchase-orders/${id}/receive`, { method: 'POST', body: JSON.stringify({ receivedItems }) });
      addToast('Приёмка проведена', 'success');
      load(); open(id);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить заказ?')) return;
    try { await api.request(`/api/purchase-orders/${id}`, { method: 'DELETE' }); addToast('Заказ удалён', 'success'); load(); setSelected(null); } catch (e: any) { addToast(e.message, 'error'); }
  };

  const filteredItems = items.filter((i: any) => i.name?.toLowerCase().includes(search.toLowerCase()) || i.barcode?.includes(search)).slice(0, 30);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart /> Заказы поставщикам</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2"><Plus size={18} /> Создать заказ</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} onClick={() => open(o.id)} className={`p-3 rounded-xl border cursor-pointer transition ${selected?.id === o.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
              <div className="flex justify-between items-center"><span className="font-bold">#{o.id}</span><span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-700'}`}>{o.status === 'received' ? 'Принят' : 'Черновик'}</span></div>
              <p className="text-xs opacity-70">{o.supplierName || 'Без поставщика'} · {o.itemsCount || 0} поз. · {o.total?.toFixed(2)}₽</p>
            </div>
          ))}
        </div>
        {selected && (
          <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">Заказ #{selected.id}</h2>
              <div className="flex gap-2">
                {selected.status !== 'received' && <button onClick={() => receive(selected.id)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"><Check size={14} /> Принять</button>}
                {selected.status !== 'received' && <button onClick={() => remove(selected.id)} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg flex items-center gap-1"><Trash2 size={14} /> Удалить</button>}
                <button onClick={() => setSelected(null)} className="p-1"><X size={18} /></button>
              </div>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {selected.items?.map((row: any) => (
                <div key={row.id} className="flex justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-sm">
                  <span>{row.itemName}</span>
                  <span className="font-semibold">{row.quantity} {row.unit} × {row.pricePerUnit}₽ = {row.total?.toFixed(2)}₽ {row.receivedQuantity > 0 && <span className="text-green-500 text-xs">(принято {row.receivedQuantity})</span>}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 font-bold text-right">Итого: {selected.total?.toFixed(2)}₽</p>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-3">Новый заказ поставщику</h2>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700">
              <option value="">Выберите поставщика</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Примечание" className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Добавить товар" className="w-full pl-9 pr-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            </div>
            {search && (
              <div className="max-h-32 overflow-y-auto border rounded-xl mb-3 dark:border-zinc-700">
                {filteredItems.map((i: any) => (
                  <button key={i.id} onClick={() => addRow(i)} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">{i.name} · {i.unit}</button>
                ))}
              </div>
            )}
            <div className="space-y-2 mb-3">
              {rows.map((r, idx) => {
                const item = items.find((i: any) => i.id === r.itemId);
                return (
                  <div key={idx} className="flex gap-2 items-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                    <span className="flex-1 text-sm">{item?.name}</span>
                    <input type="number" value={r.quantity} onChange={e => updateRow(idx, 'quantity', Number(e.target.value))} className="w-20 px-2 py-1 rounded border dark:bg-zinc-900 dark:border-zinc-700 text-sm" />
                    <input type="number" value={r.pricePerUnit} onChange={e => updateRow(idx, 'pricePerUnit', Number(e.target.value))} className="w-24 px-2 py-1 rounded border dark:bg-zinc-900 dark:border-zinc-700 text-sm" />
                    <span className="text-xs">{r.unit}</span>
                    <button onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))} className="text-red-500"><X size={16} /></button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 font-semibold">Отмена</button>
              <button onClick={create} disabled={!supplierId || rows.length === 0} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
