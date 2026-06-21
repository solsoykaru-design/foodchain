import { useState, useEffect } from 'react';
import { Bookmark, Plus, X, Trash2 } from 'lucide-react';
import type { Dish } from '../../types';

interface OrderTemplate {
  id: string;
  name: string;
  items: { dishId: number; name: string; quantity: number; modifiers: string[] }[];
}

export default function QuickTemplates({
  dishes, onApplyTemplate,
}: {
  dishes: Dish[];
  onApplyTemplate: (items: { dishId: number; quantity: number; modifiers: string[] }[]) => void;
}) {
  const [templates, setTemplates] = useState<OrderTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem('waiter_templates') || '[]'); } catch { return []; }
  });
  const [showSave, setShowSave] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedDishIds, setSelectedDishIds] = useState<number[]>([]);

  useEffect(() => {
    localStorage.setItem('waiter_templates', JSON.stringify(templates));
  }, [templates]);

  const saveTemplate = () => {
    if (!templateName.trim() || selectedDishIds.length === 0) return;
    const newTemplate: OrderTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      items: selectedDishIds.map(dishId => {
        const dish = dishes.find(d => d.id === dishId);
        return { dishId, name: dish?.name || '', quantity: 1, modifiers: [] };
      }),
    };
    setTemplates(prev => [...prev, newTemplate]);
    setShowSave(false);
    setTemplateName('');
    setSelectedDishIds([]);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="pb-4 px-4 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
          <Bookmark size={16} className="text-orange-500" /> Быстрые заказы
        </h3>
        <button onClick={() => setShowSave(true)}
          className="text-xs text-orange-500 font-semibold flex items-center gap-1">
          <Plus size={14} /> Создать шаблон
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {templates.map(tpl => (
          <div key={tpl.id} className="bg-zinc-900 rounded-xl p-3 min-w-[140px] ring-1 ring-zinc-800 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-white truncate">{tpl.name}</span>
              <button onClick={() => deleteTemplate(tpl.id)} className="text-zinc-600 hover:text-red-400 p-0.5">
                <Trash2 size={12} />
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 mb-2">{tpl.items.length} позиций</p>
            <button onClick={() => onApplyTemplate(tpl.items)}
              className="w-full bg-orange-500 text-white text-xs font-bold py-1.5 rounded-lg">
              Применить
            </button>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-xs text-zinc-600 py-2">Нет сохранённых шаблонов</p>
        )}
      </div>

      {/* Save modal */}
      {showSave && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowSave(false)}>
          <div className="bg-zinc-900 rounded-3xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-white">Сохранить шаблон</h3>
              <button onClick={() => setShowSave(false)}><X size={18} className="text-zinc-500" /></button>
            </div>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)}
              placeholder="Название шаблона" className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none mb-3" />
            <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
              {dishes.map(dish => (
                <label key={dish.id} className="flex items-center gap-2 py-1.5">
                  <input type="checkbox" checked={selectedDishIds.includes(dish.id)}
                    onChange={() => setSelectedDishIds(prev => prev.includes(dish.id) ? prev.filter(id => id !== dish.id) : [...prev, dish.id])}
                    className="w-4 h-4 accent-orange-500" />
                  <span className="text-sm text-zinc-300">{dish.name}</span>
                </label>
              ))}
            </div>
            <button onClick={saveTemplate} className="w-full bg-orange-500 text-white font-bold py-2.5 rounded-xl text-sm">
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
