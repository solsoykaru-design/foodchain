import { useState } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { X, Sparkles, Loader, Save } from 'lucide-react';

interface AiIngredient {
  name: string;
  quantity: number;
  unit: string;
}

interface MatchedIngredient {
  item_id: number | null;
  item_name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  cost: number;
}

interface AiResult {
  dish_name: string;
  ingredients: AiIngredient[];
  matched_ingredients: MatchedIngredient[];
  unmatched_ingredients: MatchedIngredient[];
  kbju_per_100g: { calories: number; proteins: number; fats: number; carbs: number };
  output: number;
  technology: string;
  cooking_time: number;
  source: string;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function AiTechCardModal({ onClose, onSaved }: Props) {
  const [dishName, setDishName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [saving, setSaving] = useState(false);

  const [editIngredients, setEditIngredients] = useState<AiIngredient[]>([]);
  const [editKbju, setEditKbju] = useState({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  const [editOutput, setEditOutput] = useState(0);
  const [editTechnology, setEditTechnology] = useState('');
  const [editCookingTime, setEditCookingTime] = useState(0);
  const [editName, setEditName] = useState('');

  const handleGenerate = async () => {
    if (!dishName.trim()) return addToast('Введите название блюда', 'error');
    setLoading(true);
    setResult(null);
    try {
      const data = await api.aiGenerateTechCard(dishName.trim());
      setResult(data);
      setEditIngredients(data.ingredients || []);
      setEditKbju(data.kbju_per_100g || { calories: 0, proteins: 0, fats: 0, carbs: 0 });
      setEditOutput(data.output || 0);
      setEditTechnology(data.technology || '');
      setEditCookingTime(data.cooking_time || 0);
      setEditName(data.dish_name || dishName.trim());
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.aiSaveTechCard({
        dish_name: editName,
        ingredients: editIngredients,
        matched_ingredients: result?.matched_ingredients || [],
        unmatched_ingredients: result?.unmatched_ingredients || [],
        kbju_per_100g: editKbju,
        output: editOutput,
        technology: editTechnology,
        cooking_time: editCookingTime,
      });
      if (res.createdItems?.length > 0) {
        addToast(`Создано ${res.createdItems.length} новых ингредиентов: ${res.createdItems.join(', ')}. Цена 0₽, отредактируйте в Складских элементах.`, 'info');
      }
      addToast('Техкарта создана!', 'success');
      onSaved();
      onClose();
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateIngredient = (idx: number, field: string, value: any) => {
    setEditIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
  };

  const removeIngredient = (idx: number) => {
    setEditIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Sparkles size={20} className="text-amber-500" /> Создать по названию
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><X size={18} /></button>
        </div>

        {!result ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-zinc-500">Введите название блюда — система автоматически определит ингредиенты, КБЖУ и технологию приготовления.</p>
            <input
              value={dishName}
              onChange={e => setDishName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="Например: Салат Цезарь, Борщ, Карбонара..."
              className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:border-amber-400 dark:focus:border-amber-500 outline-none"
              autoFocus
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !dishName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {loading ? 'Генерация...' : 'Создать'}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 shrink-0">Название блюда:</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Ингредиенты</h4>
                <span className="text-xs text-zinc-400">
                  {result.matched_ingredients?.length || 0} сопоставлено со складом,
                  {result.unmatched_ingredients?.length || 0} новых
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {editIngredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2">
                    <input
                      value={ing.name}
                      onChange={e => updateIngredient(idx, 'name', e.target.value)}
                      className="flex-1 min-w-0 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                    />
                    <input
                      type="number"
                      value={ing.quantity}
                      onChange={e => updateIngredient(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-20 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-right"
                    />
                    <select
                      value={ing.unit}
                      onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                      className="w-14 border border-zinc-200 dark:border-zinc-700 rounded px-1 py-1 text-xs bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                    >
                      <option value="г">г</option>
                      <option value="кг">кг</option>
                      <option value="мл">мл</option>
                      <option value="л">л</option>
                      <option value="шт">шт</option>
                    </select>
                    <button
                      onClick={() => removeIngredient(idx)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-zinc-400 hover:text-red-500 shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-zinc-500">Калории (100г)</label>
                <input type="number" value={editKbju.calories} onChange={e => setEditKbju(prev => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Белки (100г)</label>
                <input type="number" value={editKbju.proteins} onChange={e => setEditKbju(prev => ({ ...prev, proteins: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Жиры (100г)</label>
                <input type="number" value={editKbju.fats} onChange={e => setEditKbju(prev => ({ ...prev, fats: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Углеводы (100г)</label>
                <input type="number" value={editKbju.carbs} onChange={e => setEditKbju(prev => ({ ...prev, carbs: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500">Выход блюда (г)</label>
                <input type="number" value={editOutput} onChange={e => setEditOutput(parseFloat(e.target.value) || 0)}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Время готовки (мин)</label>
                <input type="number" value={editCookingTime} onChange={e => setEditCookingTime(parseInt(e.target.value) || 0)}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 block mb-1">Технология приготовления</label>
              <textarea
                value={editTechnology}
                onChange={e => setEditTechnology(e.target.value)}
                rows={6}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono"
              />
            </div>

            <div className="text-xs text-zinc-400">
              Источник: {result.source === 'themealdb' ? 'TheMealDB' : result.source === 'deepseek' ? 'DeepSeek AI' : result.source === 'ollama' ? 'Локальная модель' : result.source}
            </div>

            <div className="flex gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Сохранение...' : 'Сохранить техкарту'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
