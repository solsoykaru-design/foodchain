import { useState, useEffect, useRef } from 'react';
import { MapPin, Check, Clock, Star } from 'lucide-react';
import type { SavedAddress } from '../types';

interface Props {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

function getSavedAddresses(): { label: string; address: string }[] {
  try {
    const saved = JSON.parse(localStorage.getItem('foodchain_addresses') || '[]') as SavedAddress[];
    return saved.map(s => ({ label: s.label === 'Дом' ? '🏠' : s.label === 'Работа' ? '💼' : '📍', address: s.address }));
  } catch { return []; }
}

function getOrderAddresses(): string[] {
  try {
    const orders = JSON.parse(localStorage.getItem('foodchain_orders') || '[]') as any[];
    return [...new Set(orders.map((o: any) => o.address).filter(Boolean))] as string[];
  } catch { return []; }
}

export default function AddressInput({ value, onChange, placeholder = 'Введите адрес', className = '' }: Props) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<{ address: string; label?: string }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused || value.length < 3) { setSuggestions([]); return; }
    const q = value.toLowerCase();
    const saved = getSavedAddresses().filter(s => s.address.toLowerCase().includes(q)).map(s => ({ address: s.address, label: s.label }));
    const orderAddrs = getOrderAddresses().filter(a => a.toLowerCase().includes(q)).map(a => ({ address: a }));
    const combined = [...saved, ...orderAddrs].filter((item, idx, self) => self.findIndex(s => s.address === item.address) === idx);
    setSuggestions(combined);
  }, [value, focused]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setFocused(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectSuggestion = (addr: string) => {
    onChange(addr); setSuggestions([]); setFocused(false);
  };

  const hasHouse = /\d/.test(value);
  const borderClass = value.length > 5 ? (hasHouse ? "border-green-500" : "border-amber-400") : "border-zinc-200 dark:border-zinc-700";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} placeholder={placeholder}
          className={`w-full pl-9 pr-4 py-3 rounded-2xl border-2 text-sm text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 outline-none transition-all ${borderClass}`} />
      </div>
      {value.length > 4 && (
        <div className={`flex items-center gap-1.5 mt-1 px-1 text-xs ${hasHouse ? 'text-green-600' : 'text-amber-500'}`}>
          {hasHouse ? <><Check size={11} /> Адрес подтвержден</> : <>⚠️ Добавьте номер дома</>}
        </div>
      )}
      {focused && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-60 overflow-y-auto">
          <div className="px-3 pt-2 pb-1 flex items-center gap-1.5"><Clock size={11} className="text-zinc-400" /><span className="text-[10px] text-zinc-400 font-semibold uppercase">Сохранённые адреса</span></div>
          {suggestions.map((s, i) => (
            <button key={i} type="button" onClick={() => selectSuggestion(s.address)} className="w-full text-left px-3 py-2.5 hover:bg-orange-50 dark:hover:bg-zinc-800 transition border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
              <span className="text-sm">{s.label || <MapPin size={13} className="text-zinc-400" />}</span> <span className="text-sm text-zinc-800 dark:text-zinc-200">{s.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
