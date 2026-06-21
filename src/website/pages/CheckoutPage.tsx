import { useState, useEffect } from 'react';
import { Truck, Store, CreditCard, Banknote, ArrowLeft } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';
import * as api from '../../api';

export default function CheckoutPage() {
  const ctx = useWebsite();
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'sbp'>('cash');
  const [name, setName] = useState(ctx.user?.name || '');
  const [phone, setPhone] = useState(ctx.user?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pickupPoints, setPickupPoints] = useState<any[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusDiscount, setBonusDiscount] = useState(0);

  useEffect(() => {
    api.get('/api/pickup-points').then(setPickupPoints).catch(() => {});
    if (ctx.user?.id) {
      api.get(`/api/loyalty/guest/${ctx.user.id}`).then((r: any) => {
        setBonusBalance(r.bonusBalance || 0);
      }).catch(() => {});
    }
  }, []);

  const total = ctx.cartTotal - ctx.promoDiscount;
  const maxBonusWriteOff = total * 0.5;
  const effectiveBonusDiscount = useBonuses ? Math.min(bonusBalance, maxBonusWriteOff) : 0;

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { setError('Укажите имя и телефон'); return; }
    if (orderType === 'delivery' && !address.trim()) { setError('Укажите адрес доставки'); return; }
    setSubmitting(true);
    setError('');

    try {
      const orderData = {
        type: orderType,
        items: ctx.cart.map(i => ({
          dishId: i.dish.id, name: i.dish.name, price: i.dish.price,
          quantity: i.quantity, options: Object.values(i.selectedOptions || {}).flat(),
        })),
        subtotal: ctx.cartTotal,
        discount: ctx.promoDiscount,
        bonusUsed: effectiveBonusDiscount,
        total: Math.max(0, total - effectiveBonusDiscount),
        promoCode: ctx.promoCode || undefined,
        address: orderType === 'delivery' ? address : undefined,
        pickupPointId: orderType === 'pickup' ? selectedPoint : undefined,
        comment: comment || undefined,
        paymentMethod: paymentMethod === 'card' ? 'yookassa' : paymentMethod === 'sbp' ? 'tinkoff' : 'cash',
        userName: name,
        userPhone: phone,
        userId: ctx.user?.id || null,
        source: 'website',
      };

      const result = await api.post('/api/website/orders', orderData);
      ctx.clearCart();
      ctx.setPage('order-tracking');
      ctx.setSelectedDishData({ orderId: result.orderId });
    } catch (e: any) {
      setError(e.message || 'Ошибка при создании заказа');
    } finally {
      setSubmitting(false);
    }
  };

  if (ctx.cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold mb-4">Корзина пуста</h2>
        <button onClick={() => ctx.setPage('menu')} className="text-[var(--color-primary)] font-medium">Перейти в меню</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => ctx.setPage('cart')} className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-6 transition-colors">
        <ArrowLeft size={16} /> Назад в корзину
      </button>

      <h1 className="text-2xl font-bold mb-6">Оформление заказа</h1>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

      {/* Name / Phone */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
        <h3 className="font-semibold mb-3">Контактные данные</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя *"
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:border-[var(--color-primary)] outline-none transition-colors" />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон *"
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:border-[var(--color-primary)] outline-none transition-colors" />
        </div>
      </div>

      {/* Order type */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
        <h3 className="font-semibold mb-3">Способ получения</h3>
        <div className="flex gap-2">
          <button onClick={() => setOrderType('delivery')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${orderType === 'delivery' ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            <Truck size={18} /> Доставка
          </button>
          <button onClick={() => setOrderType('pickup')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${orderType === 'pickup' ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            <Store size={18} /> Самовывоз
          </button>
        </div>
                {orderType === 'delivery' ? (
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Адрес доставки *"
            className="w-full mt-3 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:border-[var(--color-primary)] outline-none transition-colors" />
        ) : (
          <select value={selectedPoint || ''} onChange={e => setSelectedPoint(Number(e.target.value))}
            className="w-full mt-3 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:border-[var(--color-primary)] outline-none transition-colors">
            <option value="">Выберите точку самовывоза</option>
            {pickupPoints.filter((p: any) => p.isActive).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
            ))}
          </select>
        )}
      </div>

      {/* Comment */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Комментарий к заказу" rows={2}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:border-[var(--color-primary)] outline-none transition-colors resize-none" />
      </div>

      {/* Bonuses */}
      {bonusBalance > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Бонусы ({bonusBalance} ₽)</p>
              <p className="text-xs text-gray-400">Можно списать до {Math.floor(maxBonusWriteOff)} ₽</p>
            </div>
            <button onClick={() => setUseBonuses(!useBonuses)}
              className={`relative w-12 h-6 rounded-full transition-colors ${useBonuses ? 'bg-[var(--color-primary)]' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${useBonuses ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      )}

      {/* Payment */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
        <h3 className="font-semibold mb-3">Способ оплаты</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'cash', label: 'Наличные', icon: Banknote },
            { key: 'card', label: 'Картой онлайн', icon: CreditCard },
            { key: 'sbp', label: 'СБП', icon: CreditCard },
          ].map(m => (
            <button key={m.key} onClick={() => setPaymentMethod(m.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${paymentMethod === m.key ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              <m.icon size={16} /> {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-3">Ваш заказ</h3>
        <div className="space-y-1.5 text-sm mb-3">
          {ctx.cart.map(item => (
            <div key={item.dish.id} className="flex justify-between text-[var(--color-text-secondary)]">
              <span>{item.dish.name} × {item.quantity}</span>
              <span>{item.totalPrice} ₽</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span>Сумма</span><span>{ctx.cartTotal} ₽</span></div>
          {ctx.promoDiscount > 0 && <div className="flex justify-between text-green-600"><span>Промокод</span><span>-{ctx.promoDiscount} ₽</span></div>}
          {effectiveBonusDiscount > 0 && <div className="flex justify-between text-[var(--color-primary)]"><span>Бонусы</span><span>-{effectiveBonusDiscount} ₽</span></div>}
          <div className="flex justify-between font-bold text-lg pt-1">
            <span>К оплате</span>
            <span className="text-[var(--color-primary)]">{Math.max(0, total - effectiveBonusDiscount)} ₽</span>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full mt-4 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60 shadow-sm">
          {submitting ? 'Оформление...' : 'Подтвердить заказ'}
        </button>
      </div>
    </div>
  );
}


