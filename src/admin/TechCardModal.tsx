import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, History, Edit3 } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

interface Ingredient {
  id?: number;
  itemId: number | null;
  itemName: string;
  quantity: number;
  unit: string;
  netto: number;
  coldLossPercent: number;
  heatLossPercent: number;
  yieldPercent: number;
  cost?: number;
}

interface Props {
  dishId: number;
  dishName: string;
  dishPrice?: number;
  onClose: () => void;
}

const UNITS = ['г', 'кг', 'мл', 'л', 'шт', 'порция'];

export default function TechCardModal({ dishId, dishName, dishPrice, onClose }: Props) {
  const [tc, setTc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [editData, setEditData] = useState<{
    ingredients: Ingredient[];
    technology: string;
    description: string;
    cookingTime: number;
    output: number;
    stepMode: boolean;
    stepInstructions: string;
  }>({ ingredients: [], technology: '', description: '', cookingTime: 0, output: 0, stepMode: false, stepInstructions: '' });
  const [saving, setSaving] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTc();
  }, [dishId]);

  const loadTc = () => {
    setLoading(true);
    api.request(`/api/dishes/${dishId}/tech-card`)
      .then(setTc)
      .catch(() => setTc(null))
      .finally(() => setLoading(false));
  };

  const startEdit = () => {
    if (!tc) return;
    setEditData({
      ingredients: (tc.ingredients || []).map((ing: any) => ({
        itemId: ing.item_id,
        itemName: ing.item_name,
        quantity: ing.quantity || 0,
        unit: ing.unit || 'г',
        netto: ing.netto || 0,
        coldLossPercent: ing.cold_loss_percent || 0,
        heatLossPercent: ing.heat_loss_percent || 0,
        yieldPercent: ing.yield_percent || 100,
        cost: ing.cost || 0,
      })),
      technology: tc.technology || '',
      description: tc.description || '',
      cookingTime: tc.cooking_time || 0,
      output: tc.output || 0,
      stepMode: !!tc.step_mode,
      stepInstructions: tc.step_instructions || '',
    });
    setEditing(true);
    loadInventoryItems();
  };

  const loadInventoryItems = () => {
    api.request('/api/inventory-items')
      .then((items: any) => setInventoryItems(items || []))
      .catch(() => setInventoryItems([]));
  };

  const loadVersions = () => {
    api.request(`/api/dishes/${dishId}/tech-card/versions`)
      .then((v: any) => setVersions(v || []))
      .catch(() => setVersions([]));
    setShowVersions(true);
  };

  const addIngredient = () => {
    setEditData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, {
        itemId: null,
        itemName: '',
        quantity: 0,
        unit: 'г',
        netto: 0,
        coldLossPercent: 0,
        heatLossPercent: 0,
        yieldPercent: 100,
        cost: 0,
      }],
    }));
  };

  const updateIngredient = (idx: number, field: string, value: any) => {
    setEditData(prev => {
      const newIngs = [...prev.ingredients];
      newIngs[idx] = { ...newIngs[idx], [field]: value };
      if (field === 'itemId' && value) {
        const item = inventoryItems.find((i: any) => i.id === value);
        if (item) newIngs[idx].itemName = item.name;
      }
      return { ...prev, ingredients: newIngs };
    });
  };

  const removeIngredient = (idx: number) => {
    setEditData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  };

  const calcIngredientCost = (ing: Ingredient) => {
    const item = inventoryItems.find((i: any) => i.id === ing.itemId);
    const price = item ? (item.price_per_unit || item.last_price || 0) : 0;
    const loss = (ing.coldLossPercent || 0) + (ing.heatLossPercent || 0);
    const adjustedQty = ing.quantity * (1 + loss / 100);
    return Math.round(price * (adjustedQty / 1000) * 100) / 100;
  };

  const calcTotalCost = () => {
    return editData.ingredients.reduce((sum, ing) => sum + calcIngredientCost(ing), 0);
  };

  const saveTc = async () => {
    setSaving(true);
    try {
      const payload = {
        ingredients: editData.ingredients.map(ing => ({
          itemId: ing.itemId,
          itemName: ing.itemName,
          quantity: ing.quantity,
          unit: ing.unit,
          netto: ing.netto,
          coldLossPercent: ing.coldLossPercent,
          heatLossPercent: ing.heatLossPercent,
          yieldPercent: ing.yieldPercent,
        })),
        technology: editData.technology,
        description: editData.description,
        cookingTime: editData.cookingTime,
        output: editData.output,
        step_mode: editData.stepMode,
        step_instructions: editData.stepInstructions,
        isVersion: !!tc,
      };
      await api.request(`/api/dishes/${dishId}/tech-card`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setEditing(false);
      loadTc();
    } catch (e) {
      addToast('Ошибка сохранения: ' + (e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = inventoryItems.filter((i: any) =>
    !searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Техкарта «{dishName}»</h2>
            {tc && (
              <p className="text-sm text-zinc-500 mt-0.5">
                Выход: {tc.output}г | Версия: {tc.version || 1}
                {tc.cooking_time ? ` | Время: ${tc.cooking_time} мин` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                <button onClick={loadVersions} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center gap-1">
                  <History size={14} /> История
                </button>
                <button onClick={startEdit} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1">
                  <Edit3 size={14} /> Редактировать
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : showVersions ? (
            <div>
              <button onClick={() => setShowVersions(false)} className="text-sm text-blue-500 hover:underline mb-3">← Назад к техкарте</button>
              <h3 className="font-bold text-zinc-700 dark:text-zinc-300 mb-3">История версий</h3>
              {versions.length === 0 ? (
                <p className="text-sm text-zinc-400">Нет сохранённых версий</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((v: any) => (
                    <div key={v.id} className={`p-3 rounded-xl border ${v.is_active ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-200 dark:border-zinc-700'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">Версия {v.version}</span>
                        <span className="text-xs text-zinc-500">{v.created_at}</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Выход: {v.output}г | Себестоимость: {v.cost_price ? `${v.cost_price}₽` : '—'}
                        {v.is_active ? ' | Активная' : ''}
                      </div>
                      {v.description && <p className="text-xs text-zinc-400 mt-1">{v.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !editing ? (
            <div className="space-y-5">
              {!tc ? (
                <div className="py-16 text-center">
                  <p className="text-zinc-400 text-sm mb-3">Техкарта не найдена</p>
                  <button onClick={startEdit} className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600">
                    Создать техкарту
                  </button>
                </div>
              ) : (
                <>
                  {tc.ingredients && tc.ingredients.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Ингредиенты</h3>
                      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs">
                              <th className="text-left py-2.5 px-3">Наименование</th>
                              <th className="text-right py-2.5 px-3">Кол-во, г</th>
                              <th className="text-center py-2.5 px-3">Потери</th>
                              <th className="text-right py-2.5 px-3">Цена/кг, ₽</th>
                              <th className="text-right py-2.5 px-3">Стоимость, ₽</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {tc.ingredients.map((ing: any) => {
                              const price = ing.price_per_unit || ing.last_price || 0;
                              const loss = (ing.cold_loss_percent || 0) + (ing.heat_loss_percent || 0);
                              const adjustedQty = ing.quantity * (1 + loss / 100);
                              const cost = price * (adjustedQty / 1000);
                              return (
                                <tr key={ing.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                  <td className="py-2 px-3 text-zinc-900 dark:text-white">{ing.item_name}</td>
                                  <td className="py-2 px-3 text-right font-medium text-zinc-700 dark:text-zinc-300">{ing.quantity}</td>
                                  <td className="py-2 px-3 text-center">
                                    {loss > 0 ? (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                        +{loss}%
                                      </span>
                                    ) : (
                                      <span className="text-xs text-zinc-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right text-zinc-500">{price > 0 ? price.toLocaleString('ru-RU') : '—'}</td>
                                  <td className="py-2 px-3 text-right font-medium text-zinc-900 dark:text-white">{cost > 0 ? cost.toFixed(2) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-zinc-50 dark:bg-zinc-800/50 font-bold">
                              <td className="py-2.5 px-3 text-zinc-900 dark:text-white">Итого себестоимость</td>
                              <td className="py-2.5 px-3 text-right text-zinc-700 dark:text-zinc-300">
                                {tc.ingredients.reduce((s: number, i: any) => s + (i.quantity || 0), 0)}г
                              </td>
                              <td className="py-2.5 px-3"></td>
                              <td className="py-2.5 px-3"></td>
                              <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">
                                {tc.totalCost > 0 ? `${tc.totalCost.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₽` : '—'}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {dishPrice && dishPrice > 0 && tc.totalCost > 0 && (
                        <div className="flex items-center gap-4 mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl text-sm">
                          <span className="text-zinc-500">Цена: <strong className="text-zinc-900 dark:text-white">{dishPrice}₽</strong></span>
                          <span className="text-zinc-500">Маржа: <strong className={`${(1 - tc.totalCost / dishPrice) < 0.3 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                            {((1 - tc.totalCost / dishPrice) * 100).toFixed(1)}%
                          </strong></span>
                          <span className="text-zinc-500">Прибыль: <strong className="text-zinc-900 dark:text-white">
                            {(dishPrice - tc.totalCost).toFixed(2)}₽
                          </strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  {tc.technology && (
                    <div>
                      <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Технология приготовления</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line leading-relaxed bg-zinc-50 dark:bg-zinc-800/30 p-3 rounded-xl">{tc.technology}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* EDIT MODE */
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Выход, г</label>
                  <input type="number" value={editData.output}
                    onChange={e => setEditData(prev => ({ ...prev, output: +e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Время готовки, мин</label>
                  <input type="number" value={editData.cookingTime}
                    onChange={e => setEditData(prev => ({ ...prev, cookingTime: +e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Описание</label>
                <input type="text" value={editData.description}
                  onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white"
                  placeholder="Краткое описание блюда" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Ингредиенты</h3>
                  <button onClick={addIngredient} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1">
                    <Plus size={14} /> Добавить
                  </button>
                </div>

                <div className="space-y-2">
                  {editData.ingredients.map((ing, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <select value={ing.itemId || ''}
                          onChange={e => updateIngredient(idx, 'itemId', +e.target.value || null)}
                          className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white">
                          <option value="">Выберите ингредиент</option>
                          {filteredItems.map((item: any) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                        <button onClick={() => removeIngredient(idx)} className="p-2 text-red-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        <div>
                          <label className="block text-xs text-zinc-500 mb-0.5">Кол-во, г</label>
                          <input type="number" value={ing.quantity}
                            onChange={e => updateIngredient(idx, 'quantity', +e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 mb-0.5">Ед.</label>
                          <select value={ing.unit}
                            onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white">
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 mb-0.5">Потери холод, %</label>
                          <input type="number" value={ing.coldLossPercent}
                            onChange={e => updateIngredient(idx, 'coldLossPercent', +e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 mb-0.5">Потери тепло, %</label>
                          <input type="number" value={ing.heatLossPercent}
                            onChange={e => updateIngredient(idx, 'heatLossPercent', +e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 mb-0.5">Стоимость</label>
                          <div className="px-2 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
                            {calcIngredientCost(ing) > 0 ? `${calcIngredientCost(ing).toFixed(2)}₽` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {editData.ingredients.length > 0 && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Итого себестоимость:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{calcTotalCost().toFixed(2)}₽</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Технология приготовления</label>
                <textarea value={editData.technology}
                  onChange={e => setEditData(prev => ({ ...prev, technology: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white"
                  placeholder="Описание процесса приготовления..." />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={editData.stepMode}
                    onChange={e => setEditData(prev => ({ ...prev, stepMode: e.target.checked }))}
                    className="rounded" />
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Пошаговый режим (KDS)</label>
                </div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Пошаговая инструкция</label>
                <textarea value={editData.stepInstructions}
                  onChange={e => setEditData(prev => ({ ...prev, stepInstructions: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white"
                  placeholder="Описание каждого шага..." />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0 flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                Отмена
              </button>
              <button onClick={saveTc} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={16} /> {saving ? 'Сохранение...' : (tc ? 'Сохранить новую версию' : 'Создать техкарту')}
              </button>
            </>
          ) : (
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
