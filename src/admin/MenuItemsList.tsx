import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown, Upload, CheckCircle, XCircle, Image as ImageIcon, FlaskConical, RefreshCw, Plus, Trash2, Copy, Printer, ArrowUpDown, Download, FileSpreadsheet, FileType, Loader2 } from 'lucide-react';
import * as api from '../api';
import MenuItemCard from './MenuItemCard';
import { addToast } from '../ToastContext';
import * as XLSX from 'xlsx';
import Lightbox from './Lightbox';

interface MenuItem {
  id: number; name: string; imageUrl: string; barcode?: string; article?: string;
  weight: number; netto: number; unit: string; categoryId: number; categoryName?: string;
  type: string; isAvailable: boolean; price: number; cost: number; markup: number;
  techCardId?: number;
}

interface Category { id: number; name: string; }
interface Branch { id: number; name: string; }

type SortDir = 'asc' | 'desc';

const COLUMNS: { key: string; label: string; sortable: boolean }[] = [
  { key: 'name', label: 'Название', sortable: true },
  { key: 'imageUrl', label: 'Изображение', sortable: false },
  { key: 'barcode', label: 'Штрихкод', sortable: true },
  { key: 'article', label: 'Артикул', sortable: true },
  { key: 'netto', label: 'Выход (Нетто)', sortable: true },
  { key: 'unit', label: 'Ед. изм.', sortable: true },
  { key: 'categoryName', label: 'Категория', sortable: false },
  { key: 'type', label: 'Тип', sortable: true },
  { key: 'isAvailable', label: 'Активный', sortable: true },
  { key: 'price', label: 'Цена', sortable: true },
  { key: 'cost', label: 'Себестоимость', sortable: true },
  { key: 'markup', label: 'Наценка', sortable: true },
  { key: 'techCardId', label: 'Техкарта', sortable: false },
];

export default function MenuItemsList() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [catFilter, setCatFilter] = useState<number | ''>('');
  const [storeFilter, setStoreFilter] = useState<number | ''>('');
  const [techCardFilter, setTechCardFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [showCostColumn, setShowCostColumn] = useState(true);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getMenuItems({
        category_id: catFilter || undefined,
        store_id: storeFilter || undefined,
        tech_card_filter: techCardFilter,
        type: typeFilter,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        limit,
      });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [catFilter, storeFilter, techCardFilter, typeFilter, search, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    api.getMenuCategories().then(setCategories).catch(() => {});
    api.get('/api/branches').then(setBranches).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => { if (page === 1) load(); else setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (selectedIds.size === 0) setShowBulkActions(false);
  }, [selectedIds]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErrors([]);
    setImportPreview([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (json.length === 0) {
        setImportErrors(['Файл не содержит данных']);
        setShowImportModal(true);
        return;
      }

      setImportPreview(json.slice(0, 5));
      setShowImportModal(true);

      const rows = json.map((row: any) => ({
        name: row['Название'] || row['name'] || row['Name'] || '',
        price: Number(row['Цена'] || row['price'] || row['Price'] || 0),
        barcode: String(row['Штрихкод'] || row['barcode'] || row['Barcode'] || ''),
        article: String(row['Артикул'] || row['article'] || row['Article'] || ''),
        weight: Number(row['Вес'] || row['Выход'] || row['netto'] || row['weight'] || 0),
        unit: String(row['Ед.изм'] || row['unit'] || row['Unit'] || 'г'),
        category: String(row['Категория'] || row['category'] || ''),
        type: String(row['Тип'] || row['type'] || 'goods'),
        cost: Number(row['Себестоимость'] || row['cost'] || row['Cost'] || 0),
        is_available: row['Активный'] === 'да' || row['Активный'] === '1' || row['Активный'] === true ? 1 : 1,
      }));

      const valid = rows.filter(r => r.name);
      if (valid.length === 0) {
        setImportErrors(['Не найдено строк с названием. Убедитесь, что в файле есть колонка "Название"']);
        return;
      }

      setImporting(true);
      let imported = 0;
      const errors: string[] = [];

      for (const row of valid) {
        try {
          let categoryId: number | null = null;
          if (row.category) {
            const existing = categories.find(c => c.name.toLowerCase() === row.category.toLowerCase());
            if (existing) {
              categoryId = existing.id;
            }
          }
          await api.createDish({
            name: row.name,
            price: row.price,
            barcode: row.barcode,
            article: row.article,
            weight: row.weight,
            netto: row.weight,
            unit: row.unit,
            category_id: categoryId,
            type: row.type === 'Услуга' || row.type === 'service' ? 'service' : 'goods',
            is_available: row.is_available,
            cost: row.cost,
          });
          imported++;
        } catch (err: any) {
          errors.push(`${row.name}: ${err.message}`);
        }
      }

      setImporting(false);
      if (imported > 0) {
        load();
        addToast(`Импортировано: ${imported} из ${valid.length}`, 'success');
      }
      if (errors.length > 0) {
        setImportErrors(errors);
      } else {
        setShowImportModal(false);
      }
    } catch (err: any) {
      setImportErrors([`Ошибка чтения файла: ${err.message}`]);
      setImporting(false);
    }

    e.target.value = '';
  };

  const handleBulkToggleActive = async () => {
    if (selectedIds.size === 0) return;
    const action = confirm('Изменить статус активности выбранных элементов?') ? undefined : null;
    if (action === null) return;
    const first = items.find(i => selectedIds.has(i.id));
    if (!first) return;
    const newStatus = !first.isAvailable;
    let done = 0;
    for (const id of selectedIds) {
      try {
        await api.updateDish(id, { is_available: newStatus ? 1 : 0 });
        done++;
      } catch {}
    }
    addToast(`Обновлено ${done} из ${selectedIds.size}`, 'success');
    setSelectedIds(new Set());
    load();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Удалить ${selectedIds.size} элементов? Это действие необратимо.`)) return;
    let done = 0;
    for (const id of selectedIds) {
      try {
        await api.deleteDish(id);
        done++;
      } catch {}
    }
    addToast(`Удалено ${done} из ${selectedIds.size}`, 'success');
    setSelectedIds(new Set());
    load();
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length && items.length > 0) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(items.map(i => i.id))); }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ChevronUp size={10} className="inline ml-1 text-zinc-300 dark:text-zinc-600" />;
    return sortOrder === 'asc'
      ? <ChevronUp size={12} className="inline ml-1 text-blue-500" />
      : <ChevronDown size={12} className="inline ml-1 text-blue-500" />;
  };

  const headClass = "px-2 py-2.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-left select-none border-r border-zinc-100 dark:border-zinc-800 last:border-r-0";
  const cellClass = "px-2 py-2.5 text-sm border-r border-zinc-100 dark:border-zinc-800 last:border-r-0";
  const iconBtnClass = "p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition active:scale-[0.97]";
  const filterLabel = "text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block";
  const filterInput = "w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30";

  return (
    <div className="space-y-3 max-w-[1440px] mx-auto">
      {/* Top toolbar row */}
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200/60 dark:border-zinc-800 flex-wrap">
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button onClick={load} className={iconBtnClass} title="Обновить"><RefreshCw size={15} /></button>
          <button className={`${iconBtnClass} text-emerald-600 hover:text-emerald-700`} title="Добавить" onClick={() => setShowCreate(true)}>
            <Plus size={15} />
          </button>
          <button className={iconBtnClass} title="Удалить выбранные" onClick={handleBulkDelete} disabled={selectedIds.size === 0}><Trash2 size={15} /></button>
          <button className={iconBtnClass} title="Копировать"><Copy size={15} /></button>
          <button className={iconBtnClass} title="Печать"><Printer size={15} /></button>
        </div>

        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />

        {/* Порядок вывода / Импорт */}
        <div className="flex items-center gap-1.5">
          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition border border-zinc-200/50 dark:border-zinc-700">
            <ArrowUpDown size={13} /> Порядок вывода
          </button>
          <button onClick={handleImportClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition border border-blue-200/50 dark:border-blue-800/50">
            <Upload size={13} /> Импорт
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
        </div>

        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />

        {/* Filter dropdowns */}
        <div className="flex items-end gap-2.5 flex-1 min-w-0 flex-wrap">
          <div className="min-w-[130px]">
            <label className={filterLabel}>Категория</label>
            <select value={catFilter} onChange={e => { setCatFilter(e.target.value as any || ''); setPage(1); }} className={filterInput}>
              <option value="">—</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="min-w-[110px]">
            <label className={filterLabel}>Магазин</label>
            <select value={storeFilter} onChange={e => { setStoreFilter(e.target.value as any || ''); setPage(1); }} className={filterInput}>
              <option value="">—</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="min-w-[90px]">
            <label className={filterLabel}>Техкарта</label>
            <select value={techCardFilter} onChange={e => { setTechCardFilter(e.target.value); setPage(1); }} className={filterInput}>
              <option value="all">Все</option>
              <option value="yes">Есть</option>
              <option value="no">Нет</option>
            </select>
          </div>
          <div className="min-w-[90px]">
            <label className={filterLabel}>Тип</label>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className={filterInput}>
              <option value="all">Все</option>
              <option value="goods">Товар</option>
              <option value="service">Услуга</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px] max-w-[240px]">
            <label className={filterLabel}>Поиск</label>
            <div className="relative">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Название, артикул, штрихкод"
                className={`${filterInput} pr-7`} />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"><X size={13} /></button>}
            </div>
          </div>
        </div>
      </div>

      {/* Quick filter row */}
      <div className="flex items-center gap-3 px-1">
        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
          <input type="checkbox" checked={selectedIds.size === items.length && items.length > 0} onChange={toggleSelectAll}
            className="rounded border-zinc-300 dark:border-zinc-600 accent-blue-500" />
          Все
        </label>
        {selectedIds.size > 0 && (
          <div className="relative">
            <button onClick={() => setShowBulkActions(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition">
              Действия ({selectedIds.size}) <ChevronDown size={12} />
            </button>
            {showBulkActions && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                <button onClick={() => { setShowBulkActions(false); handleBulkToggleActive(); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">Вкл./Выкл. активность</button>
                <button onClick={() => { setShowBulkActions(false); setTypeFilter('goods'); setPage(1); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">Отметить как товар</button>
                <button onClick={() => { setShowBulkActions(false); setTypeFilter('service'); setPage(1); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">Отметить как услугу</button>
                <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                <button onClick={() => { setShowBulkActions(false); handleBulkDelete(); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition">Удалить выбранные</button>
              </div>
            )}
          </div>
        )}
        <button onClick={() => { setTypeFilter(typeFilter === 'goods' ? 'all' : 'goods'); setPage(1); }}
          className={`px-3.5 py-1 rounded-lg text-xs font-bold transition active:scale-[0.97] ${typeFilter === 'goods' ? 'bg-blue-500 text-white shadow-sm shadow-blue-200' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'}`}>
          Товар
        </button>
        <button onClick={() => setShowCostColumn(v => !v)}
          className={`px-3.5 py-1 rounded-lg text-xs font-bold transition active:scale-[0.97] ${showCostColumn ? 'bg-blue-500 text-white shadow-sm shadow-blue-200' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'}`}>
          Себ-ть
        </button>
        {storeFilter && <span className="text-[11px] text-zinc-400 ml-auto">{' '}</span>}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200/60 dark:border-zinc-800 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">Элементы не найдены</div>
        ) : (
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                <th className={`${headClass} w-8`}>
                  <input type="checkbox" checked={selectedIds.size === items.length} onChange={toggleSelectAll}
                    className="rounded border-zinc-300 dark:border-zinc-600 accent-blue-500" />
                </th>
                {COLUMNS.map(col => (
                  <th key={col.key} className={`${headClass} ${col.sortable ? 'cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}>
                    <span className="inline-flex items-center">
                      {col.label}
                      <SortIcon column={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                  onClick={() => setEditItem(item)}>
                  <td className={`${cellClass} w-8`} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => {
                      const next = new Set(selectedIds);
                      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                      setSelectedIds(next);
                    }} className="rounded border-zinc-300 dark:border-zinc-600 accent-blue-500" />
                  </td>
                  <td className={`${cellClass} font-medium text-zinc-900 dark:text-white max-w-[160px] truncate`}>{item.name}</td>
                  <td className={cellClass}>
                    {item.imageUrl ? (
                      <button onClick={() => setLightbox(item.imageUrl)} className="inline-block">
                        <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-80 transition" />
                      </button>
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                        <ImageIcon size={13} className="text-zinc-400" />
                      </div>
                    )}
                  </td>
                  <td className={`${cellClass} text-zinc-600 dark:text-zinc-400 max-w-[110px] truncate text-[13px]`}>{item.barcode || '—'}</td>
                  <td className={`${cellClass} text-zinc-600 dark:text-zinc-400 text-[13px]`}>{item.article || '—'}</td>
                  <td className={`${cellClass} text-zinc-700 dark:text-zinc-300 text-[13px]`}>{item.netto || item.weight ? `${(item.netto || item.weight)}` : '—'}</td>
                  <td className={`${cellClass} text-zinc-600 dark:text-zinc-400 text-[13px]`}>{item.unit || 'г'}</td>
                  <td className={`${cellClass} text-zinc-600 dark:text-zinc-400 max-w-[110px] truncate text-[13px]`}>{item.categoryName || '—'}</td>
                  <td className={`${cellClass} text-zinc-600 dark:text-zinc-400 text-[13px]`}>{item.type === 'service' ? 'Услуга' : 'Товар'}</td>
                  <td className={cellClass}>
                    {item.isAvailable ? (
                      <CheckCircle size={15} className="text-emerald-500" />
                    ) : (
                      <XCircle size={15} className="text-red-400" />
                    )}
                  </td>
                  <td className={`${cellClass} font-medium text-zinc-900 dark:text-white text-[13px] whitespace-nowrap`}>{item.price?.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}₽</td>
                  {showCostColumn && (
                    <td className={`${cellClass} text-zinc-600 dark:text-zinc-400 text-[13px] whitespace-nowrap`}>{item.cost?.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}₽</td>
                  )}
                  <td className={`${cellClass} text-zinc-700 dark:text-zinc-300 text-[13px]`}>{item.markup?.toFixed(1)}%</td>
                  <td className={`${cellClass} text-center`} onClick={e => e.stopPropagation()}>
                    {item.techCardId ? (
                      <button className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        onClick={() => addToast(`Техкарта #${item.techCardId}`, 'info')}>
                        <FlaskConical size={13} /> <span>Есть</span>
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-400">Нет</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
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
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">Элементов на странице</span>
          <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
            className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-700 dark:text-zinc-300 outline-none w-14">
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-[11px] text-zinc-400 ml-1">Страница {page} из {totalPages || 1}</span>
        </div>
      </div>

      {/* Import modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4" onClick={() => { if (!importing) setShowImportModal(false); }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Upload size={18} /> Импорт элементов
              </h2>
              <button onClick={() => setShowImportModal(false)} disabled={importing}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {importing && (
                <div className="flex items-center gap-3 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg">
                  <Loader2 size={18} className="animate-spin" />
                  Импорт данных...
                </div>
              )}
              {importPreview.length > 0 && !importing && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">Предпросмотр ({importPreview.length} строк):</p>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          {Object.keys(importPreview[0]).slice(0, 6).map(k => (
                            <th key={k} className="px-2 py-1.5 text-left font-semibold text-zinc-500 uppercase whitespace-nowrap">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, i) => (
                          <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                            {Object.keys(row).slice(0, 6).map(k => (
                              <td key={k} className="px-2 py-1 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{String(row[k]).slice(0, 40)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {importErrors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-500 mb-1">Ошибки импорта:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importErrors.map((err, i) => (
                      <p key={i} className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded">{err}</p>
                    ))}
                  </div>
                </div>
              )}
              {!importing && (
                <div className="text-xs text-zinc-400 space-y-1">
                  <p>Поддерживаемые форматы: <strong>.csv, .xlsx, .xls</strong></p>
                  <p>Колонки: Название, Цена, Штрихкод, Артикул, Вес, Категория, Тип, Себестоимость</p>
                  <p>Категория сопоставляется по имени с существующими категориями меню.</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
              <button onClick={() => { fileInputRef.current?.click(); }} disabled={importing}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center gap-1.5">
                <FileSpreadsheet size={14} /> Выбрать другой файл
              </button>
              <button onClick={() => setShowImportModal(false)} disabled={importing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <MenuItemCard item={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load(); }} />
      )}
      {showCreate && (
        <MenuItemCard onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
