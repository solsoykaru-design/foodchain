import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Clock, Truck, Award, Sparkles } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';

const GRADIENTS = ['from-orange-500 to-red-500', 'from-red-500 to-yellow-500', 'from-blue-500 to-cyan-500', 'from-green-500 to-emerald-500', 'from-purple-500 to-pink-500'];

export default function HomePage() {
  const ctx = useWebsite();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const s = ctx.siteSettings || {};
  const slides = s.images?.slides || [];
  const popular = ctx.menuData.dishes.filter(d => d.isPopular).slice(0, 8);

  useEffect(() => {
    if (slides.length > 1) {
      const timer = setInterval(() => setCurrentSlide(s => (s + 1) % slides.length), 5000);
      return () => clearInterval(timer);
    }
  }, [slides.length]);

  useEffect(() => {
    ctx.menuData.categories.forEach((c: any) => {});
  }, [ctx.menuData]);

  return (
    <div>
      {/* Hero Banner */}
      <section className="relative bg-gray-900 overflow-hidden">
        {slides.length > 0 ? (
          <div className="relative h-[50vh] min-h-[320px] md:min-h-[420px]">
            {slides.map((slide: string, i: number) => (
              <div key={i} className={`absolute inset-0 transition-opacity duration-700 ${i === currentSlide ? 'opacity-100' : 'opacity-0'}`}>
                <img src={slide} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>
            ))}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 text-white">
              <h1 className="text-3xl md:text-5xl font-extrabold mb-3 leading-tight">Вкусная еда<br />с доставкой</h1>
              <p className="text-lg md:text-xl text-white/80 mb-4 max-w-xl">Закажите любимые блюда онлайн — быстро, удобно, вкусно</p>
              <button onClick={() => ctx.setPage('menu')} className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-lg">
                Перейти к меню <ChevronRight size={18} />
              </button>
            </div>
            {slides.length > 1 && (
              <div className="absolute bottom-4 right-4 flex gap-1.5">
                {slides.map((_: string, i: number) => (
                  <button key={i} onClick={() => setCurrentSlide(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentSlide ? 'bg-white w-6' : 'bg-white/50'}`} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-[50vh] min-h-[320px] md:min-h-[420px] flex items-center justify-center bg-gradient-to-br from-gray-800 via-gray-900 to-black">
            <div className="text-center text-white px-4">
              <h1 className="text-3xl md:text-5xl font-extrabold mb-3">Вкусная еда<br />с доставкой</h1>
              <p className="text-lg md:text-xl text-white/60 mb-4">Закажите любимые блюда онлайн</p>
              <button onClick={() => ctx.setPage('menu')} className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-lg">
                Перейти к меню <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Advantages */}
      <section className="py-8 bg-gray-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Truck, label: 'Быстрая доставка', desc: 'От 30 минут' },
            { icon: Award, label: 'Свежие продукты', desc: 'Только лучшее' },
            { icon: Sparkles, label: 'Программа лояльности', desc: 'Копите бонусы' },
            { icon: Clock, label: 'Работаем ежедневно', desc: 'С 09:00 до 23:00' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-[var(--color-primary)] shrink-0">
                <item.icon size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories quick nav */}
      {ctx.menuData.categories.length > 0 && (
        <section className="py-10">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">Категории</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {ctx.menuData.categories.slice(0, 12).map((cat: any, i: number) => (
                <button key={cat.id} onClick={() => ctx.setPage('menu')}
                  className={`bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} rounded-xl p-4 text-white text-center hover:scale-[1.02] transition-transform shadow-sm`}>
                  <div className="text-2xl mb-1">{cat.icon || '🍽'}</div>
                  <div className="font-semibold text-sm">{cat.name}</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Popular dishes */}
      {popular.length > 0 && (
        <section className="py-10 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">Популярные блюда</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {popular.map(dish => (
                <button key={dish.id} onClick={() => { ctx.setSelectedDish(dish); ctx.setPage('dish'); }}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left group">
                  <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                    {dish.imageUrl ? (
                      <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🍽</div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm mb-1 line-clamp-1">{dish.name}</h3>
                    {dish.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{dish.description}</p>}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--color-primary)]">{dish.price} ₽</span>
                      {dish.rating > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Star size={12} className="text-amber-400 fill-amber-400" /> {dish.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Готовы сделать заказ?</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">Выберите любимые блюда из нашего меню</p>
          <button onClick={() => ctx.setPage('menu')} className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:brightness-110 transition-all shadow-lg text-base">
            Открыть меню <ChevronRight size={20} />
          </button>
        </div>
      </section>
    </div>
  );
}
