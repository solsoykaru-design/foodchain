import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { FolderTree, Plus, X, Edit3, Trash2, ChevronDown, ChevronRight, Image as ImageIcon, Upload } from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', icon: '📁', parent_id: 0, image_url: '' });
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploadFile(file);
      setForm({...form, image_url: url});
    } catch (err: any) { addToast(err.message, 'error'); }
    finally { setUploading(false); }
  };

  const load = async () => {
    try {
      const data = await api.getMenuCategories();
      setCategories(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = (parentId = 0) => {
    setEditId(null);
    setForm({ name: '', icon: '📁', parent_id: parentId, image_url: '' });
    setShowForm(true);
  };

  const openEdit = (cat: any) => {
    setEditId(cat.id);
    setForm({ name: cat.name, icon: cat.icon || '📁', parent_id: cat.parentId || 0, image_url: cat.imageUrl || '' });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name) return addToast('Введите название категории', 'error');
    try {
      if (editId) await api.updateMenuCategory(editId, form);
      else await api.createMenuCategory(form);
      setShowForm(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить категорию?')) return;
    try { await api.deleteMenuCategory(id); load(); } catch (e: any) { addToast(e.message, 'error'); }
  };

  const rootCategories = categories.filter(c => !c.parentId);
  const childrenOf = (parentId: number) => categories.filter(c => c.parentId === parentId);

  const renderTree = (parentId: number | null, depth = 0) => {
    const items = parentId === null ? rootCategories : childrenOf(parentId);
    if (items.length === 0) return null;
    return (
      <div className={depth > 0 ? 'ml-6 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700' : ''}>
        {items.map(cat => {
          const hasChildren = childrenOf(cat.id).length > 0;
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group transition-colors">
                {cat.imageUrl ? <img src={cat.imageUrl} className="w-8 h-8 rounded-lg object-cover" alt="" /> : <span className="text-lg">{cat.icon || '📁'}</span>}
                <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-white">{cat.name}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openAdd(cat.id)} className="p-1 text-zinc-400 hover:text-blue-500 rounded-lg active:scale-[0.97]" title="Добавить подкатегорию"><Plus size={14} /></button>
                  <button onClick={() => openEdit(cat)} className="p-1 text-zinc-400 hover:text-blue-500 rounded-lg active:scale-[0.97]"><Edit3 size={14} /></button>
                  <button onClick={() => remove(cat.id)} className="p-1 text-zinc-400 hover:text-red-500 rounded-lg active:scale-[0.97]"><Trash2 size={14} /></button>
                </div>
              </div>
              {hasChildren && renderTree(cat.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Категории блюд</h2>
          <p className="text-sm text-zinc-500 mt-1">{categories.length} категорий</p>
        </div>
        <button onClick={() => openAdd(0)}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600 active:scale-[0.97] transition-all">
          <Plus size={18} /> Добавить
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Загрузка...</div>
      ) : categories.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
          <FolderTree size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
          <p className="text-zinc-500">Нет категорий</p>
          <p className="text-sm text-zinc-400 mt-1">Создайте первую категорию блюд</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          {renderTree(null)}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{editId ? 'Редактировать' : 'Новая'} категория</h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Название</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Иконка (emoji)</label>
                <input value={form.icon} onChange={e => setForm({...form, icon: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Фото категории</label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 rounded-xl cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all">
                    <Upload size={16} className="text-zinc-500" />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{uploading ? 'Загрузка...' : 'Выбрать файл'}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {form.image_url && <img src={form.image_url} className="w-10 h-10 rounded-lg object-cover" alt="" />}
                </div>
              </div>
              {!editId && (
                <div>
                  <label className="text-xs font-medium text-zinc-500">Родительская категория</label>
                  <select value={form.parent_id} onChange={e => setForm({...form, parent_id: Number(e.target.value)})}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1">
                    <option value={0}>Корневая категория</option>
                    {categories.filter(c => c.id !== editId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <button onClick={save}
                className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97] transition-all">
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
