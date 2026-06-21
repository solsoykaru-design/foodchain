import { useState, useEffect, useCallback, useRef } from 'react';
import { Package, ChevronLeft, ChevronRight, FileText, Pencil, Trash2, AlertTriangle, Upload, X, FolderPlus, ChevronDown, ChevronRight as ChevronRightIcon, FolderOpen } from 'lucide-react';
import * as api from '../api';
import * as XLSX from 'xlsx';
import StockItemCard from './StockItemCard';
import ProductModal from './ProductModal';
import CategoryItemsModal from './CategoryItemsModal';
import { addToast } from '../ToastContext';

interface CatNode {
  id: number; name: string; parentId?: number;
  itemCount: number; children: CatNode[];
}

export default function InventoryItemsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);

  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTechCard, setFilterTechCard] = useState('all');
  const [filterContragent, setFilterContragent] = useState('');

  const [cardId, setCardId] = useState<number | null>(null);
  const [allIds, setAllIds] = useState<number[]>([]);
  const [showCard, setShowCard] = useState(false);

  const [editItemId, setEditItemId] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  // Tree state
  const [catTree, setCatTree] = useState<CatNode[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Category CRUD
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<CatNode | null>(null);
  const [catForm, setCatForm] = useState({ name: '', parentId: 0 });
  const [itemsModal, setItemsModal] = useState<{ id: number; name: string } | null>(null);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (json.length === 0) {
        setImportResult({ imported: 0, errors: ['Файл не содержит данных'] });
        return;
      }

      setImporting(true);
      const colMap: Record<string, string> = {};
      const normKey = (s: string) => s.toLowerCase().trim().replace(/[\s*]+/g, ' ').replace(/[^a-zа-яё0-9 ]/g, '').replace(/^\s+|\s+$/g, '');
      for (const key of Object.keys(json[0])) {
        colMap[normKey(key)] = key;
      }
      const col = (alts: string[]) => {
        for (const a of alts) {
          const found = Object.keys(colMap).find(k => k.includes(normKey(a)));
          if (found) return colMap[found];
        }
        return null;
      };

      const nameCol = col(['наименование', 'название', 'товар', 'name']);
      const categoryCol = col(['категория', 'категоря', 'category']);
      const unitCol = col(['едизм', 'единица', 'ед', 'unit']);
      const priceCol = col(['цена', 'price']);
      const stockCol = col(['остаток', 'stock', 'количество', 'quantity']);
      const barcodeCol = col(['штрихкод', 'barcode', 'баркод', 'штрих']);
      const articleCol = col(['артикул', 'article']);

      if (!nameCol) {
        setImportResult({ imported: 0, errors: ['Не найдена колонка "Наименование"'] });
        setImporting(false);
        return;
      }

      let imported = 0;
      const errors: string[] = [];

      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        const name = String(row[nameCol] || '').trim();
        if (!name) { errors.push(`Строка ${i + 2}: пустое название`); continue; }

        const unit = unitCol ? String(row[unitCol] || 'шт').trim() : 'шт';
        let price = 0;
        if (priceCol) {
          const raw = String(row[priceCol] || '').replace(',', '.').trim();
          price = parseFloat(raw) || 0;
        }
        let stock = 0;
        if (stockCol) {
          const raw = String(row[stockCol] || '').replace(',', '.').trim();
          stock = parseFloat(raw) || 0;
        }
        const barcode = barcodeCol ? String(row[barcodeCol] || '').trim() : '';
        const article = articleCol ? String(row[articleCol] || '').trim() : '';
        const categoryName = categoryCol ? String(row[categoryCol] || '').trim() : '';

        try {
          await api.request('/api/inventory-items/import', {
            method: 'POST',
            body: JSON.stringify({ name, unit, price, stock, barcode, article, categoryName }),
          });
          imported++;
        } catch (e: any) {
          errors.push(`Строка ${i + 2}: ${e.message || 'Ошибка'}`);
        }
      }

      setImportResult({ imported, errors });
      load();
    } catch (e: any) {
      setImportResult({ imported: 0, errors: [e.message || 'Ошибка чтения файла'] });
    }
    finally { setImporting(false); }
    e.target.value = '';
  };

  const handleDownloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Наименование', 'Категория', 'Ед.изм', 'Цена', 'Остаток', 'Артикул', 'Штрихкод'],
      ['Помидоры', 'Овощи', 'кг', 150, 100, 'TOM-001', '4612345678901'],
      ['Мука пшеничная', 'Бакалея', 'кг', 80, 500, 'MUK-001', ''],
      ['Масло подсолнечное', 'Масла', 'л', 200, 50, 'MAS-001', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');
    XLSX.writeFile(wb, 'sample_import.xlsx');
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q: any = { page, limit };
      if (filterWarehouse) q.warehouse = filterWarehouse;
      if (filterCategory) q.category = filterCategory;
      if (filterTechCard && filterTechCard !== 'all') q.tech_card = filterTechCard;
      if (filterContragent) q.contragent = filterContragent;
      if (selectedCatId) { q.category_id = selectedCatId; q.include_subcategories = 'true'; }
      const [res, tree] = await Promise.all([
        api.request(`/api/inventory-items?${new URLSearchParams(q).toString()}`).catch(() => ({ items: [], total: 0 })),
        api.getStockCategories(true).catch(() => []),
      ]);
      setItems(res.items || []);
      setTotal(res.total || 0);
      setAllIds((res.items || []).map((i: any) => i.id));
      setSelectedIds(new Set());
      setCatTree(tree || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, limit, filterWarehouse, filterCategory, filterTechCard, filterContragent, selectedCatId]);

  useEffect(() => { load(); }, [load]);

  const openCard = (id: number) => {
    setCardId(id);
    setShowCard(true);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const handleDeleteSingle = async (id: number) => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteInventoryItem(id);
      setConfirmDelete(null);
      load();
    } catch (e: any) { setDeleteError(e.message || 'Ошибка удаления'); }
    finally { setDeleting(false); }
  };

  const handleDeleteBulk = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      for (const id of selectedIds) {
        await api.deleteInventoryItem(id);
      }
      setConfirmBulkDelete(false);
      load();
    } catch (e: any) { setDeleteError(e.message || 'Ошибка удаления'); }
    finally { setDeleting(false); }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
    if (!catForm.name.trim()) { addToast('Введите название категории', 'warning'); return; }
    try {
      if (editingCat) {
        await api.updateStockCategory(editingCat.id, { name: catForm.name, parent_id: catForm.parentId || null });
      } else {
        await api.createStockCategory({ name: catForm.name, parent_id: catForm.parentId || undefined });
      }
      setShowCatForm(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleDeleteCat = async (id: number, name: string) => {
    if (!confirm(`Удалить категорию "${name}"? Дочерние категории перейдут к родительской.`)) return;
    try {
      await api.deleteStockCategory(id);
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
              isExpanded ? <ChevronDown size={14} className="shrink-0 text-zinc-400" /> : <ChevronRightIcon size={14} className="shrink-0 text-zinc-400" />
            ) : <span className="w-3.5 shrink-0" />}
            <FolderOpen size={14} className="shrink-0 text-zinc-400" />
            <span
              onClick={() => setSelectedCatId(node.id)}
              className="truncate flex-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">{node.name}</span>
            <a href="#"
              onClick={e => { e.preventDefault(); e.stopPropagation(); setItemsModal({ id: node.id, name: node.name }); }}
              className="text-xs text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-800 dark:hover:text-blue-300 font-medium mr-1">{node.itemCount}</a>
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

  // ─── Full-screen card view ───
  if (showCard && cardId !== null) {
    return (
      <StockItemCard
        itemId={cardId}
        allIds={allIds}
        onClose={() => setShowCard(false)}
        onSaved={() => { setShowCard(false); load(); }}
      />
    );
  }

  return (
    <div className="flex gap-0 h-full">
      {/* ─── Left sidebar: category tree ─── */}
      <div className="w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Категории склада</h2>
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
            <span className="text-base shrink-0">📦</span>
            <span>Все товары</span>
            <span className="text-xs text-zinc-400 ml-auto">{total}</span>
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

      {/* ─── Right content ─── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Breadcrumbs */}
        {selectedCatId && (() => {
          const findPath = (nodes: CatNode[], targetId: number): CatNode[] => {
            for (const n of nodes) {
              if (n.id === targetId) return [n];
              const kids = n.children || [];
              const found = findPath(kids, targetId);
              if (found.length) return [n, ...found];
            }
            return [];
          };
          const crumbs = findPath(catTree, selectedCatId);
          return (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="text-zinc-800 dark:text-zinc-200 font-medium">Склад</span>
              {crumbs.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  <span className="text-zinc-300 dark:text-zinc-600">/</span>
                  <button onClick={() => setSelectedCatId(c.id)}
                    className={`hover:underline ${i === crumbs.length - 1 ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-zinc-500'}`}>
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
          );
        })()}

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {selectedCatId
                ? (() => { const p = (n: CatNode[], id: number): string => { for (const c of n) if (c.id === id) return c.name; return ''; }; return p(catTree, selectedCatId) || 'Все товары'; })()
                : 'Все товары'}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">{total} товаров</p>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx,.xls" className="hidden" />
            <button onClick={handleImportClick} disabled={importing}
              className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-[0.97]">
              <Upload size={16} /> Импорт
            </button>
            <button onClick={handleDownloadSample}
              className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-[0.97]">
              <FileText size={16} /> Образец
            </button>
            {selectedIds.size > 0 && (
              <button onClick={() => setConfirmBulkDelete(true)}
                className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5">
                <Trash2 size={16} /> Удалить ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input value={filterWarehouse} onChange={e => { setFilterWarehouse(e.target.value); setPage(1); }}
            placeholder="Склад" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none w-36 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          <input value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
            placeholder="Категория" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none w-36 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          <select value={filterTechCard} onChange={e => { setFilterTechCard(e.target.value); setPage(1); }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none text-zinc-900 dark:text-white">
            <option value="all">Все</option>
            <option value="has">С техкартой</option>
            <option value="none">Без техкарты</option>
          </select>
          <input value={filterContragent} onChange={e => { setFilterContragent(e.target.value); setPage(1); }}
            placeholder="Контрагент" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none w-36 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
        </div>

        {/* Import result */}
        {importResult && (
          <div className={`rounded-2xl p-4 text-sm ${importResult.errors.length === 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}`}>
            <p>Импортировано: <strong>{importResult.imported}</strong></p>
            {importResult.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5"><li>{importResult.errors.slice(0, 5).join('</li><li>')}</li></ul>
            )}
            <button onClick={() => setImportResult(null)} className="text-xs underline mt-1 opacity-70 hover:opacity-100">Закрыть</button>
          </div>
        )}

        {/* Delete error */}
        {deleteError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl p-3 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {deleteError}
            <button onClick={() => setDeleteError('')} className="ml-auto opacity-60 hover:opacity-100"><X size={16} /></button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center shadow-sm border border-zinc-100 dark:border-zinc-800">
            <Package size={40} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Товары не найдены</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 text-xs">
                    <th className="p-3 text-left w-10">
                      <input type="checkbox" checked={selectedIds.size === items.length && items.length > 0}
                        onChange={toggleSelectAll} className="rounded border-zinc-300" />
                    </th>
                    <th className="p-3 text-left">Наименование</th>
                    <th className="p-3 text-left">Категория</th>
                    <th className="p-3 text-left">Ед.изм</th>
                    <th className="p-3 text-right">Остаток</th>
                    <th className="p-3 text-right">Цена</th>
                    <th className="p-3 text-right">Техкарта</th>
                    <th className="p-3 text-right w-24">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="p-3">
                        <input type="checkbox" checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)} className="rounded border-zinc-300" />
                      </td>
                      <td className="p-3">
                        <button onClick={() => openCard(item.id)} className="text-left font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate block max-w-[200px]">
                          {item.name}
                        </button>
                      </td>
                      <td className="p-3 text-zinc-500">{item.category}</td>
                      <td className="p-3 text-zinc-500">{item.unit}</td>
                      <td className={`p-3 text-right font-medium ${item.currentBalance <= 0 ? 'text-red-500' : item.currentBalance < item.minStock ? 'text-amber-500' : 'text-zinc-900 dark:text-white'}`}>
                        {item.currentBalance?.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-zinc-900 dark:text-white font-medium">{item.pricePerUnit?.toLocaleString()}₽</td>
                      <td className="p-3 text-right">
                        {item.hasTechCard ? <span className="text-green-600 dark:text-green-400 text-xs font-medium">Есть</span> : <span className="text-zinc-400 text-xs">Нет</span>}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openCard(item.id)}
                            className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmDelete(item.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-500">
              <span>{total} товаров • стр. {page} из {totalPages}</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Delete confirm modal ─── */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Удалить товар?</h3>
            <p className="text-sm text-zinc-500 mb-6">Это действие нельзя отменить.</p>
            {deleteError && <p className="text-xs text-red-500 mb-4">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => handleDeleteSingle(confirmDelete)} disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]">
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.97]">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk delete confirm ─── */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmBulkDelete(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Удалить {selectedIds.size} товаров?</h3>
            <p className="text-sm text-zinc-500 mb-6">Это действие нельзя отменить.</p>
            {deleteError && <p className="text-xs text-red-500 mb-4">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={handleDeleteBulk} disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]">
                {deleting ? 'Удаление...' : 'Удалить все'}
              </button>
              <button onClick={() => setConfirmBulkDelete(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-[0.97]">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Category items modal ─── */}
      {itemsModal && (
        <CategoryItemsModal
          categoryId={itemsModal.id}
          categoryName={itemsModal.name}
          type="stock"
          onClose={() => setItemsModal(null)}
        />
      )}

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
                  {renderCatOptions(catTree)}
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

      {/* ─── Edit item modal ─── */}
      {editItemId !== null && (
        <ProductModal
          itemId={editItemId}
          onClose={() => setEditItemId(null)}
          onSaved={() => { setEditItemId(null); load(); }}
        />
      )}
    </div>
  );

  function renderCatOptions(cats: CatNode[], depth = 0): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    for (const cat of cats) {
      if (editingCat && cat.id === editingCat.id) continue;
      const prefix = '\u00A0'.repeat(depth * 3);
      nodes.push(<option key={cat.id} value={cat.id}>{prefix}{cat.name}</option>);
      const kids = cat.children || [];
      if (kids.length) {
        nodes.push(...renderCatOptions(kids, depth + 1));
      }
    }
    return nodes;
  }
}
