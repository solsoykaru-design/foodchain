import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { PackageSearch, Plus, Pencil, Trash2, X, Check, ToggleLeft } from 'lucide-react';

export default function MenuStopListsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ item_name: '', reason: '', until_date: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.request('/api/stop-lists');
      setItems(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ item_name: '', reason: '', until_date: '' });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditId(item.id);
    setForm({
      item_name: item.itemName || item.item_name || '',
      reason: item.reason || '',
      until_date: item.untilDate || item.until_date || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.item_name.trim()) return addToast('Введите название позиции', 'error');
    try {
      if (editId) await api.request(`/api/stop-lists/${editId}`, { method: 'PUT', body: JSON.stringify(form) });
      else await api.request('/api/stop-lists', { method: 'POST', body: JSON.stringify(form) });
      setShowModal(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить позицию из стоп-листа?')) return;
    try {
      await api.request(`/api/stop-lists/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const toggleActive = async (item: any) => {
    try {
      const id = item.id;
      const current = item.isActive ?? item.is_active ?? true;
      await api.request(`/api/stop-lists/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: !current }) });
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
          <PackageSearch size={22} className="text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Стоп-листы</h1>
          <p className="text-sm text-zinc-500">Управление стоп-листами блюд и продуктов</p>
        </div>
      </div>

      <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-[0.97] transition-all mb-5">
        <Plus size={18} /> Добавить в стоп-лист
      </button>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Загрузка...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Позиция</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Причина</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">До даты</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Активен</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => {
                const isActive = item.isActive ?? item.is_active ?? true;
                return (
                  <tr key={item.id} className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${!isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium">{item.itemName || item.item_name}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-xs truncate">{item.reason || '—'}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-nowrap">
                      {item.untilDate || item.until_date ? new Date(item.untilDate || item.until_date).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${
                          isActive
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}>
                        {isActive ? <Check size={12} /> : <ToggleLeft size={12} />}
                        {isActive ? 'Да' : 'Нет'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><Pencil size={15} /></button>
                        <button onClick={() => remove(item.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-zinc-400">Стоп-лист пуст</td></tr>
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
                {editId ? 'Редактировать позицию' : 'Добавить в стоп-лист'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Название позиции</label>
                <input value={form.item_name} onChange={e => setForm({...form, item_name: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Причина</label>
                <input value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Действителен до</label>
                <input type="date" value={form.until_date} onChange={e => setForm({...form, until_date: e.target.value})}
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
