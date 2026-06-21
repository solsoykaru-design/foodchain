import { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Search } from 'lucide-react';
import * as api from '../api';

interface Props {
  categoryId: number;
  categoryName: string;
  type: 'menu' | 'stock';
  onClose: () => void;
}

const PAGE_SIZE = 10;

export default function CategoryItemsModal({ categoryId, categoryName, type, onClose }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (type === 'menu') {
          const data = await api.getDishes(categoryId, false);
          setItems(data || []);
        } else {
          const res = await api.request(`/api/inventory-items?category_id=${categoryId}&limit=1000`);
          setItems(res.items || []);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [categoryId, type]);

  useEffect(() => { setPage(1); }, [search]);

  const columns = type === 'menu'
    ? [
        { key: 'name', label: 'Название' },
        { key: 'price', label: 'Цена', right: true },
        { key: 'isAvailable', label: 'Активность' },
      ]
    : [
        { key: 'name', label: 'Название' },
        { key: 'unit', label: 'Ед.изм' },
        { key: 'currentBalance', label: 'Остаток', right: true },
        { key: 'pricePerUnit', label: 'Цена', right: true },
      ];

  const filtered = items.filter((i: any) =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a: any, b: any) => {
    let aVal = a[sortBy]; let bVal = b[sortBy];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal == null) return 1; if (bVal == null) return -1;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ChevronUp size={10} className="inline ml-1 text-zinc-300 dark:text-zinc-600" />;
    return sortOrder === 'asc'
      ? <ChevronUp size={12} className="inline ml-1 text-blue-500" />
      : <ChevronDown size={12} className="inline ml-1 text-blue-500" />;
  };

  const hc = 'px-3 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-left select-none border-r border-zinc-100 dark:border-zinc-800 last:border-r-0 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200';
  const cc = 'px-3 py-2.5 text-sm border-r border-zinc-100 dark:border-zinc-800 last:border-r-0';

  const title = type === 'menu' ? 'Блюда категории' : 'Товары категории';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{title} «{categoryName}»</h2>
            <p className="text-sm text-zinc-500 mt-0.5">{items.length} шт.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"><X size={20} /></button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <Search size={15} className="text-zinc-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
            className="flex-1 bg-transparent text-sm outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : paged.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 text-sm">Ничего не найдено</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40 sticky top-0">
                  {columns.map(col => (
                    <th key={col.key} className={hc} onClick={() => toggleSort(col.key)}
                      style={(col as any).right ? { textAlign: 'right' } : undefined}>
                      <span className="inline-flex items-center gap-0.5">{col.label}<SortIcon column={col.key} /></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {paged.map((item: any) => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className={`${cc} font-medium text-zinc-900 dark:text-white`}>{item.name}</td>
                    {type === 'menu' ? (
                      <>
                        <td className={`${cc} text-right`}>{item.price?.toLocaleString()}₽</td>
                        <td className={cc}>{item.isAvailable ? <span className="text-green-600 text-xs font-medium">Да</span> : <span className="text-red-500 text-xs font-medium">Нет</span>}</td>
                      </>
                    ) : (
                      <>
                        <td className={cc}>{item.unit}</td>
                        <td className={`${cc} text-right`}>{item.currentBalance?.toFixed(2)}</td>
                        <td className={`${cc} text-right`}>{item.pricePerUnit?.toLocaleString()}₽</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-500 shrink-0">
            <span>Страница {page} из {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 text-xs font-medium transition-colors">← Назад</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 text-xs font-medium transition-colors">Вперёд →</button>
            </div>
          </div>
        )}

        {/* Close button */}
        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
