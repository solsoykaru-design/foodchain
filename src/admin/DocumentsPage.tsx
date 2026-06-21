import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { setDocType, getDocType, onDocTypeChange } from './docStore';
import { addToast } from '../ToastContext';
import { Search, Plus, Upload, Edit3, Trash2, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Check, Ban, Printer } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  confirmed: 'Подтверждён',
  completed: 'Проведён',
  cancelled: 'Отменён',
};

const TYPE_LABELS: Record<string, string> = {
  journal: 'Журнал документов',
  receipt: 'Приходы',
  writeoff: 'Списания',
  transfer: 'Перемещения',
  inventory: 'Инвентаризация',
  production: 'Производства',
  return: 'Возвраты',
  shipment: 'Отгрузки',
  breakdown: 'Разборы',
  processing: 'Переработки',
  contractor_order: 'Заказы контрагентам',
  production_order: 'Заказы на производство',
  service: 'Услуги',
  sales_act: 'Акты реализ.',
  egais: 'ЕГАИС',
};

const getTypeLabel = (t: string) => TYPE_LABELS[t] || t;

const PAGE_SIZES = [20, 50, 100];

interface DocItem {
  itemId: number;
  itemName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  cost: number;
  techCardId?: number;
  techCardName?: string;
}

const emptyDocItem: DocItem = { itemId: 0, itemName: '', quantity: 1, unit: 'шт', pricePerUnit: 0, cost: 0 };

interface DocForm {
  type: string;
  counterparty: string;
  sum: number;
  items: DocItem[];
  note: string;
  status: string;
  created_by: string;
  warehouse_from: string;
  warehouse_to: string;
  doc_date: string;
}

function emptyForm(type: string): DocForm {
  return { type, counterparty: '', sum: 0, items: [], note: '', status: 'draft', created_by: '', warehouse_from: '', warehouse_to: '', doc_date: new Date().toISOString().slice(0, 10) };
}

export default function DocumentsPage() {
  const [selectedType, setSelectedType] = useState(getDocType);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DocForm>(emptyForm('receipt'));
  const [saving, setSaving] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [showInvDropdown, setShowInvDropdown] = useState(false);
  const [techCards, setTechCards] = useState<any[]>([]);
  const [showTcDropdown, setShowTcDropdown] = useState<number | null>(null);

  useEffect(() => {
    const unsub = onDocTypeChange(type => {
      setSelectedType(type);
      setPage(1);
      setSelectedId(null);
    });
    return unsub;
  }, []);

  const load = useCallback(async () => {
    if (!selectedType) return;
    setLoading(true);
    try {
      const res = await api.getDocuments({ type: selectedType, search, page, limit: pageSize });
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [selectedType, search, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showModal && inventory.length === 0) {
      api.getInventory().then(setInventory).catch(() => {});
    }
  }, [showModal, inventory.length]);

  const filteredInventory = inventory.filter((i: any) => i.name?.toLowerCase().includes(invSearch.toLowerCase())).slice(0, 10);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(selectedType));
    setInvSearch('');
    setShowModal(true);
  };

  const openEdit = async (id: number) => {
    setEditingId(id);
    try {
      const doc = await api.getDocument(id);
      const docDate = doc.doc_date ? doc.doc_date.slice(0, 10) : (doc.date ? doc.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setForm({
        type: doc.type || selectedType,
        counterparty: doc.counterparty || '',
        sum: doc.sum || 0,
        items: Array.isArray(doc.items) ? doc.items.map((i: any) => ({
          itemId: i.itemId || i.item_id || i.id || 0,
          itemName: i.itemName || i.item_name || i.name || '',
          quantity: parseFloat(i.quantity) || 1,
          unit: i.unit || 'шт',
          pricePerUnit: parseFloat(i.pricePerUnit || i.price_per_unit || i.price) || 0,
          cost: parseFloat(i.cost) || 0,
          techCardId: i.techCardId || i.tech_card_id,
          techCardName: i.techCardName || i.tech_card_name,
        })) : [],
        note: doc.note || '',
        status: doc.status || 'draft',
        created_by: doc.created_by || '',
        warehouse_from: doc.warehouse_from || '',
        warehouse_to: doc.warehouse_to || '',
        doc_date: docDate,
      });
    } catch { setForm(emptyForm(selectedType)); }
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const totalItemsCost = form.items.reduce((s, i) => s + (i.cost || i.quantity * i.pricePerUnit), 0);
      const payload = { ...form, sum: form.sum || totalItemsCost, items: form.items };
      if (editingId) {
        await api.updateDocument(editingId, payload);
      } else {
        await api.createDocument(payload);
      }
      setShowModal(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedId) { addToast('Выберите документ', 'warning'); return; }
    if (!confirm('Удалить документ?')) return;
    try { await api.deleteDocument(selectedId); setSelectedId(null); load(); } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedId) { addToast('Выберите документ', 'warning'); return; }
    try {
      await api.updateDocument(selectedId, { status });
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try { await api.importDocuments(file); load(); } catch (e: any) { addToast(e.message, 'error'); }
    };
    input.click();
  };

  const addItem = (inv: any) => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { itemId: inv.id, itemName: inv.name, quantity: 1, unit: inv.unit || 'шт', pricePerUnit: inv.pricePerUnit || inv.basePrice || 0, cost: inv.pricePerUnit || inv.basePrice || 0 }],
    }));
    setInvSearch('');
    setShowInvDropdown(false);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => {
      const ings = [...prev.items];
      (ings[idx] as any)[field] = value;
      if (field === 'quantity' || field === 'pricePerUnit') {
        ings[idx].cost = ings[idx].quantity * ings[idx].pricePerUnit;
      }
      return { ...prev, items: ings };
    });
  };

  const removeItem = (idx: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const loadTechCardsForItem = async (idx: number, itemId: number) => {
    try {
      const r = await api.getStockItemTechCards(itemId);
      setTechCards(r.items || []);
      setShowTcDropdown(idx);
    } catch { setTechCards([]); }
  };

  const typeLabel = getTypeLabel(selectedType);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <FileText size={22} className="text-blue-500" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{typeLabel}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Поиск по документам..." className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          </div>
          <button onClick={handleSearch} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors">Найти</button>

          <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />

          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} /> Создать
          </button>
          <button onClick={() => selectedId && openEdit(selectedId)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50" disabled={!selectedId}>
            <Edit3 size={16} /> Редактировать
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50" disabled={!selectedId}>
            <Trash2 size={16} /> Удалить
          </button>

          {selectedId && (() => {
            const doc = items.find(d => d.id === selectedId);
            if (!doc || doc.status === 'cancelled' || doc.status === 'completed') return null;
            return (
              <>
                <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
                {doc.status === 'draft' && (
                  <button onClick={() => handleStatusChange('confirmed')} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors">
                    <Check size={16} /> Подтвердить
                  </button>
                )}
                {doc.status === 'confirmed' && (
                  <button onClick={() => handleStatusChange('completed')} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
                    <Check size={16} /> Провести
                  </button>
                )}
                {doc.status !== 'cancelled' && (
                  <button onClick={() => handleStatusChange('cancelled')} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                    <Ban size={16} /> Отменить
                  </button>
                )}
              </>
            );
          })()}

          <button onClick={handleImport} className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors">
            <Upload size={16} /> Импорт
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex-1 overflow-auto">
        {!selectedType ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
            <FileText size={48} className="mb-3 opacity-40" />
            <p className="text-sm">Выберите тип документа слева</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
            <FileText size={48} className="mb-3 opacity-40" />
            <p className="text-sm">Нет документов</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Дата</th>
                <th className="text-left px-4 py-3 font-semibold">Номер</th>
                <th className="text-left px-4 py-3 font-semibold">Контрагент</th>
                <th className="text-left px-4 py-3 font-semibold">Товаров</th>
                <th className="text-right px-4 py-3 font-semibold">Сумма</th>
                <th className="text-center px-4 py-3 font-semibold">Статус</th>
                <th className="text-left px-4 py-3 font-semibold">Склад</th>
              </tr>
            </thead>
            <tbody>
              {items.map((doc: any) => {
                let docItems = [];
                try { docItems = typeof doc.items === 'string' ? JSON.parse(doc.items) : (doc.items || []); } catch {}
                return (
                  <tr key={doc.id}
                    onClick={() => setSelectedId(doc.id)}
                    className={`border-b border-zinc-100 dark:border-zinc-800 text-sm cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${selectedId === doc.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {doc.doc_date ? doc.doc_date.slice(0, 10) : (doc.date ? new Date(doc.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-')}
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-white font-medium">{doc.number || '-'}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{doc.counterparty || '-'}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{docItems.length || '-'}</td>
                    <td className="px-4 py-3 text-right text-zinc-900 dark:text-white font-medium tabular-nums">{(doc.sum || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        doc.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        doc.status === 'confirmed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        doc.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>{STATUS_LABELS[doc.status] || doc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 text-xs">{doc.warehouse_from || doc.warehouse_to ? `${doc.warehouse_from || '?'} → ${doc.warehouse_to || '?'}` : (doc.warehouse_from || doc.warehouse_to || '-')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl mt-4 px-4 py-3 shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span>Показывать по:</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-900 dark:text-white">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="text-sm text-zinc-500">
          Всего: <span className="font-semibold text-zinc-900 dark:text-white">{total}</span> — Стр. <span className="font-semibold text-zinc-900 dark:text-white">{page}</span> из <span className="font-semibold text-zinc-900 dark:text-white">{totalPages}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(1)} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30"><ChevronsLeft size={18} /></button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30"><ChevronLeft size={18} /></button>
          <span className="px-3 text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30"><ChevronRight size={18} /></button>
          <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30"><ChevronsRight size={18} /></button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                {editingId ? `Документ #${editingId}` : `Новый документ: ${getTypeLabel(form.type)}`}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-500">Тип документа</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1">
                    {Object.entries(TYPE_LABELS).filter(([k]) => k !== 'journal').map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Дата документа</label>
                  <input type="date" value={form.doc_date} onChange={e => setForm(f => ({ ...f, doc_date: e.target.value }))}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-500">Контрагент</label>
                  <input value={form.counterparty} onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))} placeholder="Поставщик / получатель"
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Создатель</label>
                  <input value={form.created_by} onChange={e => setForm(f => ({ ...f, created_by: e.target.value }))} placeholder="ФИО"
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
                </div>
              </div>

              {(form.type === 'transfer' || form.type === 'shipment') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-500">Склад (откуда)</label>
                    <input value={form.warehouse_from} onChange={e => setForm(f => ({ ...f, warehouse_from: e.target.value }))} placeholder="Основной склад"
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500">Склад (куда)</label>
                    <input value={form.warehouse_to} onChange={e => setForm(f => ({ ...f, warehouse_to: e.target.value }))} placeholder="Филиал 1"
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-500">Товары</label>
                  <div className="relative">
                    <input value={invSearch} onChange={e => { setInvSearch(e.target.value); setShowInvDropdown(true); }}
                      onFocus={() => setShowInvDropdown(true)} placeholder="Добавить товар..."
                      className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white w-48" />
                    {showInvDropdown && invSearch && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                        {filteredInventory.length === 0 ? <p className="text-xs text-zinc-400 p-3">Ничего не найдено</p> : filteredInventory.map((inv: any) => (
                          <button key={inv.id} onClick={() => addItem(inv)}
                            className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex justify-between">
                            <span>{inv.name}</span>
                            <span className="text-zinc-400">{inv.pricePerUnit || inv.basePrice || 0}₽/{inv.unit} ({inv.currentStock || 0})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {form.items.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-4 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
                    Добавьте товары в документ
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr,70px,60px,80px,80px,auto] gap-2 text-xs text-zinc-500 px-2 mb-1">
                      <span>Товар</span><span>Кол-во</span><span>Ед.</span><span>Цена</span><span>Стоимость</span><span></span>
                    </div>
                    {form.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr,70px,60px,80px,80px,auto] gap-2 items-center bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm text-zinc-900 dark:text-white truncate">{item.itemName}</span>
                          {(form.type === 'production' || form.type === 'breakdown' || form.type === 'processing') && (
                            <button onClick={() => loadTechCardsForItem(idx, item.itemId)} className="text-xs text-blue-500 hover:underline shrink-0 ml-1" title="Выбрать техкарту">
                              {item.techCardName ? `📋${item.techCardName}` : '📋'}
                            </button>
                          )}
                          {showTcDropdown === idx && techCards.length > 0 && (
                            <div className="absolute z-20 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-32 overflow-y-auto">
                              {techCards.map((tc: any) => (
                                <button key={tc.id} onClick={() => { updateItem(idx, 'techCardId', tc.id); updateItem(idx, 'techCardName', tc.number || tc.name); setShowTcDropdown(null); }}
                                  className="block w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700">{tc.number || tc.name}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input type="number" step="0.001" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-center" />
                        <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-1 py-1 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                          {['шт', 'кг', 'г', 'л', 'мл'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input type="number" step="0.01" value={item.pricePerUnit || ''} onChange={e => updateItem(idx, 'pricePerUnit', Number(e.target.value))}
                          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-center" />
                        <span className="text-xs text-zinc-600 text-right">{(item.cost || item.quantity * item.pricePerUnit).toLocaleString()}₽</span>
                        <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600"><X size={14} /></button>
                      </div>
                    ))}
                    <div className="text-right text-sm font-medium text-blue-600 dark:text-blue-400">
                      Итого: {form.items.reduce((s, i) => s + (i.cost || i.quantity * i.pricePerUnit), 0).toLocaleString()}₽
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500">Примечание</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} placeholder="Примечание к документу..."
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 disabled:opacity-50">
                {saving ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Создать документ'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-6 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium py-3 rounded-xl text-sm hover:bg-zinc-300 dark:hover:bg-zinc-600">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
