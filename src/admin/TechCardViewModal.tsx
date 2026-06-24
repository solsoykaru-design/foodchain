import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import * as api from '../api';

interface Props {
  techCardId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function TechCardViewModal({ techCardId, onClose, onSaved }: Props) {
  const [card, setCard] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getStockTechCard(techCardId);
        setCard(data);
        setIngredients(data.ingredients || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [techCardId]);

  if (loading) return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8" onClick={e => e.stopPropagation()}>
        <p className="text-zinc-400">Загрузка...</p>
      </div>
    </div>
  );

  if (!card) return null;

  const totalCost = ingredients.reduce((s, i) => s + (i.cost || 0), 0);
  const totalYield = card.totalYield || ingredients.reduce((s, i) => s + (i.yield || i.netto || 0), 0);

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-[800px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Техкарта #{card.number || card.id}
          </h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-zinc-500 block">Название</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">{card.name}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">Тип</span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{card.type}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">Магазин</span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{card.store || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">Суммарный выход, кг</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">{Number(totalYield || 0).toFixed(3)}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">Себестоимость</span>
              <span className="text-sm font-semibold text-green-600">{Number(totalCost).toFixed(2)} ₽</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">Действительна с</span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{card.validFrom ? new Date(card.validFrom).toLocaleDateString('ru-RU') : '—'}</span>
            </div>
          </div>

          {card.description && (
            <div>
              <span className="text-xs text-zinc-500 block mb-1">Технология приготовления</span>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4">{card.description}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Ингредиенты</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Название</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Ед.</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Кол-во</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Брутто, кг</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Х/о, %</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Т/о, %</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Выход, кг</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">{ing.itemName}</td>
                    <td className="px-3 py-2 text-zinc-600">{ing.unit}</td>
                    <td className="px-3 py-2 text-zinc-600">{ing.quantity}</td>
                    <td className="px-3 py-2 text-zinc-600">{Number(ing.brutto || 0).toFixed(3)}</td>
                    <td className="px-3 py-2 text-zinc-600">{ing.coldLossPercent != null ? Number(ing.coldLossPercent).toFixed(1) : '—'}</td>
                    <td className="px-3 py-2 text-zinc-600">{ing.heatLossPercent != null ? Number(ing.heatLossPercent).toFixed(1) : '—'}</td>
                    <td className="px-3 py-2 text-zinc-600">{Number(ing.yield || ing.netto || 0).toFixed(3)}</td>
                    <td className="px-3 py-2 text-green-600 font-medium">{Number(ing.cost || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200 dark:border-zinc-700 font-semibold">
                  <td colSpan={6} className="px-3 py-2 text-right text-zinc-500">Итого:</td>
                  <td className="px-3 py-2 text-zinc-900 dark:text-white">{Number(totalYield).toFixed(3)}</td>
                  <td className="px-3 py-2 text-green-600">{Number(totalCost).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {card.constantCasts && <span className="text-xs text-zinc-500">Постоянные расходы: {Number(card.constantCasts).toFixed(2)} ₽</span>}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
