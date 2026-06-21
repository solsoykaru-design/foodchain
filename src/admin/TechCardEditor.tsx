import { useState, useEffect, useMemo, useCallback } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { X, Edit3, Copy, Trash2, ChevronLeft, Save, RotateCcw } from 'lucide-react';

const UNITS = ['г', 'кг', 'мл', 'л', 'шт'];

function DecInput({ value, onChange, step = '0.001', className = '' }: { value: number; onChange: (v: number) => void; step?: string; className?: string }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(value ? value.toFixed(3) : ''); }, [value, focused]);
  return (
    <input
      type="text"
      inputMode="decimal"
      step={step}
      value={focused ? text : (value ? value.toFixed(3) : '0.000')}
      onChange={e => { setText(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n); }}
      onFocus={() => { setFocused(true); setText(value ? String(value) : ''); }}
      onBlur={() => { setFocused(false); }}
      className={className}
    />
  );
}

interface IngForm {
  id?: number;
  item_id: number | null;
  item_name: string;
  quantity: number;
  unit: string;
  netto: number;
  cold_loss_percent: number;
  cold_loss_kg: number;
  heat_loss_percent: number;
  heat_loss_kg: number;
  brutto: number;
  yield_kg: number;
  price_per_unit: number;
  cost: number;
}

interface Props {
  techCardId: number;
  onClose: () => void;
  onSaved: () => void;
}

function makeIng(): IngForm {
  return {
    item_id: null, item_name: '', quantity: 0, unit: 'кг', netto: 0,
    cold_loss_percent: 0, cold_loss_kg: 0, heat_loss_percent: 0, heat_loss_kg: 0,
    brutto: 0, yield_kg: 0, price_per_unit: 0, cost: 0,
  };
}

export default function TechCardEditor({ techCardId, onClose, onSaved }: Props) {
  const [tc, setTc] = useState<any>(null);
  const [dishName, setDishName] = useState('');
  const [dishType, setDishType] = useState('Общая');
  const [createdAt, setCreatedAt] = useState('');
  const [ingredients, setIngredients] = useState<IngForm[]>([]);
  const [technology, setTechnology] = useState('');
  const [description, setDescription] = useState('');
  const [cookingTime, setCookingTime] = useState(0);
  const [output, setOutput] = useState(0);
  const [validFrom, setValidFrom] = useState('');
  const [portions, setPortions] = useState(1);
  const [fixedCosts, setFixedCosts] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [version, setVersion] = useState(1);
  const [stepMode, setStepMode] = useState(false);
  const [stepInstructions, setStepInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [inventory, setInventory] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [allTc, setAllTc] = useState<any[]>([]);
  const [copyFrom, setCopyFrom] = useState('');
  const [tab, setTab] = useState<'tc' | 'writeoff' | 'technology' | 'kbju' | 'packaging'>('tc');
  const [ingSearchIdx, setIngSearchIdx] = useState<number | null>(null);
  const [ingSearchVal, setIngSearchVal] = useState('');

  const loadTc = useCallback(async () => {
    try {
      const data = await api.getDishTechCard(techCardId);
      setTc(data);
      setDishName(data.dish_name || data.dish_name_db || '');
      setDishType('Общая');
      setCreatedAt(data.created_at || '');
      setTechnology(data.technology || '');
      setDescription(data.description || '');
      setCookingTime(data.cooking_time || 0);
      setOutput(data.output || 0);
      setValidFrom(data.valid_from || '');
      setPortions(data.portions || 1);
      setFixedCosts(data.fixed_costs || 0);
      setIsActive(data.is_active !== 0);
      setVersion(data.version || 1);
      setStepMode(!!data.step_mode);
      setStepInstructions(data.step_instructions || '');

      const ings = (data.ingredients || []).map((i: any) => {
        const qty = i.quantity || 0;
        const unit = i.unit || 'кг';
        const brutto = unit === 'кг' ? qty : unit === 'г' ? qty / 1000 : unit === 'л' ? qty : unit === 'мл' ? qty / 1000 : qty;
        const coldPct = i.cold_loss_percent || 0;
        const coldKg = brutto * (coldPct / 100);
        const netto = brutto - coldKg;
        const heatPct = i.heat_loss_percent || 0;
        const heatKg = netto * (heatPct / 100);
        const yieldKg = netto - heatKg;
        const price = i.price_per_unit || i.last_price || 0;
        return {
          id: i.id,
          item_id: i.item_id,
          item_name: i.item_name || i.item_name_inv || '',
          quantity: qty,
          unit,
          netto,
          cold_loss_percent: coldPct,
          cold_loss_kg: coldKg,
          heat_loss_percent: heatPct,
          heat_loss_kg: heatKg,
          brutto,
          yield_kg: yieldKg,
          price_per_unit: price,
          cost: Math.round(price * yieldKg * 100) / 100,
        };
      });
      setIngredients(ings);
    } catch (e: any) { addToast(e.message, 'error'); } finally { setLoading(false); }
  }, [techCardId]);

  useEffect(() => { loadTc(); }, [loadTc]);

  useEffect(() => {
    Promise.all([
      api.request('/api/inventory-items').then((r: any) => setInventory(Array.isArray(r) ? r : r.items || [])),
      api.request('/api/dishes').then((r: any) => setDishes(Array.isArray(r) ? r : r.items || [])),
      api.getDishTechCards({ limit: 200 }).then((r: any) => setAllTc(r.items || [])),
    ]).catch(() => {});
  }, []);

  const safeInventory = Array.isArray(inventory) ? inventory : [];

  const recalcIng = (ing: IngForm): IngForm => {
    const qty = ing.quantity;
    const bruttoByUnit = ing.unit === 'г' ? qty / 1000 : ing.unit === 'мл' ? qty / 1000 : qty;
    const brutto = ing.brutto > 0 ? ing.brutto : bruttoByUnit;
    const coldKg = brutto * (ing.cold_loss_percent / 100);
    const netto = brutto - coldKg;
    const heatKg = netto * (ing.heat_loss_percent / 100);
    const yieldKg = netto - heatKg;
    const price = ing.price_per_unit || 0;
    return { ...ing, brutto, cold_loss_kg: coldKg, netto, heat_loss_kg: heatKg, yield_kg: yieldKg, cost: Math.round(price * yieldKg * 100) / 100 };
  };

  const updateIng = (idx: number, field: string, value: any) => {
    setIngredients(prev => {
      const arr = [...prev];
      const updated = { ...arr[idx], [field]: value };
      // When quantity or unit changes, auto-calc brutto
      if (field === 'quantity' || field === 'unit') {
        updated.brutto = 0; // reset so recalcIng uses auto-calc
      }
      arr[idx] = recalcIng(updated);
      return arr;
    });
  };

  const addIng = () => setIngredients(prev => [...prev, makeIng()]);
  const removeIng = (idx: number) => setIngredients(prev => prev.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    const totalBrutto = ingredients.reduce((s, i) => s + i.brutto, 0);
    const totalColdLoss = ingredients.reduce((s, i) => s + i.cold_loss_kg, 0);
    const totalNetto = ingredients.reduce((s, i) => s + i.netto, 0);
    const totalHeatLoss = ingredients.reduce((s, i) => s + i.heat_loss_kg, 0);
    const totalYield = ingredients.reduce((s, i) => s + i.yield_kg, 0);
    const totalCost = ingredients.reduce((s, i) => s + i.cost, 0) + fixedCosts;
    const yieldGrams = Math.round(totalYield * 1000);
    const outputPerPortion = portions > 0 ? totalYield / portions : totalYield;
    return { totalBrutto, totalColdLoss, totalNetto, totalHeatLoss, totalYield, totalCost, yieldGrams, outputPerPortion };
  }, [ingredients, fixedCosts, portions]);

  const copyFromTc = async () => {
    if (!copyFrom) return;
    if (!confirm('Заменить текущие ингредиенты данными из выбранной техкарты?')) return;
    try {
      const src = await api.getDishTechCard(Number(copyFrom));
      const ings = (src.ingredients || []).map((i: any) => {
        const qty = i.quantity || 0;
        const unit = i.unit || 'кг';
        const brutto = unit === 'кг' ? qty : unit === 'г' ? qty / 1000 : unit === 'л' ? qty : unit === 'мл' ? qty / 1000 : qty;
        const coldPct = i.cold_loss_percent || 0;
        const coldKg = brutto * (coldPct / 100);
        const netto = brutto - coldKg;
        const heatPct = i.heat_loss_percent || 0;
        const heatKg = netto * (heatPct / 100);
        const yieldKg = netto - heatKg;
        const price = i.price_per_unit || i.last_price || 0;
        return { item_id: i.item_id, item_name: i.item_name || i.item_name_inv || '', quantity: qty, unit, netto, cold_loss_percent: coldPct, cold_loss_kg: coldKg, heat_loss_percent: heatPct, heat_loss_kg: heatKg, brutto, yield_kg: yieldKg, price_per_unit: price, cost: Math.round(price * yieldKg * 100) / 100 };
      });
      setIngredients(ings);
      setTechnology(src.technology || '');
      setCookingTime(src.cooking_time || 0);
      setCopyFrom('');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const save = async () => {
    if (!dishName.trim()) return addToast('Введите название блюда', 'error');
    setSaving(true);
    try {
      await api.updateDishTechCard(techCardId, {
        dish_name: dishName.trim(),
        ingredients: ingredients.map(i => ({
          item_id: i.item_id,
          item_name: i.item_name,
          quantity: i.quantity,
          unit: i.unit,
          netto: i.netto,
          cold_loss_percent: i.cold_loss_percent,
          heat_loss_percent: i.heat_loss_percent,
          yield_percent: 100,
        })),
        technology,
        description,
        cooking_time: cookingTime,
        output: totals.yieldGrams,
        is_active: isActive,
        version,
        step_mode: stepMode,
        step_instructions: stepInstructions,
      });
      onSaved();
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const clearAll = () => {
    if (!confirm('Очистить все ингредиенты?')) return;
    setIngredients([]);
  };

  const filteredInventory = useMemo(() => {
    if (!ingSearchVal) return [];
    return safeInventory.filter((i: any) => i.name?.toLowerCase().includes(ingSearchVal.toLowerCase())).slice(0, 10);
  }, [safeInventory, ingSearchVal]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"><ChevronLeft size={20} /></button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{dishName || `Техкарта #${techCardId}`}</h2>
              <span className="text-sm text-zinc-500">Тип: {dishType}</span>
              <span className="text-sm text-zinc-400">Создана: {createdAt ? new Date(createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-blue-600 disabled:opacity-50">
            <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"><X size={20} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-zinc-200 dark:border-zinc-700">
        {([
          { id: 'tc' as const, label: 'Техкарта' },
          { id: 'writeoff' as const, label: 'Списание по складам' },
          { id: 'technology' as const, label: 'Технология приготовления' },
          { id: 'packaging' as const, label: 'Упаковка' },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Техкарта */}
      {tab === 'tc' && (
        <div className="space-y-4">
          {/* Copy toolbar */}
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Копировать техкарту из:</label>
              <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)}
                className="border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white min-w-[250px]">
                <option value="">Выберите техкарту...</option>
                {allTc.filter((t: any) => t.id !== techCardId).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.dish_name} (v{t.version || 1})</option>
                ))}
              </select>
            </div>
            <button onClick={copyFromTc} disabled={!copyFrom} className="px-4 py-2 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30">
              Загрузить техкарту
            </button>
            <div className="flex-1" />
            <button onClick={clearAll} className="px-4 py-2 text-sm font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30">
              Очистить все
            </button>
          </div>

          {/* Ingredients Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs">
                  <th className="text-left py-2 px-2 w-8">#</th>
                  <th className="text-left py-2 px-2 min-w-[180px]">Название</th>
                  <th className="text-center py-2 px-2 w-16">Ед. Изм.</th>
                  <th className="text-right py-2 px-2 w-20">Кол-во</th>
                  <th className="text-right py-2 px-2 w-24">Брутто, кг</th>
                  <th className="text-center py-2 px-2" colSpan={2}>Потери холодной обработки</th>
                  <th className="text-right py-2 px-2 w-24">Нетто, кг</th>
                  <th className="text-center py-2 px-2" colSpan={2}>Потери тепловой обработки</th>
                  <th className="text-right py-2 px-2 w-24">Выход, кг</th>
                  <th className="w-8"></th>
                </tr>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 text-[10px]">
                  <th></th><th></th><th></th><th></th><th></th>
                  <th className="text-center py-0 px-1">%</th>
                  <th className="text-center py-0 px-1">кг</th>
                  <th></th>
                  <th className="text-center py-0 px-1">%</th>
                  <th className="text-center py-0 px-1">кг</th>
                  <th></th><th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {ingredients.map((ing, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="py-1.5 px-2 text-xs text-zinc-400 text-center">{idx + 1}</td>
                    <td className="py-1.5 px-2 relative">
                      <div className="relative">
                        <input value={ingSearchIdx === idx ? ingSearchVal : ing.item_name}
                          onChange={e => {
                            setIngSearchIdx(idx);
                            setIngSearchVal(e.target.value);
                            updateIng(idx, 'item_name', e.target.value);
                            updateIng(idx, 'item_id', null);
                          }}
                          onFocus={() => { setIngSearchIdx(idx); setIngSearchVal(ing.item_name); }}
                          onBlur={() => setTimeout(() => { setIngSearchIdx(null); setIngSearchVal(''); }, 200)}
                          placeholder="Название..."
                          className="w-full px-2 py-1 text-xs bg-transparent border border-transparent focus:border-blue-300 rounded text-blue-600 dark:text-blue-400 font-medium" />
                        {ingSearchIdx === idx && ingSearchVal && filteredInventory.length > 0 && (
                          <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto">
                            {filteredInventory.map((inv: any) => (
                              <button key={inv.id} onMouseDown={(e) => {
                                e.preventDefault();
                                const price = inv.price_per_unit || inv.last_price || 0;
                                setIngredients(prev => {
                                  const arr = [...prev];
                                  arr[idx] = recalcIng({ ...arr[idx], item_id: inv.id, item_name: inv.name, unit: inv.unit || 'кг', price_per_unit: price });
                                  return arr;
                                });
                                setIngSearchIdx(null);
                                setIngSearchVal('');
                              }} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 flex justify-between">
                                <span className="text-zinc-900 dark:text-white">{inv.name}</span>
                                <span className="text-zinc-400">{inv.price_per_unit || inv.last_price || 0}₽/{inv.unit || 'кг'}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <select value={ing.unit} onChange={e => updateIng(idx, 'unit', e.target.value)}
                        className="px-1 py-1 text-xs bg-transparent border border-transparent focus:border-blue-300 rounded text-zinc-700 dark:text-zinc-300">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <DecInput value={ing.quantity} onChange={v => updateIng(idx, 'quantity', v)}
                        className="w-full px-2 py-1 text-xs text-right bg-transparent border border-transparent focus:border-blue-300 rounded text-zinc-900 dark:text-white" />
                    </td>
                    <td className="py-1.5 px-2 text-right text-xs text-zinc-600 dark:text-zinc-400">
                      <DecInput value={ing.brutto} onChange={v => updateIng(idx, 'brutto', v)}
                        className="w-full px-1 py-1 text-xs text-right bg-transparent border border-transparent focus:border-blue-300 rounded text-zinc-900 dark:text-white" />
                    </td>
                    <td className="py-1.5 px-1">
                      <DecInput value={ing.cold_loss_percent} onChange={v => updateIng(idx, 'cold_loss_percent', v)} step="0.01"
                        className="w-full px-1 py-1 text-xs text-right bg-transparent border border-transparent focus:border-blue-300 rounded text-zinc-900 dark:text-white" />
                    </td>
                    <td className="py-1.5 px-1 text-right text-xs text-zinc-500">{ing.cold_loss_kg.toFixed(3)}</td>
                    <td className="py-1.5 px-2 text-right text-xs text-zinc-600 dark:text-zinc-400">{ing.netto.toFixed(3)}</td>
                    <td className="py-1.5 px-1">
                      <DecInput value={ing.heat_loss_percent} onChange={v => updateIng(idx, 'heat_loss_percent', v)} step="0.01"
                        className="w-full px-1 py-1 text-xs text-right bg-transparent border border-transparent focus:border-blue-300 rounded text-zinc-900 dark:text-white" />
                    </td>
                    <td className="py-1.5 px-1 text-right text-xs text-zinc-500">{ing.heat_loss_kg.toFixed(3)}</td>
                    <td className="py-1.5 px-2 text-right text-xs font-medium text-zinc-700 dark:text-zinc-300">{ing.yield_kg.toFixed(3)}</td>
                    <td className="py-1.5 px-1">
                      <button onClick={() => removeIng(idx)} className="p-0.5 text-zinc-300 hover:text-red-500"><X size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={addIng} className="text-xs text-blue-500 hover:text-blue-700 font-medium">+ Добавить строку</button>
            </div>
          </div>

          {/* Bottom sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Постоянные расходы</label>
                <DecInput value={fixedCosts} onChange={setFixedCosts} step="0.01"
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Действительна с *</label>
                <input type="datetime-local" value={validFrom}
                  onChange={e => setValidFrom(e.target.value)}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Описание</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-y" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500 mb-1 block">Время готовки (мин)</label>
                  <DecInput value={cookingTime} onChange={setCookingTime}
                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Активна</span>
                </div>
              </div>
            </div>

            {/* Right - Summary */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Суммарный выход, кг</span><span className="font-bold text-zinc-900 dark:text-white">{totals.totalYield.toFixed(3)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Выход 1 порции, кг</span><span className="font-bold text-zinc-900 dark:text-white">{totals.outputPerPortion.toFixed(3)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Выход 1 порции с упаковкой, кг</span><span className="font-bold text-zinc-900 dark:text-white">{totals.outputPerPortion.toFixed(3)}</span></div>
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <label className="text-xs font-medium text-zinc-500 mb-2 block">Техкарта составлена на (норма закладки):</label>
                <div className="flex items-center gap-2">
                  <DecInput value={portions} onChange={setPortions}
                    className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  <span className="text-sm text-zinc-500">шт</span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Себестоимость всего по техкарте</span><span className="font-bold text-blue-600 dark:text-blue-400">{totals.totalCost.toFixed(3)} ₽</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Себестоимость 1 порции</span><span className="font-bold text-blue-600 dark:text-blue-400">{(totals.totalCost / (portions || 1)).toFixed(3)} ₽</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Себестоимость упаковки</span><span className="font-medium text-zinc-900 dark:text-white">0,000 ₽</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Себестоимость 1 порции с упаковкой</span><span className="font-bold text-blue-600 dark:text-blue-400">{(totals.totalCost / (portions || 1)).toFixed(3)} ₽</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Технология */}
      {tab === 'technology' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 block">Технология приготовления</label>
            <textarea value={technology} onChange={e => setTechnology(e.target.value)} rows={16}
              placeholder="Пошаговое описание процесса приготовления..."
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-y" />
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={stepMode} onChange={e => setStepMode(e.target.checked)} className="rounded" />
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Пошаговый режим (KDS)</label>
            </div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 block">Пошаговая инструкция</label>
            <textarea value={stepInstructions} onChange={e => setStepInstructions(e.target.value)} rows={8}
              placeholder="Описание каждого шага приготовления..."
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-y" />
          </div>
        </div>
      )}

      {/* Tab: Списание */}
      {tab === 'writeoff' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
          <p className="text-sm text-zinc-500 mb-4">Автоматическое списание происходит при переводе заказа в статус «Готов к выдаче».</p>
          <div className="space-y-1">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-700 dark:text-zinc-300">{ing.item_name || `Ингредиент ${idx + 1}`}</span>
                <span className="text-zinc-500">{ing.quantity} {ing.unit} → {ing.yield_kg.toFixed(3)} кг</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Упаковка */}
      {tab === 'packaging' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500">Стоимость упаковки, ₽</label>
              <input type="text" inputMode="decimal" value="0.000"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Тип упаковки</label>
              <input type="text" placeholder="Контейнер 500мл"
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
