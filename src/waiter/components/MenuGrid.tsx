import { useState, useMemo } from 'react';
import { Search, X, Plus, Minus, ShoppingCart, Trash2, Camera } from 'lucide-react';
import type { Dish, MenuCategory } from '../../types';
import BarcodeScanner from '../../admin/BarcodeScanner';
import * as api from '../../api';
import { usePrice } from '../../PriceContext';

interface CartItem {
  dish: Dish;
  quantity: number;
  modifiers: string[];
  comment: string;
  unitPrice: number;
  totalPrice: number;
}

export default function MenuGrid({
  dishes, categories, onSendOrder,
}: {
  dishes: Dish[]; categories: MenuCategory[];
  onSendOrder: (items: CartItem[], options: OrderOptions) => void;
}) {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [dishModal, setDishModal] = useState<Dish | null>(null);
  const [dishQty, setDishQty] = useState(1);
  const [dishModifiers, setDishModifiers] = useState<string[]>([]);
  const [dishComment, setDishComment] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'delivery' | 'pickup'>('dine_in');
  const [deliveryFields, setDeliveryFields] = useState({ address: '', phone: '', name: '', comment: '' });
  const [pickupPointId, setPickupPointId] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [orderComment, setOrderComment] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const handleBarcodeScan = async (barcode: string) => {
    setShowBarcodeScanner(false);
    try {
      const results = await api.lookupDishByBarcode(barcode);
      const found = Array.isArray(results) ? results.find(d => d.barcode === barcode) : results;
      if (found) {
        const dish = dishes.find(d => d.id === found.id) || found as Dish;
        openDishModal(dish);
      } else {
        alert('Блюдо с таким штрихкодом не найдено');
      }
    } catch { alert('Ошибка поиска по штрихкоду'); }
  };

  const filtered = useMemo(() => {
    let list = dishes;
    if (search) { const q = search.toLowerCase(); list = list.filter(d => d.name.toLowerCase().includes(q)); }
    if (activeCat) list = list.filter(d => d.categoryId === activeCat);
    return list;
  }, [dishes, search, activeCat]);

  const subtotal = cart.reduce((s, i) => s + i.totalPrice, 0);
  const discountAmount = discountType === 'percent' ? subtotal * (discountValue / 100) : discountValue;
  const total = Math.max(0, subtotal - discountAmount);

  const openDishModal = (dish: Dish) => {
    setDishModal(dish);
    setDishQty(1);
    setDishModifiers([]);
    setDishComment('');
  };

  const addToCart = () => {
    if (!dishModal) return;
    const extrasPrice = dishModal.customizations?.reduce((sum, c) => {
      return sum + c.options.filter(o => dishModifiers.includes(o.name)).reduce((s, o) => s + o.price, 0);
    }, 0) || 0;
    const unitPrice = dishModal.price + extrasPrice;
    setCart(prev => {
      const existing = prev.findIndex(i => i.dish.id === dishModal.id && JSON.stringify(i.modifiers) === JSON.stringify(dishModifiers));
      if (existing >= 0) {
        return prev.map((i, idx) => idx === existing ? { ...i, quantity: i.quantity + dishQty, totalPrice: (i.quantity + dishQty) * unitPrice } : i);
      }
      return [...prev, { dish: dishModal, quantity: dishQty, modifiers: dishModifiers, comment: dishComment, unitPrice, totalPrice: unitPrice * dishQty }];
    });
    setDishModal(null);
  };

  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const handleSend = () => {
    if (!cart.length) return;
    onSendOrder(cart, { orderType, discountType, discountValue, orderComment, ...(orderType === 'delivery' ? deliveryFields : {}), pickupPointId, deliveryFields });
    setCart([]);
    setOrderComment('');
    setDiscountValue(0);
    setShowCart(false);
  };

  return (
    <>
      {/* Menu header */}
      <div className="pb-4 pt-4 px-4">
        <div className="flex items-center gap-2 bg-zinc-900 rounded-xl px-3 py-2.5 ring-1 ring-zinc-800 mb-3">
          <Search size={18} className="text-zinc-500 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск блюд..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" />
          {search && <button onClick={() => setSearch('')}><X size={16} className="text-zinc-500" /></button>}
          <button onClick={() => setShowBarcodeScanner(true)} className="p-1.5 text-zinc-400 hover:text-white transition" title="Сканировать штрихкод">
            <Camera size={18} />
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-3">
          <button onClick={() => setActiveCat(null)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap font-semibold transition-all ${activeCat === null ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}>Всё</button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap font-semibold transition-all ${activeCat === cat.id ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}>
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Dish grid */}
      <div className="px-4 pb-4 space-y-2">
        {filtered.map(dish => (
          <div key={dish.id} onClick={() => openDishModal(dish)}
            className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform ring-1 ring-zinc-800 cursor-pointer">
            <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
              {dish.imageUrl ? <img src={dish.imageUrl} className="w-full h-full object-cover" /> : (categories.find(c => c.id === dish.categoryId)?.icon || '🍽️')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-white truncate">{dish.name}</div>
              <div className="text-xs text-zinc-500 mt-0.5 truncate">{dish.description}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-extrabold text-orange-500">{usePrice()(dish.price)}</span>
                {dish.weight > 0 && <span className="text-[10px] text-zinc-600">{dish.weight}г</span>}
                {dish.calories > 0 && <span className="text-[10px] text-zinc-600">{dish.calories}ккал</span>}
              </div>
            </div>
            <button className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white active:scale-90">
              <Plus size={20} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-500 font-semibold">Ничего не найдено</div>
        )}
      </div>

      {/* Dish detail modal */}
      {dishModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center" onClick={() => setDishModal(null)}>
          <div className="bg-zinc-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Image */}
            <div className="h-48 bg-zinc-800 rounded-t-3xl flex items-center justify-center overflow-hidden">
              {dishModal.imageUrl ? (
                <img src={dishModal.imageUrl} className="w-full h-full object-cover" />
              ) : (
                <span className="text-6xl">{categories.find(c => c.id === dishModal.categoryId)?.icon || '🍽️'}</span>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-xl font-extrabold text-white">{dishModal.name}</h3>
                  <p className="text-sm text-zinc-400 mt-1">{dishModal.description}</p>
                </div>
                <button onClick={() => setDishModal(null)} className="p-1.5 bg-zinc-800 rounded-xl text-zinc-500"><X size={18} /></button>
              </div>

              {/* KBJU */}
              <div className="flex gap-4 mb-4 text-xs text-zinc-500">
                {dishModal.calories > 0 && <span>🔥 {dishModal.calories} ккал</span>}
                {dishModal.proteins > 0 && <span>🥩 {dishModal.proteins}г</span>}
                {dishModal.fats > 0 && <span>🧈 {dishModal.fats}г</span>}
                {dishModal.carbs > 0 && <span>🍞 {dishModal.carbs}г</span>}
                {dishModal.weight > 0 && <span>⚖️ {dishModal.weight}г</span>}
              </div>

              {/* Allergens */}
              {dishModal.allergens?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-zinc-500 mb-1">Аллергены:</p>
                  <div className="flex flex-wrap gap-1">
                    {dishModal.allergens.map(a => (
                      <span key={a} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Modifiers */}
              {dishModal.customizations?.map(cust => (
                <div key={cust.id} className="mb-4">
                  <p className="text-sm font-semibold text-zinc-300 mb-2">
                    {cust.name} {cust.required ? <span className="text-red-400">*</span> : ''}
                    {cust.multiple ? <span className="text-zinc-600 text-xs ml-1">(можно несколько)</span> : ''}
                  </p>
                  <div className="space-y-1.5">
                    {cust.options.map(opt => (
                      <label key={opt.id} className="flex items-center justify-between bg-zinc-800/50 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <input type={cust.multiple ? 'checkbox' : 'radio'} name={`cust-${cust.id}`}
                            checked={dishModifiers.includes(opt.name)}
                            onChange={() => {
                              if (cust.multiple) {
                                setDishModifiers(prev => prev.includes(opt.name) ? prev.filter(m => m !== opt.name) : [...prev, opt.name]);
                              } else {
                                setDishModifiers(prev => [...prev.filter(m => !cust.options.some(o => o.name === m)), opt.name]);
                              }
                            }}
                            className="w-4 h-4 accent-orange-500" />
                          <span className="text-sm text-zinc-300">{opt.name}</span>
                        </div>
                        {opt.price > 0 && <span className="text-xs text-orange-500">+{usePrice()(opt.price)}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Comment */}
              <div className="mb-5">
                <p className="text-sm font-semibold text-zinc-300 mb-1">Комментарий к блюду</p>
                <input value={dishComment} onChange={e => setDishComment(e.target.value)}
                  placeholder="Например, без лука, средний прожарки"
                  className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none" />
              </div>

              {/* Qty + Add */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2">
                  <button onClick={() => setDishQty(Math.max(1, dishQty - 1))} className="p-1 text-zinc-400"><Minus size={16} /></button>
                  <span className="text-lg font-extrabold text-white w-8 text-center">{dishQty}</span>
                  <button onClick={() => setDishQty(dishQty + 1)} className="p-1 text-zinc-400"><Plus size={16} /></button>
                </div>
                <button onClick={addToCart} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl text-sm">
                  Добавить {dishQty > 1 ? `(${dishQty} шт)` : ''} — {usePrice()(((dishModal.price + (dishModal.customizations?.reduce((s, c) => s + (c.options?.filter(o => dishModifiers.includes(o.name))?.reduce((ss, o) => ss + o.price, 0) || 0), 0) || 0)) * dishQty))}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart FAB */}
      {cart.length > 0 && (
        <button onClick={() => setShowCart(true)}
          className="fixed bottom-20 right-4 z-40 bg-orange-500 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-90 transition-transform">
          <ShoppingCart size={24} />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[22px] h-[22px] rounded-full flex items-center justify-center font-bold shadow-lg">
            {cart.reduce((s, i) => s + i.quantity, 0)}
          </span>
        </button>
      )}

      {/* Cart modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center" onClick={() => setShowCart(false)}>
          <div className="bg-zinc-900 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2"><ShoppingCart size={20} /> Корзина</h3>
              <button onClick={() => setShowCart(false)} className="p-1.5 bg-zinc-800 rounded-xl text-zinc-500"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="bg-zinc-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-white">{item.dish.name}</span>
                    <span className="text-sm font-extrabold text-orange-500">{usePrice()(item.totalPrice)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>×{item.quantity}</span>
                    {item.modifiers.length > 0 && <span>{item.modifiers.join(', ')}</span>}
                  </div>
                  {item.comment && <p className="text-[10px] text-zinc-600 mt-1 italic">«{item.comment}»</p>}
                  <button onClick={() => removeFromCart(idx)} className="mt-1 text-[10px] text-red-400 flex items-center gap-1">
                    <Trash2 size={12} /> Удалить
                  </button>
                </div>
              ))}
            </div>

            {/* Order type */}
            <div className="px-5 pb-3">
              <p className="text-sm font-semibold text-zinc-400 mb-2">Тип заказа</p>
              <div className="flex gap-2">
                {[
                  { key: 'dine_in', label: 'В зале', icon: '🍽️' },
                  { key: 'delivery', label: 'Доставка', icon: '🛵' },
                  { key: 'pickup', label: 'Самовывоз', icon: '📦' },
                ].map(t => (
                  <button key={t.key} onClick={() => setOrderType(t.key as any)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${orderType === t.key ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery fields */}
            {orderType === 'delivery' && (
              <div className="px-5 pb-3 space-y-2">
                <input value={deliveryFields.name} onChange={e => setDeliveryFields(p => ({ ...p, name: e.target.value }))}
                  placeholder="Имя клиента" className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none" />
                <input value={deliveryFields.phone} onChange={e => setDeliveryFields(p => ({ ...p, phone: e.target.value }))}
                  placeholder="Телефон" className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none" />
                <input value={deliveryFields.address} onChange={e => setDeliveryFields(p => ({ ...p, address: e.target.value }))}
                  placeholder="Адрес доставки" className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none" />
                <input value={deliveryFields.comment} onChange={e => setDeliveryFields(p => ({ ...p, comment: e.target.value }))}
                  placeholder="Комментарий к доставке" className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none" />
              </div>
            )}

            {/* Discount */}
            <div className="px-5 pb-3">
              <p className="text-sm font-semibold text-zinc-400 mb-2">Скидка</p>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setDiscountType('percent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${discountType === 'percent' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>%</button>
                <button onClick={() => setDiscountType('fixed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${discountType === 'fixed' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>₽</button>
                <input type="number" value={discountValue || ''} onChange={e => setDiscountValue(Number(e.target.value))}
                  placeholder="0" className="flex-1 bg-zinc-800 rounded-xl px-3 py-1.5 text-sm text-white outline-none" />
              </div>
            </div>

            {/* Comment */}
            <div className="px-5 pb-3">
              <input value={orderComment} onChange={e => setOrderComment(e.target.value)}
                placeholder="Комментарий к заказу" className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none" />
            </div>

            {/* Totals */}
            <div className="px-5 pb-5 space-y-1 border-t border-zinc-800 pt-4">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Сумма</span><span>{usePrice()(subtotal)}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Скидка</span><span>-{usePrice()(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-extrabold text-white pt-1">
                <span>Итого</span><span>{usePrice()(total)}</span>
              </div>
              <button onClick={handleSend}
                className="w-full mt-3 bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm active:scale-[0.99]">
                Отправить на кухню ({usePrice()(total)})
              </button>
              <button onClick={() => setCart([])}
                className="w-full mt-2 bg-zinc-800 text-zinc-400 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1">
                <Trash2 size={14} /> Очистить корзину
              </button>
            </div>
          </div>
        </div>
      )}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </>
  );
}

export type { CartItem };

interface OrderOptions {
  orderType: 'dine_in' | 'delivery' | 'pickup';
  discountType: 'percent' | 'fixed';
  discountValue: number;
  orderComment: string;
  pickupPointId?: number | null;
  deliveryFields?: { address: string; phone: string; name: string; comment: string };
}
export type { OrderOptions };
