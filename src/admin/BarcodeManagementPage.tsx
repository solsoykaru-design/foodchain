import { useState, useEffect } from 'react';
import { addToast } from '../ToastContext';
import * as api from '../api';
import { Printer, Plus, Search, Barcode, RefreshCw, CheckSquare, Square, Package, Utensils } from 'lucide-react';

function formatBarcode(code: string): string {
  if (!code || code.length !== 13) return code || '—';
  return `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6, 9)}-${code.slice(9)}`;
}

export default function BarcodeManagementPage() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'dishes'>('inventory');
  const [items, setItems] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);

  const loadItems = () => {
    setLoading(true);
    api.get('/api/inventory-items').then(r => {
      setItems(r.items || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  const loadDishes = () => {
    setLoading(true);
    api.getDishes().then((r: any) => {
      const list = Array.isArray(r) ? r : (r.items || []);
      setDishes(list);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'inventory') loadItems();
    else loadDishes();
  }, [activeTab]);

  const currentList = activeTab === 'inventory' ? items : dishes;

  const filtered = currentList.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.name || '').toLowerCase().includes(q) || (i.barcode || '').includes(q) || (i.article || '').toLowerCase().includes(q);
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  const generateBarcode = async (item: any) => {
    try {
      const data = await api.generateBarcode();
      const barcode = data.barcode;
      if (activeTab === 'inventory') {
        await api.put(`/api/inventory-items/${item.id}`, { barcode });
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, barcode } : i));
      } else {
        await api.put(`/api/dishes/${item.id}`, { barcode });
        setDishes(prev => prev.map(i => i.id === item.id ? { ...i, barcode } : i));
      }
      addToast(`Штрихкод ${formatBarcode(barcode)} создан для "${item.name}"`, 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const generateAllMissing = async () => {
    const missing = currentList.filter(i => !i.barcode);
    if (missing.length === 0) { addToast('У всех товаров уже есть штрихкоды', 'info'); return; }
    setGenerating(true);
    let ok = 0;
    for (const item of missing) {
      try {
        const data = await api.generateBarcode();
        if (activeTab === 'inventory') {
          await api.put(`/api/inventory-items/${item.id}`, { barcode: data.barcode });
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, barcode: data.barcode } : i));
        } else {
          await api.put(`/api/dishes/${item.id}`, { barcode: data.barcode });
          setDishes(prev => prev.map(i => i.id === item.id ? { ...i, barcode: data.barcode } : i));
        }
        ok++;
      } catch {}
    }
    addToast(`Создано штрихкодов: ${ok} из ${missing.length}`, ok === missing.length ? 'success' : 'warning');
    setGenerating(false);
  };

  const printLabels = () => {
    if (selectedIds.size === 0) { addToast('Выберите товары для печати', 'info'); return; }
    api.printBarcodes(Array.from(selectedIds), activeTab);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
          <Barcode className="text-blue-500" size={28} />
          Штрихкоды
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={activeTab === 'inventory' ? loadItems : loadDishes} className="p-2 text-zinc-500 hover:text-blue-500 transition active:scale-[0.97]" title="Обновить">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => { setActiveTab('inventory'); setSearch(''); setSelectedIds(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'inventory' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
          <Package size={16} /> Товары
        </button>
        <button onClick={() => { setActiveTab('dishes'); setSearch(''); setSelectedIds(new Set()); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'dishes' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
          <Utensils size={16} /> Блюда
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию или штрихкоду..."
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl pl-9 pr-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
          </div>
          <button onClick={generateAllMissing} disabled={generating}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition active:scale-[0.97]">
            <Plus size={16} /> {generating ? 'Генерация...' : 'Создать для всех без штрихкода'}
          </button>
          <button onClick={printLabels}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition active:scale-[0.97]">
            <Printer size={16} /> Печать ({selectedIds.size})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-3 pr-2 text-left w-10">
                  <button onClick={toggleAll} className="text-zinc-400 hover:text-zinc-600 transition">
                    {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </th>
                <th className="py-3 pr-4 text-left text-zinc-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Название</th>
                <th className="py-3 pr-4 text-left text-zinc-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Артикул</th>
                <th className="py-3 pr-4 text-left text-zinc-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Штрихкод</th>
                <th className="py-3 text-left text-zinc-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                  <td className="py-3 pr-2">
                    <button onClick={() => toggleSelect(item.id)} className="text-zinc-400 hover:text-zinc-600 transition">
                      {selectedIds.has(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </td>
                  <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-white">{item.name}</td>
                  <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400">{item.article || '—'}</td>
                  <td className="py-3 pr-4">
                    <span className="font-mono text-sm tracking-wider text-zinc-700 dark:text-zinc-300">
                      {item.barcode ? formatBarcode(item.barcode) : <span className="text-zinc-400 italic">нет</span>}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {!item.barcode && (
                        <button onClick={() => generateBarcode(item)}
                          className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition active:scale-[0.97]">
                          <Plus size={12} /> Сгенерировать
                        </button>
                      )}
                      {item.barcode && (
                        <button onClick={() => { setSelectedIds(new Set([item.id])); printLabels(); }}
                          className="flex items-center gap-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition active:scale-[0.97]">
                          <Printer size={12} /> Печать
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-zinc-400">Ничего не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-zinc-400">
          Всего: {currentList.length} · Отфильтровано: {filtered.length} · Без штрихкода: {currentList.filter(i => !i.barcode).length}
          {selectedIds.size > 0 && ` · Выбрано: ${selectedIds.size}`}
        </div>
      </div>
    </div>
  );
}
