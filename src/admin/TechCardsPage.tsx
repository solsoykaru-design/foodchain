import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { FileText, Plus, X, Edit3, Trash2, Search, Download, Upload, ChevronLeft, ChevronRight } from 'lucide-react';import TechCardEditor from './TechCardEditor';
import { addToast } from '../ToastContext';


export default function TechCardsPage() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stats, setStats] = useState<any>(null);



  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api.getDishTechCards({ search, page, limit: 20 }),
        api.getDishTechCardsStats().catch(() => null),
      ]);
      setItems(r.items || []);
      setTotal(r.total || 0);
      setTotalPages(r.totalPages || 1);
      if (s) setStats(s);
    } catch {} finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (id: number) => { setEditingId(id); setView('editor'); };

  const openNew = async () => {
    try {
      const dishes: any[] = await api.request('/api/dishes').then((r: any) => Array.isArray(r) ? r : r.items || []);
      if (dishes.length === 0) return addToast('Нет блюд в меню', 'error');
      const name = prompt('Введите название блюда для новой техкарты:');
      if (!name) return;
      const dish = dishes.find((d: any) => d.name.toLowerCase() === name.toLowerCase());
      let dishId = dish ? dish.id : null;
      if (!dish) {
        if (!confirm(`Блюдо "${name}" не найдено в меню. Создать новое блюдо?`)) return;
        const created: any = await api.request('/api/dishes', { method: 'POST', body: JSON.stringify({ name, price: 0 }) });
        dishId = created.id;
      }
      if (!dishId) return;
      const tc: any = await api.createDishTechCard({ dish_id: dishId, dish_name: name, ingredients: [], technology: '', output: 0 });
      setEditingId(tc.id);
      setView('editor');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const del = async (id: number) => {
    if (!confirm('Удалить техкарту? Она будет перемещена в архив.')) return;
    try { await api.deleteDishTechCard(id); load(); } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleSaved = () => { load(); setView('list'); };


  if (view === 'editor' && editingId) {
    return (
      <div className="max-w-7xl mx-auto">
        <TechCardEditor techCardId={editingId} onClose={() => setView('list')} onSaved={handleSaved} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Технологические карты</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {stats ? `${stats.total} техкарт, ${stats.withCost} с себестоимостью, средняя: ${stats.avgCost}₽` : 'Загрузка...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {}} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700">
            <Download size={18} /> XLSX
          </button>
          <button onClick={() => {}} className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-amber-700">
            <Upload size={18} /> Импорт
          </button>
          <button onClick={openNew} className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-600">
            <Plus size={18} /> Создать техкарту
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Поиск по названию блюда..."
            className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
          <FileText size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
          <p className="text-zinc-500">Нет технологических карт</p>
          <p className="text-sm text-zinc-400 mt-1">Создайте первую карту для контроля себестоимости</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs">
                <th className="text-left py-3 px-4">Блюдо</th>
                <th className="text-center py-3 px-2">Ингр.</th>
                <th className="text-right py-3 px-2">Выход, г</th>
                <th className="text-right py-3 px-2">Себестоимость</th>
                <th className="text-center py-3 px-2">Версия</th>
                <th className="text-center py-3 px-2">Время</th>
                <th className="text-center py-3 px-2">Статус</th>
                <th className="text-center py-3 px-4">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((tc: any) => (
                <tr key={tc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer" onClick={() => openEdit(tc.id)}>
                  <td className="py-3 px-4 font-medium text-zinc-900 dark:text-white">{tc.dish_name}</td>
                  <td className="py-3 px-2 text-center text-zinc-500">{tc.ingredient_count}</td>
                  <td className="py-3 px-2 text-right text-zinc-700 dark:text-zinc-300">{tc.output || 0}г</td>
                  <td className="py-3 px-2 text-right font-medium text-zinc-900 dark:text-white">
                    {tc.cost_price > 0 ? `${tc.cost_price.toLocaleString('ru-RU')}₽` : '—'}
                  </td>
                  <td className="py-3 px-2 text-center text-zinc-500">v{tc.version || 1}</td>
                  <td className="py-3 px-2 text-center text-zinc-500">{tc.cooking_time ? `${tc.cooking_time} мин` : '—'}</td>
                  <td className="py-3 px-2 text-center">
                    {tc.is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Активна</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Неактивна</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(tc.id)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-blue-500" title="Редактировать"><Edit3 size={15} /></button>
                      <button onClick={() => del(tc.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-zinc-400 hover:text-red-500" title="Удалить"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="text-sm text-zinc-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
