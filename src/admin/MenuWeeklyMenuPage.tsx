import { useState, useEffect } from 'react';
import * as api from '../api';
import { CalendarDays } from 'lucide-react';

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export default function MenuWeeklyMenuPage() {
  const [dishes, setDishes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekMenu, setWeekMenu] = useState<Record<string, number[]>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        api.getDishes(),
        api.getMenuCategories(),
      ]);
      setDishes(d);
      setCategories(c);

      const saved = await api.request('/api/weekly-menu').catch(() => ({}));
      setWeekMenu(saved);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const catMap = categories.reduce((acc: any, c: any) => { acc[c.id] = c; return acc; }, {} as Record<number, any>);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center">
            <CalendarDays size={22} className="text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Недельное меню</h1>
            <p className="text-sm text-zinc-500">Загрузка...</p>
          </div>
        </div>
      </div>
    );
  }

  const weeklyDishes = weekMenu;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center">
          <CalendarDays size={22} className="text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Недельное меню</h1>
          <p className="text-sm text-zinc-500">Планирование меню по дням недели</p>
        </div>
      </div>

      {dishes.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">Нет блюд для отображения</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 min-w-[140px]">Категория / Блюдо</th>
                {DAYS.map((day, i) => (
                  <th key={i} className="px-3 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 min-w-[110px] text-center">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const catDishes = dishes.filter((d: any) => d.categoryId === cat.id);
                if (catDishes.length === 0) return null;
                return (
                  <tr key={cat.id}>
                    <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/20" colSpan={8}>
                      {cat.icon || '📁'} {cat.name}
                    </td>
                  </tr>
                );
              })}
              {categories.map(cat => {
                const catDishes = dishes.filter((d: any) => d.categoryId === cat.id);
                return catDishes.map((dish: any) => (
                  <tr key={dish.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      <span className="text-sm">{dish.name}</span>
                      <span className="text-xs text-zinc-400 ml-2">{dish.price}₽</span>
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const dayKey = DAYS[dayIdx].toLowerCase();
                      const assigned = weeklyDishes[dayKey]?.includes(dish.id);
                      return (
                        <td key={dayIdx} className={`px-3 py-2 text-center border border-zinc-200 dark:border-zinc-700 ${assigned ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                          {assigned ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-600">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
              {dishes.length > 0 && categories.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    Нет категорий. Создайте категории в разделе «Категории меню».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-right text-sm text-zinc-500">
        Всего блюд: {dishes.length} • Категорий: {categories.length}
      </div>
    </div>
  );
}
