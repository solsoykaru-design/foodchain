import { useState, useEffect } from 'react';
import { FolderTree, Plus, Edit3, Trash2, X } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

export default function StockCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [modalName, setModalName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getStockCategories();
      setCategories(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setModalName('');
    setShowModal(true);
  };

  const openEdit = () => {
    const cat = categories.find(c => c.id === selectedId);
    if (!cat) return;
    setEditId(cat.id);
    setModalName(cat.name);
    setShowModal(true);
  };

  const save = async () => {
    if (!modalName.trim()) return addToast('Введите название категории', 'error');
    try {
      if (editId) await api.updateStockCategory(editId, { name: modalName.trim() });
      else await api.createStockCategory({ name: modalName.trim() });
      setShowModal(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async () => {
    if (selectedId === null) return;
    if (!confirm('Удалить категорию?')) return;
    try {
      await api.deleteStockCategory(selectedId);
      setSelectedId(null);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <FolderTree size={22} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Категории</h1>
          <p className="text-sm text-zinc-500">Категории складских элементов</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-[0.97] transition-all">
          <Plus size={18} /> Добавить категорию
        </button>
        <button onClick={openEdit} disabled={selectedId === null} className="flex items-center gap-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none">
          <Edit3 size={16} /> Редактировать
        </button>
        <button onClick={remove} disabled={selectedId === null} className="flex items-center gap-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none">
          <Trash2 size={16} /> Удалить
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Загрузка...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Название</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Количество элементов</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat: any) => (
                  <tr key={cat.id}
                    onClick={() => setSelectedId(cat.id === selectedId ? null : cat.id)}
                    className={`border-b border-zinc-100 dark:border-zinc-800 cursor-pointer transition-colors ${selectedId === cat.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-right tabular-nums">{cat.count}</td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr><td colSpan={2} className="text-center py-12 text-zinc-400">Нет категорий</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-right text-sm text-zinc-500">
            Всего категорий: {categories.length}
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editId ? 'Редактировать категорию' : 'Добавить категорию'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Название категории</label>
                <input value={modalName} onChange={e => setModalName(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') save(); }}
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