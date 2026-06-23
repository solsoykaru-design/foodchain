import { usePrice } from './PriceContext';

export function Price({ value, className }: { value: number; className?: string }) {
  const formatPrice = usePrice();
  return <span className={className}>{formatPrice(value)}</span>;
}
