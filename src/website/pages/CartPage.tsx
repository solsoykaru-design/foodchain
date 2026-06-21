import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';

export default function CartPage() {
  const ctx = useWebsite();

  const applyPromo = () => {
    if (ctx.promoCode.toUpperCase() === 'FIRST100') ctx.setPromoDiscount(100);
    else if (ctx.promoCode.toUpperCase() === 'PIZZA20') ctx.setPromoDiscount(Math.round(ctx.cartTotal * 0.2));
    else ctx.setPromoDiscount(0);
  };

  const total = ctx.cartTotal - ctx.promoDiscount;

  if (ctx.cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-bold mb-2">Корзина пуста</h2>
        <p className="text-[var(--color-text-secondary)] mb-6">Добавьте блюда из меню</p>
        <button onClick={() => ctx.setPage('menu')} className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all">
          Перейти в меню
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => ctx.setPage('menu')} className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-6 transition-colors">
        <ArrowLeft size={16} /> Продолжить выбор
      </button>

      <h1 className="text-2xl font-bold mb-6">Корзина</h1>

      <div className="space-y-3 mb-6">
        {ctx.cart.map(item => (
          <div key={item.dish.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
              {item.dish.imageUrl ? (
                <img src={item.dish.imageUrl} alt={item.dish.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">🍽</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">{item.dish.name}</h3>
              {(item.selectedOptions && Object.keys(item.selectedOptions).length > 0) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {Object.values(item.selectedOptions).flat().join(', ')}
                </p>
              )}
              <p className="text-sm font-bold text-[var(--color-primary)] mt-1">{item.totalPrice} ₽</p>
            </div>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
              <button onClick={() => ctx.updateCartQty(item.dish.id, item.quantity - 1)} className="p-1.5 hover:bg-gray-50 transition-colors"><Minus size={14} /></button>
              <span className="px-3 text-sm font-semibold min-w-[30px] text-center">{item.quantity}</span>
              <button onClick={() => ctx.updateCartQty(item.dish.id, item.quantity + 1)} className="p-1.5 hover:bg-gray-50 transition-colors"><Plus size={14} /></button>
            </div>
            <button onClick={() => ctx.removeFromCart(item.dish.id)} className="p-2 text-gray-300 hover:text-red-400 transition-colors shrink-0">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Promo */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6">
        <div className="flex gap-2">
          <input value={ctx.promoCode} onChange={e => ctx.setPromoCode(e.target.value)} placeholder="Промокод"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-[var(--color-primary)] outline-none transition-colors" />
          <button onClick={applyPromo} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">Применить</button>
        </div>
        {ctx.promoDiscount > 0 && (
          <p className="text-sm text-green-600 mt-2">Скидка по промокоду: -{ctx.promoDiscount} ₽</p>
        )}
      </div>

      {/* Totals */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Сумма</span><span>{ctx.cartTotal} ₽</span></div>
          {ctx.promoDiscount > 0 && (
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Скидка</span><span className="text-green-600">-{ctx.promoDiscount} ₽</span></div>
          )}
          <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-lg">
            <span>Итого</span><span className="text-[var(--color-primary)]">{Math.max(0, total)} ₽</span>
          </div>
        </div>
        <button onClick={() => ctx.setPage('checkout')} className="w-full mt-4 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-sm">
          Оформить заказ
        </button>
      </div>
    </div>
  );
}
