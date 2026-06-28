import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { Search, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, Image as ImageIcon, FolderPlus, Edit3, FolderOpen } from 'lucide-react';
import CategoryItemsModal from './CategoryItemsModal';
import TechCardModal from './TechCardModal';
import Lightbox from './Lightbox';
import { addToast } from '../ToastContext';

interface Dish {
  id: number; name: string; description: string; price: number;
  categoryId: number; categoryName?: string; imageUrl: string;
  weight: number; calories: number; proteins: number; fats: number; carbs: number;
  isAvailable: boolean; isPopular: boolean; ingredients?: string;
  techCardId?: number | null;
  stationId?: number | null;
  stationName?: string;
}

interface Station {
  id: number; name: string; color?: string;
}

interface CatNode {
  id: number; name: string; icon?: string; parentId?: number;
  sortOrder: number; imageUrl?: string; tenantId: number;
  dishCount: number; children: CatNode[];
}

const emptyDish = {
  name: '', description: '', price: 0, categoryId: 0, imageUrl: '',
  weight: 0, calories: 0, proteins: 0, fats: 0, carbs: 0,
  isAvailable: true, isPopular: false, ingredients: '', stationId: null,
};

function findPath(tree: CatNode[], targetId: number): CatNode[] {
  for (const n of tree) {
    if (n.id === targetId) return [n];
    const found = findPath(n.children, targetId);
    if (found.length) return [n, ...found];
  }
  return [];
}

export default function MenuPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [catTree, setCatTree] = useState<CatNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState<Station[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [includeSubcats, setIncludeSubcats] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [form, setForm] = useState<Dish>(emptyDish as Dish);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<CatNode | null>(null);
  const [catForm, setCatForm] = useState({ name: '', parentId: 0 });
  const [itemsModal, setItemsModal] = useState<{ id: number; name: string } | null>(null);
  const [techCardModal, setTechCardModal] = useState<{ id: number; name: string } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, tree, s] = await Promise.all([
        api.getDishes(selectedCatId || undefined, includeSubcats).catch(() => []),
        api.getMenuCategories(true).catch(() => []),
        api.getStations().catch(() => []),
      ]);
      setDishes(d);
      setCatTree(tree);
      setStations(s);
    } finally { setLoading(false); }
  }, [selectedCatId, includeSubcats]);

  useEffect(() => { load(); }, [load]);

  const filtered = dishes.filter(d => {
    return !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase());
  });

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const breadcrumbs = findPath(catTree, selectedCatId || 0);

  const openAddDish = () => {
    setEditing(null);
    setForm({ ...emptyDish, categoryId: selectedCatId || 0 } as Dish);
    setImageBase64(null);
    setShowForm(true);
  };

  const openEditDish = (dish: Dish) => {
    setEditing(dish);
    setForm({ ...dish });
    setImageBase64(null);
    setShowForm(true);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setImageBase64(b64);
      setForm(prev => ({ ...prev, imageUrl: b64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDish = async () => {
    if (!form.name) { addToast('Введите название блюда', 'warning'); return; }
    setSaving(true);
    try {
      let imageUrl = form.imageUrl;
      if (imageBase64) {
        try {
          const uploaded = await api.uploadImage(imageBase64, 'dishes');
          imageUrl = uploaded.url;
        } catch {}
      }
      const payload = { ...form, imageUrl, stationId: form.stationId || null };
      if (editing) {
        await api.updateDish(editing.id, payload);
      } else {
        await api.createDish(payload);
      }
      setShowForm(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteDish = async (id: number, name: string) => {
    if (!confirm(`Удалить блюдо "${name}"?`)) return;
    try {
      await api.deleteDish(id);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const openAddCat = () => {
    setEditingCat(null);
    setCatForm({ name: '', parentId: selectedCatId || 0 });
    setShowCatForm(true);
  };

  const openEditCat = (cat: CatNode) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, parentId: cat.parentId || 0 });
    setShowCatForm(true);
  };

  const handleSaveCat = async () => {
    if (!catForm.name) { addToast('Введите название категории', 'warning'); return; }
    try {
      if (editingCat) {
        await api.updateMenuCategory(editingCat.id, catForm);
      } else {
        await api.createMenuCategory(catForm);
      }
      setShowCatForm(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleDeleteCat = async (id: number, name: string) => {
    if (!confirm(`Удалить категорию "${name}"? Дочерние категории перейдут к родительской.`)) return;
    try {
      await api.deleteMenuCategory(id);
      if (selectedCatId === id) setSelectedCatId(null);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const renderTree = (nodes: CatNode[], depth = 0) => {
    return nodes.map(node => {
      const kids = node.children || [];
      const hasChildren = kids.length > 0;
      const isExpanded = expandedIds.has(node.id);
      const isSelected = selectedCatId === node.id;
      return (
        <div key={node.id}>
          <div
            onClick={() => { setSelectedCatId(node.id); if (hasChildren) toggleExpand(node.id); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors group ${
              isSelected
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={14} className="shrink-0 text-zinc-400" /> : <ChevronRight size={14} className="shrink-0 text-zinc-400" />
            ) : <span className="w-3.5 shrink-0" />}
            <FolderOpen size={14} className="shrink-0 text-zinc-400" />
            <span
              onClick={() => setSelectedCatId(node.id)}
              className="truncate flex-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">{node.name}</span>
            <a href="#"
              onClick={e => { e.preventDefault(); e.stopPropagation(); setItemsModal({ id: node.id, name: node.name }); }}
              className="text-xs text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-800 dark:hover:text-blue-300 font-medium mr-1">{node.dishCount}</a>
            <button onClick={e => { e.stopPropagation(); openEditCat(node); }}
              className="p-0.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil size={12} />
            </button>
          </div>
          {hasChildren && isExpanded && renderTree(kids, depth + 1)}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-full">
      {/* ─── Left sidebar: category tree ─── */}
      <div className="w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Категории меню</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <div
            onClick={() => setSelectedCatId(null)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
              selectedCatId === null
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <span className="text-base shrink-0">📋</span>
            <span>Все блюда</span>
            <span className="text-xs text-zinc-400 ml-auto">{dishes.length}</span>
          </div>
          {renderTree(catTree)}
        </div>
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={openAddCat}
            className="w-full flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.97]">
            <FolderPlus size={16} /> Добавить категорию
          </button>
        </div>
      </div>

      {/* ─── Right content area ─── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="text-zinc-800 dark:text-zinc-200 font-medium">Меню</span>
          {breadcrumbs.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <button onClick={() => setSelectedCatId(c.id)} className={`hover:underline ${i === breadcrumbs.length - 1 ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-zinc-500'}`}>
                {c.name}
              </button>
            </span>
          ))}
        </div>

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {breadcrumbs.length ? breadcrumbs[breadcrumbs.length - 1].name : 'Все блюда'}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} блюд</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
              <input type="checkbox" checked={includeSubcats} onChange={e => setIncludeSubcats(e.target.checked)}
                className="rounded border-zinc-300" />
              С подкатегориями
            </label>
            <button onClick={openAddDish}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-[0.97] whitespace-nowrap">
              <Plus size={18} /> Добавить блюдо
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl px-4 py-2.5 shadow-sm border border-zinc-200 dark:border-zinc-800 max-w-sm">
          <Search size={18} className="text-zinc-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск блюд..." className="flex-1 bg-transparent text-sm outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          {search && <button onClick={() => setSearch('')} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>}
        </div>

        {/* Dish grid */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center shadow-sm border border-zinc-100 dark:border-zinc-800">
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Блюда не найдены</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(dish => (
              <div key={dish.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden hover:shadow-md transition-shadow">
                {dish.imageUrl && (
                  <div className="h-40 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightbox(dish.imageUrl || null)} />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white">{dish.name}</h3>
                      {dish.categoryName && <p className="text-xs text-zinc-500">{dish.categoryName}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">{(dish.price ?? 0).toLocaleString()}₽</p>
                      {(dish.weight ?? 0) > 0 && <p className="text-[10px] text-zinc-400">{dish.weight}г</p>}
                    </div>
                  </div>
                  {dish.description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2">{dish.description}</p>}
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 mb-3">
                    {dish.calories > 0 && <span>🔥 {dish.calories} ккал</span>}
                    {dish.proteins > 0 && <span>Б {dish.proteins}г</span>}
                    {dish.fats > 0 && <span>Ж {dish.fats}г</span>}
                    {dish.carbs > 0 && <span>У {dish.carbs}г</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {dish.isPopular && <span className="text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">Популярное</span>}
                    {dish.stationName && <span className="text-[10px] font-bold bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded-full">{dish.stationName}</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dish.isAvailable ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                      {dish.isAvailable ? 'В наличии' : 'Нет в наличии'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    {dish.techCardId && (
                      <button onClick={() => setTechCardModal({ id: dish.id, name: dish.name })}
                        className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-[0.97]">
                        📄 Техкарта
                      </button>
                    )}
                    <button onClick={() => openEditDish(dish)}
                      className="flex-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-[0.97]">
                      <Pencil size={14} /> Ред.
                    </button>
                    <button onClick={() => handleDeleteDish(dish.id, dish.name)}
                      className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-[0.97]">
                      <Trash2 size={14} /> Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Dish form modal ─── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{editing ? 'Редактировать' : 'Добавить'} блюдо</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600 active:scale-[0.97]"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Название *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Название блюда" className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Цена *</label>
                <input type="number" value={form.price || ''} onChange={e => setForm({...form, price: Number(e.target.value)})} placeholder="0" className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-zinc-500">Описание</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Описание блюда" rows={2} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Категория</label>
                <select value={form.categoryId || ''} onChange={e => setForm({...form, categoryId: Number(e.target.value)})}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none">
                  <option value="">Без категории</option>
                  {catTree.map(renderCatOptions)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Вес (г)</label>
                <input type="number" value={form.weight || ''} onChange={e => setForm({...form, weight: Number(e.target.value)})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Калории</label>
                <input type="number" value={form.calories || ''} onChange={e => setForm({...form, calories: Number(e.target.value)})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Белки (г)</label>
                <input type="number" value={form.proteins || ''} onChange={e => setForm({...form, proteins: Number(e.target.value)})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Жиры (г)</label>
                <input type="number" value={form.fats || ''} onChange={e => setForm({...form, fats: Number(e.target.value)})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Углеводы (г)</label>
                <input type="number" value={form.carbs || ''} onChange={e => setForm({...form, carbs: Number(e.target.value)})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Состав</label>
                <input value={form.ingredients || ''} onChange={e => setForm({...form, ingredients: e.target.value})} placeholder="Ингредиенты через запятую" className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Кухонная станция</label>
                <select value={form.stationId || ''} onChange={e => setForm({...form, stationId: e.target.value ? Number(e.target.value) : null})} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none">
                  <option value="">Без станции</option>
                  {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-zinc-500">Изображение</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm text-zinc-600 dark:text-zinc-400 transition-colors">
                    <ImageIcon size={16} /> Выбрать файл
                    <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
                  </label>
                  {(form.imageUrl || imageBase64) && (
                    <div className="relative">
                      <img src={imageBase64 || form.imageUrl} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={form.isAvailable} onChange={e => setForm({...form, isAvailable: e.target.checked})} className="rounded border-zinc-300" />
                  Доступно
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={form.isPopular} onChange={e => setForm({...form, isPopular: e.target.checked})} className="rounded border-zinc-300" />
                  Популярное
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <button onClick={handleSaveDish} disabled={saving}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]">
                {saving ? 'Сохранение...' : editing ? 'Сохранить изменения' : 'Добавить блюдо'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.97]">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tech card modal ─── */}
      {techCardModal && (
        <TechCardModal
          dishId={techCardModal.id}
          dishName={techCardModal.name}
          dishPrice={dishes.find(d => d.id === techCardModal.id)?.price}
          onClose={() => setTechCardModal(null)}
        />
      )}

      {/* ─── Category items modal ─── */}
      {itemsModal && (
        <CategoryItemsModal
          categoryId={itemsModal.id}
          categoryName={itemsModal.name}
          type="menu"
          onClose={() => setItemsModal(null)}
        />
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* ─── Category form modal ─── */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCatForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{editingCat ? 'Редактировать категорию' : 'Добавить категорию'}</h2>
              <button onClick={() => setShowCatForm(false)} className="p-1.5 text-zinc-400 hover:text-zinc-600 active:scale-[0.97]"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Название *</label>
                <input value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})}
                  placeholder="Название категории"
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">Родительская категория</label>
                <select value={catForm.parentId} onChange={e => setCatForm({...catForm, parentId: Number(e.target.value)})}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white outline-none">
                  <option value={0}>— Корневая категория —</option>
                  {catTree.map(renderCatOptionsFlat)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              {editingCat && (
                <button onClick={() => handleDeleteCat(editingCat.id, editingCat.name)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all active:scale-[0.97]">
                  Удалить
                </button>
              )}
              <button onClick={handleSaveCat}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]">
                {editingCat ? 'Сохранить' : 'Добавить'}
              </button>
              <button onClick={() => setShowCatForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.97]">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderCatOptions(cat: CatNode, depth = 0): React.ReactNode {
    const nodes: React.ReactNode[] = [];
    const prefix = '\u00A0'.repeat(depth * 3);
    nodes.push(<option key={cat.id} value={cat.id}>{prefix}{cat.name}</option>);
    const kids = cat.children || [];
    if (kids.length) {
      kids.forEach(ch => {
        const childNodes = renderCatOptions(ch, depth + 1);
        if (Array.isArray(childNodes)) nodes.push(...childNodes);
        else nodes.push(childNodes);
      });
    }
    return nodes;
  }

  function renderCatOptionsFlat(cat: CatNode, depth = 0): React.ReactNode {
    if (editingCat && cat.id === editingCat.id) return null;
    const nodes: React.ReactNode[] = [];
    const prefix = '\u00A0'.repeat(depth * 3);
    nodes.push(<option key={cat.id} value={cat.id}>{prefix}{cat.name}</option>);
    const kids = cat.children || [];
    if (kids.length) {
      kids.forEach(ch => {
        const childNodes = renderCatOptionsFlat(ch, depth + 1);
        if (Array.isArray(childNodes)) nodes.push(...childNodes);
        else nodes.push(childNodes);
      });
    }
    return nodes;
  }
}
