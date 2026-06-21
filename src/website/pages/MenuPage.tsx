import { useState, useMemo } from 'react';
import { Search, Star, Plus } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';
import { Dish } from '../../types';

const GRADIENTS = ['from-orange-500 to-red-500', 'from-red-500 to-yellow-500', 'from-blue-500 to-cyan-500', 'from-green-500 to-emerald-500', 'from-purple-500 to-pink-500'];

export default function MenuPage() {
  const ctx = useWebsite();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [filterNew, setFilterNew] = useState(false);
  const [filterPromo, setFilterPromo] = useState(false);

  const categories = ctx.menuData.categories || [];
  const allDishes = ctx.menuData.dishes || [];

  const filtered = useMemo(() => {
    let items = allDishes;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(d => d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q));
    }
    if (activeCategory) {
      items = items.filter(d => d.categoryId === activeCategory);
    }
    if (filterNew) items = items.filter(d => d.isNew);
    if (filterPromo) items = items.filter(d => d.oldPrice && d.oldPrice > d.price);
    return items;
  }, [allDishes, search, activeCategory, filterNew, filterPromo]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Меню</h1>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск блюд..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilterNew(!filterNew)} className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${filterNew ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            Новинки
          </button>
          <button onClick={() => setFilterPromo(!filterPromo)} className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${filterPromo ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            Акции
          </button>
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
          <button onClick={() => setActiveCategory(null)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${!activeCategory ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Все
          </button>
          {categories.map((cat: any, i: number) => (
            <button key={cat.id} onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeCategory === cat.id ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <span>{cat.icon || '🍽'}</span> {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Category sections or flat grid */}
      {activeCategory ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(dish => <DishCard key={dish.id} dish={dish} />)}
        </div>
      ) : search || filterNew || filterPromo ? (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(dish => <DishCard key={dish.id} dish={dish} />)}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">Ничего не найдено</div>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {categories.filter((c: any) => allDishes.some(d => d.categoryId === c.id)).map((cat: any) => {
            const catDishes = allDishes.filter(d => d.categoryId === cat.id);
            if (!catDishes.length) return null;
            return (
              <section key={cat.id}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="text-lg">{cat.icon || '🍽'}</span> {cat.name}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {catDishes.map(dish => <DishCard key={dish.id} dish={dish} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DishCard({ dish }: { dish: Dish }) {
  const ctx = useWebsite();
  const inCart = ctx.cart.find(i => i.dish.id === dish.id);

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100">
      <button onClick={() => { ctx.setSelectedDish(dish); ctx.setPage('dish'); }} className="w-full text-left">
        <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
          {dish.imageUrl ? (
            <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🍽</div>
          )}
          {dish.oldPrice && dish.oldPrice > dish.price && (
            <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">-{Math.round((1 - dish.price / dish.oldPrice) * 100)}%</span>
          )}
          {dish.isNew && (
            <span className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">NEW</span>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm mb-1 line-clamp-1">{dish.name}</h3>
          {dish.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{dish.description}</p>}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-[var(--color-primary)]">{dish.price} ₽</span>
              {dish.oldPrice && dish.oldPrice > dish.price && (
                <span className="text-xs text-gray-400 line-through ml-1.5">{dish.oldPrice} ₽</span>
              )}
            </div>
            {dish.rating > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Star size={12} className="text-amber-400 fill-amber-400" /> {dish.rating.toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            {dish.weight > 0 && <span className="text-xs text-gray-400">{dish.weight} г</span>}
            <button onClick={(e) => { e.stopPropagation(); ctx.addToCart(dish, 1); }}
              className="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center hover:brightness-110 transition-all">
              <Plus size={16} />
            </button>
          </div>
          {inCart && (
            <div className="mt-1.5 text-xs text-[var(--color-primary)] font-medium">В корзине: {inCart.quantity} шт.</div>
          )}
        </div>
      </button>
    </div>
  );
}
