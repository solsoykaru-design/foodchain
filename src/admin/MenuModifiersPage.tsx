import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Cog, Plus, Pencil, Trash2, X } from 'lucide-react';

export default function MenuModifiersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', price: 0, group_id: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [mods, grps] = await Promise.all([
        api.request('/api/modifiers'),
        api.request('/api/modifier-groups'),
      ]);
      setItems(mods);
      setGroups(grps);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', price: 0, group_id: 0 });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditId(item.id);
    setForm({ name: item.name, price: item.price || 0, group_id: item.groupId || item.group_id || 0 });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return addToast('Введите название модификатора', 'error');
    try {
      const payload = { ...form, group_id: form.group_id || undefined };
      if (editId) await api.request(`/api/modifiers/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await api.request('/api/modifiers', { method: 'POST', body: JSON.stringify(payload) });
      setShowModal(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить модификатор?')) return;
    try {
      await api.request(`/api/modifiers/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const groupMap = groups.reduce((acc: any, g: any) => { acc[g.id] = g.name; return acc; }, {} as Record<number, string>);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
          <Cog size={22} className="text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Общие модификаторы</h1>
          <p className="text-sm text-zinc-500">Управление модификаторами блюд</p>
        </div>
      </div>

      <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-[0.97] transition-all mb-5">
        <Plus size={18} /> Добавить модификатор
      </button>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Загрузка...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Название</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Цена</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Группа</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{item.price}₽</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{groupMap[item.groupId || item.group_id] || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><Pencil size={15} /></button>
                      <button onClick={() => remove(item.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-zinc-400">Нет модификаторов</td></tr>
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
                {editId ? 'Редактировать модификатор' : 'Добавить модификатор'}
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
                <label className="text-xs font-medium text-zinc-500">Цена</label>
                <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Группа</label>
                <select value={form.group_id} onChange={e => setForm({...form, group_id: Number(e.target.value)})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1">
                  <option value={0}>Без группы</option>
                  {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
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
