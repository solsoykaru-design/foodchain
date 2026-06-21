import { useState, useRef, useEffect } from 'react';
import { Palette, Type, Globe } from 'lucide-react';
import { PRESET_THEMES } from './index';
import { useTheme } from './useTheme';
import { useApp } from '../context';

const CURRENCIES = [
  { code: 'RUB', symbol: '₽', name: 'Рубль' },
  { code: 'USD', symbol: '$', name: 'Доллар' },
  { code: 'EUR', symbol: '€', name: 'Евро' },
  { code: 'KZT', symbol: '₸', name: 'Тенге' },
  { code: 'BYN', symbol: 'Br', name: 'Рубль BY' },
  { code: 'UZS', symbol: "so'm", name: 'Сум' },
  { code: 'AMD', symbol: '֏', name: 'Драм' },
  { code: 'CNY', symbol: '¥', name: 'Юань' },
  { code: 'TRY', symbol: '₺', name: 'Лира' },
  { code: 'GBP', symbol: '£', name: 'Фунт' },
  { code: 'AED', symbol: 'د.إ', name: 'Дирхам' },
];

export default function ThemeSelector() {
  const { currentTheme, changeTheme, themeId } = useTheme();
  const { fontSize, setFontSize, preferredCurrency, setPreferredCurrency } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sizes = ['small', 'medium', 'large'] as const;
  const sizeMap = { small: '11px', medium: '14px', large: '17px' };
  const hints = { small: 'Мелкий', medium: 'Средний', large: 'Крупный' };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-white transition active:scale-[0.97]"
        title="Настройки"
      >
        <Palette size={20} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-3 min-w-[260px] max-h-[480px] overflow-y-auto">
          {/* Font size section */}
          <p className="text-xs font-semibold text-zinc-500 mb-2 px-1 flex items-center gap-1.5">
            <Type size={12} /> Размер текста
          </p>
          <div className="flex gap-1 mb-3 px-1">
            {sizes.map(s => {
              const active = fontSize === s;
              return (
                <button key={s} onClick={() => setFontSize(s)} title={hints[s]}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  style={{ fontSize: sizeMap[s] }}>{s === 'small' ? 'A' : s === 'medium' ? 'A' : 'A'}</button>
              );
            })}
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3" />
          <p className="text-xs font-semibold text-zinc-500 mb-2 px-1">Валюта</p>
          <div className="flex flex-wrap gap-1 mb-3 px-1">
            {CURRENCIES.slice(0, 6).map(c => {
              const active = preferredCurrency === c.code;
              return (
                <button key={c.code} onClick={() => setPreferredCurrency?.(c.code)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white'
                  }`}
                >{c.symbol} {c.code}</button>
              );
            })}
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3" />
          {PRESET_THEMES.map(t => {
            const active = themeId === t.id;
            return (
              <button key={t.id} onClick={() => { changeTheme(t.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all active:scale-[0.97] text-left ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600" style={{ background: t.colors.bgPrimary }} />
                  <span className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600" style={{ background: t.colors.accent }} />
                  <span className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600" style={{ background: t.colors.textPrimary }} />
                </div>
                <span className="flex-1">{t.name}</span>
                {active && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
