import { useEffect, useState } from 'react';
import * as api from '../api';
import { Plus, Check, Trash2, X, Hammer } from 'lucide-react';
import { addToast } from '../ToastContext';

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [techCards, setTechCards] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [techCardId, setTechCardId] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState(1);
  const [plannedAt, setPlannedAt] = useState('');
  const [note, setNote] = useState('');

  const load = async () => { try { setOrders(await api.request('/api/production-orders')); } catch {} };
  useEffect(() => { load(); }, []);
  useEffect(() => { api.request('/api/tech-cards').then(r => setTechCards(Array.isArray(r) ? r : [])).catch(() => {}); }, []);

  const open = async (id: number) => { try { setSelected(await api.request(`/api/production-orders/${id}`)); } catch {} };

  const create = async () => {
    try {
      await api.request('/api/production-orders', {
        method: 'POST',
        body: JSON.stringify({ name, techCardId: Number(techCardId), plannedQuantity, plannedAt, note }),
      });
      addToast('Задание создано', 'success');
      setShowCreate(false);
      setName(''); setTechCardId(''); setPlannedQuantity(1); setPlannedAt(''); setNote('');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const complete = async (id: number) => {
    try {
      await api.request(`/api/production-orders/${id}/complete`, { method: 'POST', body: JSON.stringify({}) });
      addToast('Производство выполнено, ингредиенты списаны', 'success');
      load(); open(id);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить задание?')) return;
    try { await api.request(`/api/production-orders/${id}`, { method: 'DELETE' }); addToast('Задание удалено', 'success'); load(); setSelected(null); } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Hammer /> Производственные задания</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2"><Plus size={18} /> Новое задание</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} onClick={() => open(o.id)} className={`p-3 rounded-xl border cursor-pointer transition ${selected?.id === o.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
              <div className="flex justify-between items-center"><span className="font-bold">#{o.id} {o.name || o.techCardName}</span><span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-700'}`}>{o.status === 'completed' ? 'Выполнено' : 'Запланировано'}</span></div>
              <p className="text-xs opacity-70">{o.itemsCount || 0} ингр. · {o.plannedQuantity} шт. · {o.plannedAt ? new Date(o.plannedAt).toLocaleDateString('ru-RU') : '—'}</p>
            </div>
          ))}
        </div>
        {selected && (
          <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">Задание #{selected.id}</h2>
              <div className="flex gap-2">
                {selected.status !== 'completed' && <button onClick={() => complete(selected.id)} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"><Check size={14} /> Выполнить</button>}
                {selected.status !== 'completed' && <button onClick={() => remove(selected.id)} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg flex items-center gap-1"><Trash2 size={14} /> Удалить</button>}
                <button onClick={() => setSelected(null)} className="p-1"><X size={18} /></button>
              </div>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {selected.items?.map((row: any) => (
                <div key={row.id} className={`flex justify-between p-2 rounded-lg text-sm ${row.stock < row.requiredQuantity ? 'bg-red-50 dark:bg-red-900/20' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
                  <span>{row.itemName}</span>
                  <span className="font-semibold">{row.requiredQuantity} {row.unit} <span className="text-xs opacity-70">(ост. {row.stock})</span></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-3">Новое производственное задание</h2>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Название" className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            <select value={techCardId} onChange={e => setTechCardId(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700">
              <option value="">Выберите техкарту</option>
              {techCards.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input type="number" value={plannedQuantity} onChange={e => setPlannedQuantity(Number(e.target.value))} placeholder="Количество" className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            <input type="date" value={plannedAt} onChange={e => setPlannedAt(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Примечание" className="w-full mb-3 px-3 py-2 rounded-xl border dark:bg-zinc-800 dark:border-zinc-700" />
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 font-semibold">Отмена</button>
              <button onClick={create} disabled={!techCardId || plannedQuantity <= 0} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
