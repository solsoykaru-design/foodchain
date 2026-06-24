import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Search, Upload } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

const UNIT_OPTIONS = ['кг', 'г', 'л', 'мл', 'шт'];

interface IngredientRow {
  tempId: number;
  itemId: number | null;
  name: string;
  unit: string;
  quantity: number;
  brutto: number;
  coldLoss: number;
  heatLoss: number;
  yield_: number;
}

interface Props {
  sourceItemId: number;
  sourceItemName: string;
  sourceItemUnit: string;
  sourceItemBrutto: number;
  sourceItemColdLoss: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function CreateTechCardModal({ sourceItemId, sourceItemName, sourceItemUnit, sourceItemBrutto, sourceItemColdLoss, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCommon, setIsCommon] = useState(false);
  const [isIndividual, setIsIndividual] = useState(true);
  const [store, setStore] = useState('');
  const [typeElement, setTypeElement] = useState('stock');
  const [constantCosts, setConstantCosts] = useState('');
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 16));
  const [normWeight, setNormWeight] = useState('1.000');
  const [saving, setSaving] = useState(false);

  // Ingredients
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { tempId: 1, itemId: sourceItemId, name: sourceItemName, unit: sourceItemUnit, quantity: 1, brutto: sourceItemBrutto, coldLoss: sourceItemColdLoss, heatLoss: 0, yield_: sourceItemBrutto }
  ]);
  let nextTempId = 2;

  // Autocomplete
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const totalYield = ingredients.reduce((s, r) => s + (r.yield_ || 0), 0);

  useEffect(() => {
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  const addIngredient = () => {
    setIngredients(prev => [...prev, { tempId: nextTempId++, itemId: null, name: '', unit: 'кг', quantity: 1, brutto: 0, coldLoss: 0, heatLoss: 0, yield_: 0 }]);
  };

  const removeIngredient = (tempId: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(prev => prev.filter(r => r.tempId !== tempId));
  };

  const updateIngredient = (tempId: number, field: keyof IngredientRow, value: any) => {
    setIngredients(prev => prev.map(r => {
      if (r.tempId !== tempId) return r;
      const updated = { ...r, [field]: value };
      if (field === 'itemId' && value) {
        const item = searchResults.find(s => s.id === value);
        if (item) {
          updated.name = item.name || '';
          updated.unit = item.unit || 'кг';
          updated.brutto = item.brutto || 0;
          updated.coldLoss = item.cold_loss_percent || 0;
        }
      }
      if (field === 'brutto' || field === 'coldLoss' || field === 'heatLoss') {
        const b = field === 'brutto' ? value : r.brutto;
        const cl = field === 'coldLoss' ? value : r.coldLoss;
        const hl = field === 'heatLoss' ? value : r.heatLoss;
        const afterCold = b * (1 - (cl || 0) / 100);
        const afterHeat = afterCold * (1 - (hl || 0) / 100);
        updated.yield_ = Math.round(afterHeat * 1000) / 1000;
      }
      return updated;
    }));
  };

  const handleSearch = (q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { setSearchResults(await api.searchStockItems(q)); }
      catch {} finally { setSearching(false); }
    }, 300);
  };

  const handleSave = async () => {
    if (!name.trim()) { addToast('Введите название техкарты', 'warning'); return; }
    if (ingredients.length === 0) { addToast('Добавьте хотя бы один ингредиент', 'warning'); return; }
    setSaving(true);
    try {
      const tcType = isIndividual ? 'individual' : 'general';
      await api.createStockTechCard({
        name: name.trim(),
        description,
        type: tcType,
        store: store || undefined,
        validFrom: validFrom ? new Date(validFrom).toISOString() : null,
        constantCosts: parseFloat(constantCosts) || 0,
        output: totalYield,
        totalYield,
        grossWeight: totalYield,
        itemId: sourceItemId,
        ingredients: ingredients.map((r, i) => ({
          itemId: r.itemId,
          itemName: r.name,
          unit: r.unit,
          quantity: r.quantity,
          brutto: r.brutto,
          coldLossPercent: r.coldLoss,
          heatLossPercent: r.heatLoss,
          netto: r.yield_,
          yield: r.yield_,
          sortOrder: i,
        })),
      });
      onSaved();
      onClose();
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleClear = () => {
    if (!confirm('Очистить все поля?')) return;
    setName('');
    setDescription('');
    setConstantCosts('');
    setValidFrom(new Date().toISOString().slice(0, 16));
    setNormWeight('1.000');
    setIngredients([{ tempId: 1, itemId: sourceItemId, name: sourceItemName, unit: sourceItemUnit, quantity: 1, brutto: sourceItemBrutto, coldLoss: sourceItemColdLoss, heatLoss: 0, yield_: sourceItemBrutto }]);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-[1000px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Техкарта</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* 2.1 Technology description */}
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Технология приготовления</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none" />
          </div>

          {/* 2.1 Type + Store */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Тип элемента</label>
              <select value={typeElement} onChange={e => setTypeElement(e.target.value)}
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                <option value="stock">Складской элемент</option>
                <option value="dish">Блюдо</option>
                <option value="semi">Полуфабрикат</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Магазин / Склад</label>
              <input value={store} onChange={e => setStore(e.target.value)}
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div className="flex items-end gap-4 pb-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isCommon} onChange={e => setIsCommon(e.target.checked)} className="rounded" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Общая</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isIndividual} onChange={e => setIsIndividual(e.target.checked)} className="rounded" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Индивидуальная</span>
              </label>
            </div>
            <div className="flex items-end pb-2.5">
              <button className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                <Upload size={16} /> Загрузить текстуру
              </button>
            </div>
          </div>

          {/* 2.2 Ingredients table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Ингредиенты</h3>
              <button onClick={addIngredient} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition">
                <Plus size={14} /> Добавить ингредиент
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left px-2 py-2 text-xs font-medium text-zinc-500 min-w-[160px]">Название</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-zinc-500 w-20">Ед. Изм.</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-zinc-500 w-20">Кол-во</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-zinc-500 w-24">Брутто, кг</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-zinc-500 w-24">Потери х/о, %</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-zinc-500 w-24">Потери т/о, %</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-zinc-500 w-24">Выход, кг</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((row) => (
                    <tr key={row.tempId} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-2 py-1.5 relative">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                          <input value={row.name} onChange={e => { updateIngredient(row.tempId, 'name', e.target.value); handleSearch(e.target.value); }}
                            className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                          {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
                              {searchResults.map(r => (
                                <button key={r.id} type="button" onMouseDown={() => { updateIngredient(row.tempId, 'itemId', r.id); setSearchResults([]); }}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 text-zinc-700 dark:text-zinc-300">
                                  {r.name} <span className="text-zinc-400 text-xs">({r.unit || 'шт'})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={row.unit} onChange={e => updateIngredient(row.tempId, 'unit', e.target.value)}
                          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                          {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.001" value={row.quantity} onChange={e => updateIngredient(row.tempId, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.001" value={row.brutto} onChange={e => updateIngredient(row.tempId, 'brutto', parseFloat(e.target.value) || 0)}
                          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.1" value={row.coldLoss} onChange={e => updateIngredient(row.tempId, 'coldLoss', parseFloat(e.target.value) || 0)}
                          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.1" value={row.heatLoss} onChange={e => updateIngredient(row.tempId, 'heatLoss', parseFloat(e.target.value) || 0)}
                          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input readOnly value={row.yield_.toFixed(3)}
                          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed" />
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeIngredient(row.tempId)} disabled={ingredients.length <= 1}
                          className="p-1 text-zinc-400 hover:text-red-500 disabled:opacity-30 transition">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2.3 Bottom fields */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Постоянные расходы</label>
              <input type="number" step="0.01" value={constantCosts} onChange={e => setConstantCosts(e.target.value)}
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Действительно с</label>
              <input type="datetime-local" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Суммарный выход, кг</label>
              <input readOnly value={totalYield.toFixed(3)}
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Техкарта составлена на (норма закладки):</label>
              <input type="number" step="0.001" value={normWeight} onChange={e => setNormWeight(e.target.value)}
                className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <button onClick={handleClear} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-red-500 transition">
            <Trash2 size={14} /> Очистить все
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-[0.97]">
              Отмена
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition active:scale-[0.97]">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
