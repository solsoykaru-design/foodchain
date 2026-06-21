import { useState, useEffect } from 'react';
import * as api from '../api';
import { FolderTree, Plus, X, Edit3, Trash2, ChevronUp, ChevronDown, Search, Image as ImageIcon, Upload, RefreshCw } from 'lucide-react';
import Lightbox from './Lightbox';
import { addToast } from '../ToastContext';

interface Category {
  id: number; name: string; icon?: string; parentId?: number;
  sortOrder: number; imageUrl?: string; dishCount: number; parentName?: string;
  showOnSite: boolean; showOnApp: boolean; showOnKiosk: boolean; showOnWaiter: boolean; showOnAggregators: boolean;
}

type SortDir = 'asc' | 'desc';

const CHANNELS = [
  { key: 'showOnSite', label: 'Сайт', title: 'Отображать на сайте' },
  { key: 'showOnApp', label: 'Приложение', title: 'Отображать в приложении' },
  { key: 'showOnKiosk', label: 'Киоск', title: 'Отображать в киоске' },
  { key: 'showOnWaiter', label: 'Официант', title: 'Отображать у официанта' },
  { key: 'showOnAggregators', label: 'Агрегаторы', title: 'Отображать в агрегаторах' },
] as const;

const COLUMNS: { key: string; label: string; sortable: boolean; center?: boolean }[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'imageUrl', label: 'Изображение', sortable: false, center: true },
  { key: 'parentName', label: 'Родительская', sortable: false },
  { key: 'sortOrder', label: 'Позиция', sortable: true },
  { key: 'dishCount', label: 'Блюд', sortable: true },
];

export default function MenuCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', icon: '📁', parent_id: 0, sort_order: 0, image_url: '' });
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const load = async () => {
    try {
      const data = await api.getMenuCategories();
      const enriched = data.map((c: any) => {
        const parent = data.find((p: any) => p.id === c.parentId);
        return { ...c, parentName: parent?.name || '' };
      });
      setCategories(enriched);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => { setPage(1); }, [search]);

  const openAdd = (parentId = 0) => {
    setEditId(null);
    const maxSort = categories.filter(c => c.parentId === (parentId || null) || (!parentId && !c.parentId)).length;
    setForm({ name: '', icon: '📁', parent_id: parentId, sort_order: maxSort + 1, image_url: '' });
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditId(cat.id);
    setForm({
      name: cat.name, icon: cat.icon || '📁',
      parent_id: cat.parentId || 0, sort_order: cat.sortOrder || 0,
      image_url: cat.imageUrl || ''
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return addToast('Введите название категории', 'error');
    try {
      if (editId) await api.updateMenuCategory(editId, form);
      else await api.createMenuCategory(form);
      setShowForm(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number, name: string) => {
    if (!confirm(`Удалить категорию «${name}»? Блюда будут перемещены в корень.`)) return;
    try { await api.deleteMenuCategory(id); load(); } catch (e: any) { addToast(e.message, 'error'); }
  };

  const toggleVisibility = async (catId: number, field: string, value: boolean) => {
    try {
      await api.updateMenuCategoryVisibility(catId, { [field]: value });
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, [field]: value } : c));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const setAllVisibility = async (field: string, value: boolean) => {
    try {
      const ids = categories.map(c => c.id);
      await api.batchUpdateMenuCategoryVisibility(ids, { [field]: value });
      setCategories(prev => prev.map(c => ({ ...c, [field]: value })));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const { url } = await api.uploadFile(file); setForm({ ...form, image_url: url }); }
    catch (err: any) { addToast(err.message, 'error'); }
    finally { setUploading(false); }
  };

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const filtered = categories.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortBy as keyof Category];
    const bVal = b[sortBy as keyof Category];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const totalPages = Math.ceil(sorted.length / limit);
  const paged = sorted.slice((page - 1) * limit, page * limit);
  const totalDishes = categories.reduce((sum, c) => sum + (c.dishCount || 0), 0);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ChevronUp size={10} className="inline ml-1 text-zinc-300 dark:text-zinc-600" />;
    return sortOrder === 'asc'
      ? <ChevronUp size={12} className="inline ml-1 text-blue-500" />
      : <ChevronDown size={12} className="inline ml-1 text-blue-500" />;
  };

  const headClass = "px-3 py-2.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-left select-none border-r border-zinc-100 dark:border-zinc-800 last:border-r-0";
  const cellClass = "px-3 py-2.5 text-sm border-r border-zinc-100 dark:border-zinc-800 last:border-r-0";
  const fld = "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30";
  const lbl = "text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 block";
  const filterInput = "w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30";

  return (
    <div className="space-y-3 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Категории меню</h2>
          <p className="text-sm text-zinc-500 mt-1">{categories.length} категорий · {totalDishes} блюд</p>
          <p className="text-xs text-zinc-400 mt-0.5">Управление видимостью категорий на разных каналах</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative min-w-[200px]">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск категорий..."
              className={`${filterInput} pl-8`} />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><X size={13} /></button>}
          </div>
          <button onClick={() => openAdd(0)}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl font-semibold text-xs hover:bg-blue-600 active:scale-[0.97] transition-all">
            <Plus size={16} /> Добавить категорию
          </button>
        </div>
      </div>

      {/* Quick actions row */}
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition active:scale-[0.97]" title="Обновить">
          <RefreshCw size={15} />
        </button>
        <span className="text-[11px] text-zinc-400">{filtered.length} из {categories.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200/60 dark:border-zinc-800 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : paged.length === 0 ? (
          <div className="py-16 text-center">
            <FolderTree size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Нет категорий</p>
            <p className="text-sm text-zinc-400 mt-1">Создайте первую категорию блюд</p>
          </div>
        ) : (
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                {COLUMNS.map(col => (
                  <th key={col.key} className={`${headClass} ${col.center ? 'text-center' : ''} ${col.sortable ? 'cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}>
                    <span className="inline-flex items-center">
                      {col.label}
                      <SortIcon column={col.key} />
                    </span>
                  </th>
                ))}
                {CHANNELS.map(ch => (
                  <th key={ch.key} className={`${headClass} text-center`} title={ch.title}>
                    <button onClick={() => setAllVisibility(ch.key, categories.every(c => !c[ch.key as keyof Category]))}
                      className="underline decoration-dotted hover:text-blue-500 transition" title="Переключить для всех">
                      {ch.label}
                    </button>
                  </th>
                ))}
                <th className={`${headClass} text-right`}>Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paged.map(cat => (
                <tr key={cat.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer ${selectedId === cat.id ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                  onClick={() => setSelectedId(cat.id)}>
                  <td className={`${cellClass} font-medium text-zinc-900 dark:text-white`}>
                    <span className="inline-flex items-center gap-1.5">{cat.icon || '📁'} {cat.name}</span>
                  </td>
                  <td className={`${cellClass} text-center`}>
                    {cat.imageUrl ? (
                      <button onClick={e => { e.stopPropagation(); setLightbox(cat.imageUrl || null); }}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer">
                        <img src={cat.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover border border-zinc-200 dark:border-zinc-700" />
                      </button>
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 inline-flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                        <ImageIcon size={13} className="text-zinc-400" />
                      </div>
                    )}
                  </td>
                  <td className={`${cellClass} text-zinc-600 dark:text-zinc-400 text-[13px]`}>{cat.parentName || '—'}</td>
                  <td className={`${cellClass} text-zinc-700 dark:text-zinc-300 text-[13px]`}>{cat.sortOrder}</td>
                  <td className={`${cellClass} text-zinc-700 dark:text-zinc-300 text-[13px]`}
                    onClick={e => e.stopPropagation()}>
                    <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-xs">{cat.dishCount || 0}</span>
                  </td>
                  {CHANNELS.map(ch => (
                    <td key={ch.key} className={`${cellClass} text-center`} onClick={e => e.stopPropagation()} title={ch.title}>
                      <button onClick={() => toggleVisibility(cat.id, ch.key, !cat[ch.key as keyof Category])}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          cat[ch.key as keyof Category] ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                        }`}>
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${
                          cat[ch.key as keyof Category] ? 'translate-x-[18px]' : 'translate-x-[3px]'
                        }`} />
                      </button>
                    </td>
                  ))}
                  <td className={`${cellClass} text-right`} onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {!cat.parentId && (
                        <button onClick={() => openAdd(cat.id)}
                          className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition active:scale-[0.97]" title="Добавить подкатегорию">
                          <Plus size={14} />
                        </button>
                      )}
                      <button onClick={() => openEdit(cat)}
                        className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition active:scale-[0.97]" title="Редактировать">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => remove(cat.id, cat.name)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition active:scale-[0.97]" title="Удалить">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(1)} disabled={page <= 1}
              className="text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 text-zinc-600 dark:text-zinc-400 px-2.5 py-1.5 rounded-lg font-semibold transition active:scale-[0.97]">Первая</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 text-zinc-600 dark:text-zinc-400 px-2.5 py-1.5 rounded-lg font-semibold transition active:scale-[0.97]">←</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages || p < 1) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`text-[11px] w-7 h-7 rounded-lg font-semibold transition active:scale-[0.97] ${p === page ? 'bg-amber-400 text-white shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 text-zinc-600 dark:text-zinc-400 px-2.5 py-1.5 rounded-lg font-semibold transition active:scale-[0.97]">→</button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
              className="text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 text-zinc-600 dark:text-zinc-400 px-2.5 py-1.5 rounded-lg font-semibold transition active:scale-[0.97]">Последняя</button>
          </div>
          <span className="text-[11px] text-zinc-400">Страница {page} из {totalPages}</span>
        </div>
      )}

      {/* Edit/Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{editId ? 'Редактировать' : 'Новая'} категория</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={lbl}>Название</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fld} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Иконка (emoji)</label>
                  <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className={fld} />
                </div>
                <div>
                  <label className={lbl}>Порядок сортировки</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className={fld} />
                </div>
              </div>
              <div>
                <label className={lbl}>Фото категории</label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-lg cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all text-sm text-zinc-600 dark:text-zinc-400">
                    <Upload size={16} />
                    {uploading ? 'Загрузка...' : 'Выбрать файл'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {form.image_url && <img src={form.image_url} className="w-10 h-10 rounded-lg object-cover" alt="" />}
                </div>
              </div>
              {!editId && (
                <div>
                  <label className={lbl}>Родительская категория</label>
                  <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: Number(e.target.value) })} className={fld}>
                    <option value={0}>Корневая категория</option>
                    {categories.filter(c => !c.parentId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button onClick={save}
                className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg text-sm hover:bg-blue-600 active:scale-[0.97] transition-all">
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
