import { useState } from 'react';
import { useApp } from '../context';
import { useMenuData, useBranding } from './GuestApp';
import { ShoppingCart, Plus, Minus, Users, Star, UtensilsCrossed, CheckCircle2 } from 'lucide-react';
import * as api from '../api';

export default function QrMenuPage() {
  const { addToCart, cart, cartTotal, clearCart, setGuestPage, removeFromCart, updateCartQty } = useApp();
  const { dishes, categories } = useMenuData();
  const branding = useBranding();

  const params = new URLSearchParams(window.location.search);
  const tableId = Number(params.get('table_id')) || 0;
  const [guestName, setGuestName] = useState('');
  const [comment, setComment] = useState('');
  const [activeCat, setActiveCat] = useState(0);
  const [placed, setPlaced] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [placing, setPlacing] = useState(false);

  const grouped = categories.map((cat: any) => ({
    ...cat,
    items: dishes.filter((d: any) => d.categoryId === cat.id && d.isAvailable !== false),
  })).filter((g: any) => g.items.length > 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    setOrderError('');
    try {
      const items = cart.map(i => ({
        dishId: i.dish.id,
        name: i.dish.name,
        price: i.dish.price,
        quantity: i.quantity,
        options: Object.entries(i.selectedOptions).flatMap(([, optIds]) =>
          optIds.map(oid => i.dish.customizations?.find(c => c.options.find(o => o.id === oid))?.options.find(o => o.id === oid)?.name || '')
        ).filter(Boolean),
      }));
      await api.request('/api/orders/self-order', {
        method: 'POST',
        body: JSON.stringify({ items, table_id: tableId, guest_name: guestName || 'Гость', comment }),
      });
      clearCart();
      setPlaced(true);
    } catch (e: any) {
      setOrderError(e.message || 'Ошибка при оформлении заказа');
    }
    setPlacing(false);
  };

  if (placed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Заказ отправлен!</h2>
          <p className="text-zinc-400 text-sm mb-6">{guestName || 'Гость'}, ваш заказ принят и передан на кухню</p>
          <button onClick={() => { setPlaced(false); setGuestPage('qr-menu'); }} className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl">
            Сделать новый заказ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-32">
      <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={20} className="text-orange-500" />
            <h1 className="text-lg font-extrabold text-white">{branding?.common?.restaurantName || 'Меню'}</h1>
          </div>
          <button onClick={() => setGuestPage('cart')} className="p-2 relative text-zinc-400">
            <ShoppingCart size={22} />
            {cart.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[9px] min-w-[16px] h-[16px] rounded-full flex items-center justify-center font-bold">
                {cart.length > 9 ? '9+' : cart.length}
              </span>
            )}
          </button>
        </div>
        {tableId > 0 && (
          <div className="px-4 pb-2 max-w-lg mx-auto flex items-center gap-2 text-xs text-zinc-500">
            <Users size={14} />
            <span>Стол {tableId}</span>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-3">
        <input
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
          placeholder="Ваше имя (необязательно)"
          className="w-full bg-zinc-900 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none ring-1 ring-zinc-800 mb-3"
        />
      </div>

      <div className="sticky top-14 z-30 bg-zinc-950 pb-2 max-w-lg mx-auto px-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setActiveCat(0)} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap font-semibold transition-all ${activeCat === 0 ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}>Всё</button>
          {grouped.map((g: any) => (
            <button key={g.id} onClick={() => setActiveCat(g.id)} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap font-semibold transition-all ${activeCat === g.id ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-zinc-400'}`}>{g.name}</button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">
        {(activeCat === 0 ? grouped : grouped.filter((g: any) => g.id === activeCat)).map((g: any) => (
          <div key={g.id} className="mb-6">
            <h3 className="text-sm font-bold text-zinc-400 mb-3 flex items-center gap-2">{g.icon || '📁'} {g.name}</h3>
            <div className="space-y-2">
              {g.items.map((dish: any) => {
                const inCart = cart.find(i => i.dish.id === dish.id);
                return (
                  <div key={dish.id} className="bg-zinc-900 rounded-2xl p-3 flex gap-3 ring-1 ring-zinc-800">
                    <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden text-2xl">
                      {dish.imageUrl ? <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" /> : '🍽️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-sm text-white truncate">{dish.name}</h4>
                        <span className="font-bold text-sm text-orange-500 flex-shrink-0">{dish.price}₽</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{dish.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <Star size={11} fill="#f59e0b" className="text-amber-400" />
                          <span className="text-xs text-zinc-400">{dish.rating}</span>
                          {dish.weight > 0 && <span className="text-xs text-zinc-600 ml-1">{dish.weight}г</span>}
                        </div>
                        {inCart ? (
                          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg">
                            <button onClick={() => {
                              if (inCart.quantity <= 1) removeFromCart(dish.id);
                              else updateCartQty(dish.id, inCart.quantity - 1);
                            }} className="p-1.5 text-zinc-400 active:text-white"><Minus size={14} /></button>
                            <span className="text-sm font-bold text-white w-6 text-center">{inCart.quantity}</span>
                            <button onClick={() => addToCart(dish, 1)} className="p-1.5 text-zinc-400 active:text-white"><Plus size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(dish, 1)} className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white active:scale-90 transition-transform">
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 p-4 z-50">
          <div className="max-w-lg mx-auto">
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Комментарий к заказу..."
              className="w-full bg-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none mb-3"
            />
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm text-zinc-400">
                {cart.reduce((s, i) => s + i.quantity, 0)} позиций
              </span>
              <span className="text-xl font-extrabold text-white">{cartTotal}₽</span>
            </div>
            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="w-full bg-orange-500 text-white font-extrabold py-3.5 rounded-xl active:scale-[0.99] transition-transform shadow-lg shadow-orange-500/20 disabled:opacity-50"
            >
              {placing ? 'Отправка...' : 'Отправить заказ на кухню'}
            </button>
            {orderError && <p className="text-red-500 text-xs mt-2 text-center">{orderError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
