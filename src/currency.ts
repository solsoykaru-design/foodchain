import { request } from './api';
import { useSyncExternalStore } from 'react';

const SYMBOLS: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', KZT: '₸', BYN: 'Br',
  UZS: "so'm", AMD: '֏', KGS: 'som', CNY: '¥', TRY: '₺', GBP: '£', AED: 'د.إ',
};

interface Rate { currency_code: string; rate: number; symbol: string; is_base: number; }

let ratesCache: Rate[] | null = null;
let ratesPromise: Promise<void> | null = null;

let _currency = getPreferredCurrency();
const _listeners = new Set<() => void>();

export function subscribeCurrency(fn: () => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

function getSnapshot() { return _currency; }

export function setCurrency(code: string) {
  _currency = code;
  localStorage.setItem('foodchain_currency', JSON.stringify(code));
  _listeners.forEach(fn => fn());
}

export function useFormatPrice() {
  const currency = useSyncExternalStore(subscribeCurrency, getSnapshot, getSnapshot);
  return (amount: number) => formatPrice(amount, currency);
}

export function useCurrency() {
  const currency = useSyncExternalStore(subscribeCurrency, getSnapshot, getSnapshot);
  return {
    currency,
    formatPrice: (amount: number) => formatPrice(amount, currency),
    convertPrice: (amount: number) => convertPrice(amount, currency),
    symbol: getSymbol(currency),
  };
}

export async function initCurrencyRates(): Promise<void> {
  if (ratesCache) return;
  if (ratesPromise) return ratesPromise;
  ratesPromise = request('/api/exchange-rates')
    .then((data: any) => { ratesCache = data as Rate[]; })
    .catch(() => { ratesCache = []; });
  return ratesPromise;
}

function getPreferredCurrency(): string {
  if (typeof window === 'undefined') return 'RUB';
  try { return JSON.parse(localStorage.getItem('foodchain_currency') || '"RUB"'); } catch { return 'RUB'; }
}

function getRate(code: string): number {
  if (!ratesCache || ratesCache.length === 0) return 1;
  const base = ratesCache.find(r => r.is_base);
  const target = ratesCache.find(r => r.currency_code === code);
  if (!target || !base) return 1;
  return base.rate / target.rate;
}

export function getSymbol(code?: string): string {
  const c = code || getPreferredCurrency();
  return SYMBOLS[c] || c;
}

export function formatPrice(amount: number, currencyCode?: string): string {
  const code = currencyCode || getPreferredCurrency();
  const rate = getRate(code);
  const converted = amount * rate;
  const rounded = Math.round(converted * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
  return `${formatted} ${SYMBOLS[code] || code}`;
}

export function convertPrice(amount: number, currencyCode?: string): number {
  const code = currencyCode || getPreferredCurrency();
  const rate = getRate(code);
  return Math.round(amount * rate * 100) / 100;
}
