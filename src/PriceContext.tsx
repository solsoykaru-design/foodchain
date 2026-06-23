import { createContext, useContext, ReactNode } from 'react';
import { useFormatPrice } from './currency';

const PriceContext = createContext<(amount: number) => string>(() => '');

export function PriceProvider({ children }: { children: ReactNode }) {
  const formatPrice = useFormatPrice();
  return <PriceContext.Provider value={formatPrice}>{children}</PriceContext.Provider>;
}

export function usePrice() {
  return useContext(PriceContext);
}
