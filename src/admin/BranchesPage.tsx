import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Building2, Plus, Pencil, Trash2, X } from 'lucide-react';

export default function BranchesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.request('/api/branches');
      setItems(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', address: '', phone: '' });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditId(item.id);
    setForm({ name: item.name, address: item.address || '', phone: item.phone || '' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return addToast('Введите название филиала', 'error');
    try {
      if (editId) {
        await api.request(`/api/branches/${editId}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await api.request('/api/branches', { method: 'POST', body: JSON.stringify({ ...form, tenant_id: 1 }) });
      }
      setShowModal(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить филиал?')) return;
    try {
      await api.request(`/api/branches/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
          <Building2 size={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Филиалы</h1>
          <p className="text-sm text-zinc-500">Управление филиалами</p>
        </div>
      </div>

      <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-[0.97] transition-all mb-5">
        <Plus size={18} /> Добавить филиал
      </button>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Загрузка...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Название</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Адрес</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Телефон</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{item.address}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{item.phone}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><Pencil size={15} /></button>
                      <button onClick={() => remove(item.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-zinc-400">Нет филиалов</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editId ? 'Редактировать филиал' : 'Добавить филиал'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Название</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Адрес</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Телефон</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <button onClick={save}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-700 active:scale-[0.97] transition-all">
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
