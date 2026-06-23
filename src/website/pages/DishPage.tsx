import { useState, useEffect } from 'react';
import { Minus, Plus, ShoppingCart, Star, ChevronLeft, Flame } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';
import { usePrice } from '../../PriceContext';

export default function DishPage() {
  const ctx = useWebsite();
  const dish = ctx.selectedDish;
  const [qty, setQty] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number[]>>({});
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setQty(1);
    setSelectedOptions({});
    setAdded(false);
  }, [dish?.id]);

  if (!dish) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-400">Блюдо не выбрано</p>
        <button onClick={() => ctx.setPage('menu')} className="mt-4 text-[var(--color-primary)] font-medium">Вернуться в меню</button>
      </div>
    );
  }

  let extraPrice = 0;
  if (dish.customizations) {
    Object.entries(selectedOptions).forEach(([custId, optIds]) => {
      const cust = dish.customizations?.find(c => c.id === Number(custId));
      if (cust) { optIds.forEach(optId => { const opt = cust.options.find(o => o.id === optId); if (opt) extraPrice += opt.price; }); }
    });
  }
  const itemTotal = (dish.price + extraPrice) * qty;

  const toggleOption = (custId: number, optId: number, multiple: boolean) => {
    setSelectedOptions(prev => {
      const current = prev[custId] || [];
      if (multiple) {
        const next = current.includes(optId) ? current.filter(id => id !== optId) : [...current, optId];
        return { ...prev, [custId]: next };
      }
      return { ...prev, [custId]: [optId] };
    });
  };

  const handleAdd = () => {
    ctx.addToCart(dish, qty, selectedOptions);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => ctx.setPage('menu')} className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-4 transition-colors">
        <ChevronLeft size={16} /> Вернуться в меню
      </button>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
          {dish.imageUrl ? (
            <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">🍽</div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">{dish.name}</h1>
            {dish.rating > 0 && (
              <span className="flex items-center gap-1 text-sm bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg">
                <Star size={14} className="fill-amber-400 text-amber-400" /> {dish.rating.toFixed(1)}
              </span>
            )}
          </div>

          {dish.description && <p className="text-[var(--color-text-secondary)] mb-4 leading-relaxed">{dish.description}</p>}

          {/* KBJU */}
          {(dish.calories > 0 || dish.proteins > 0 || dish.fats > 0 || dish.carbs > 0) && (
            <div className="flex gap-4 mb-4 text-xs text-gray-500">
              {dish.calories > 0 && <span><Flame size={12} className="inline mr-0.5 text-orange-500" />{dish.calories} ккал</span>}
              {dish.proteins > 0 && <span>Б: {dish.proteins}г</span>}
              {dish.fats > 0 && <span>Ж: {dish.fats}г</span>}
              {dish.carbs > 0 && <span>У: {dish.carbs}г</span>}
              {dish.weight > 0 && <span className="font-medium">{dish.weight} г</span>}
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-2xl font-bold text-[var(--color-primary)]">{usePrice()(dish.price)}</span>
            {dish.oldPrice && dish.oldPrice > dish.price && (
              <span className="text-sm text-gray-400 line-through">{usePrice()(dish.oldPrice)}</span>
            )}
          </div>

          {/* Customizations */}
          {dish.customizations?.map(cust => (
            <div key={cust.id} className="mb-5">
              <h4 className="font-semibold text-sm mb-2">
                {cust.name} {cust.required && <span className="text-red-400">*</span>}
              </h4>
              <div className="flex flex-wrap gap-2">
                {cust.options.map(opt => {
                  const selected = (selectedOptions[cust.id] || []).includes(opt.id);
                  return (
                    <button key={opt.id} onClick={() => toggleOption(cust.id, opt.id, cust.multiple)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${selected ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {opt.name} {opt.price > 0 && `+${usePrice()(opt.price)}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quantity and Add */}
          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="p-2.5 hover:bg-gray-50 transition-colors"><Minus size={16} /></button>
              <span className="px-4 font-semibold min-w-[40px] text-center">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="p-2.5 hover:bg-gray-50 transition-colors"><Plus size={16} /></button>
            </div>
            <button onClick={handleAdd} disabled={added}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-70 shadow-sm">
              {added ? (
                <>Добавлено ✓</>
              ) : (
                <><ShoppingCart size={18} /> {usePrice()(itemTotal)}</>
              )}
            </button>
          </div>

          {/* Allergens */}
          {dish.allergens && dish.allergens.length > 0 && (
            <p className="mt-4 text-xs text-gray-400">Аллергены: {dish.allergens.join(', ')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
