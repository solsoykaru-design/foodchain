import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Plus, X, Trash2 } from 'lucide-react';

interface Modifier {
  id: number;
  name: string;
  price: number;
  groupId?: number;
  groupName?: string;
}

interface DishModifier {
  id: number;
  dishId: number;
  modifierId: number;
  modifierName?: string;
  modifierPrice?: number;
  groupName?: string;
}

interface Props {
  dishId: number;
}

export default function DishModifiersManager({ dishId }: Props) {
  const [allModifiers, setAllModifiers] = useState<Modifier[]>([]);
  const [dishModifiers, setDishModifiers] = useState<DishModifier[]>([]);
  const [selectedModifierId, setSelectedModifierId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [mods, dm] = await Promise.all([
        api.request('/api/modifiers'),
        api.request(`/api/dish-modifiers/${dishId}`),
      ]);
      setAllModifiers(mods || []);
      setDishModifiers(dm || []);
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dishId]);

  const addModifier = async () => {
    if (!selectedModifierId) return;
    try {
      await api.request('/api/dish-modifiers', {
        method: 'POST',
        body: JSON.stringify({ dishId, modifierId: Number(selectedModifierId) }),
      });
      setSelectedModifierId('');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const removeModifier = async (id: number) => {
    try {
      await api.request(`/api/dish-modifiers/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const availableModifiers = allModifiers.filter(m => !dishModifiers.some(dm => dm.modifierId === m.id));

  if (loading) return <div className="text-sm text-zinc-500">Загрузка модификаторов...</div>;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Модификаторы блюда</h3>
      {dishModifiers.length === 0 ? (
        <p className="text-xs text-zinc-500">Нет привязанных модификаторов</p>
      ) : (
        <div className="space-y-1">
          {dishModifiers.map(dm => (
            <div key={dm.id} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
              <div className="text-sm">
                <span className="font-medium text-zinc-900 dark:text-white">{dm.modifierName || dm.modifierId}</span>
                <span className="text-zinc-500 ml-2">{dm.modifierPrice || 0}₽</span>
                {dm.groupName && <span className="text-zinc-400 text-xs ml-2">({dm.groupName})</span>}
              </div>
              <button onClick={() => removeModifier(dm.id)} className="text-red-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {availableModifiers.length > 0 && (
        <div className="flex gap-2">
          <select value={selectedModifierId} onChange={e => setSelectedModifierId(e.target.value ? Number(e.target.value) : '')}
            className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
            <option value="">Выберите модификатор</option>
            {availableModifiers.map(m => (
              <option key={m.id} value={m.id}>{m.name} (+{m.price}₽){m.groupName ? ` — ${m.groupName}` : ''}</option>
            ))}
          </select>
          <button onClick={addModifier} disabled={!selectedModifierId}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1">
            <Plus size={16} /> Добавить
          </button>
        </div>
      )}
      {availableModifiers.length === 0 && allModifiers.length === 0 && (
        <p className="text-xs text-zinc-500">Сначала создайте модификаторы в разделе «Меню → Модификаторы».</p>
      )}
    </div>
  );
}
