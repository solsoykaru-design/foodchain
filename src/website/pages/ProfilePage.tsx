import { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Gift, LogOut, ChevronRight, Package, Star, Clock } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';
import * as api from '../../api';

export default function ProfilePage() {
  const ctx = useWebsite();
  const [orders, setOrders] = useState<any[]>([]);
  const [bonusInfo, setBonusInfo] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(ctx.user?.name || '');
  const [editPhone, setEditPhone] = useState(ctx.user?.phone || '');

  useEffect(() => {
    if (ctx.user?.id) {
      api.get(`/api/website/orders?userId=${ctx.user.id}`).then(setOrders).catch(() => {});
      api.get(`/api/loyalty/guest/${ctx.user.id}`).then(setBonusInfo).catch(() => {});
    }
  }, []);

  const handleSaveProfile = async () => {
    try {
      if (ctx.user?.id) {
        await api.put(`/api/website/user/profile`, { userId: ctx.user.id, name: editName, phone: editPhone });
      }
      const updated = { ...ctx.user, name: editName, phone: editPhone };
      localStorage.setItem('website_user', JSON.stringify(updated));
      ctx.setUser(updated);
      setEditing(false);
    } catch (e: any) {
      alert(e.message || 'Ошибка сохранения');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Личный кабинет</h1>

      {/* Profile card */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-xl">
            {(ctx.user?.name || 'Г')[0].toUpperCase()}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Имя"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Телефон"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                <div className="flex gap-2">
                  <button onClick={handleSaveProfile} className="px-4 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium">Сохранить</button>
                  <button onClick={() => setEditing(false)} className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm">Отмена</button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-semibold">{ctx.user?.name || 'Гость'}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{ctx.user?.phone || ''}</p>
                <button onClick={() => setEditing(true)} className="text-xs text-[var(--color-primary)] mt-1 hover:underline">Редактировать</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bonus card */}
      {bonusInfo && (
        <div className="bg-gradient-to-r from-[var(--color-primary)] to-orange-600 rounded-xl p-5 mb-4 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Бонусный баланс</p>
              <p className="text-3xl font-bold">{bonusInfo.bonusBalance || 0} ₽</p>
            </div>
            <Gift size={32} className="text-white/40" />
          </div>
          {bonusInfo.level && (
            <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-sm">
              <span>Уровень: {bonusInfo.level}</span>
              {bonusInfo.nextLevel && (
                <span className="text-white/70">До {bonusInfo.nextLevel}: {bonusInfo.nextLevelProgress || 0}%</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-4 shadow-sm">
        {[
          { icon: Package, label: 'Мои заказы', onClick: () => {} },
          { icon: MapPin, label: 'Мои адреса', onClick: () => {} },
          { icon: Gift, label: 'Программа лояльности', onClick: () => {} },
        ].map((item, i) => (
          <button key={i} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
            <item.icon size={18} className="text-gray-400" />
            <span className="flex-1 text-left font-medium">{item.label}</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
        <h3 className="font-semibold mb-3">История заказов</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">У вас пока нет заказов</p>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 10).map((order: any) => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 text-sm">
                <div>
                  <p className="font-medium">Заказ #{order.id}</p>
                  <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{order.total} ₽</p>
                  <p className={`text-xs ${order.status === 'delivered' ? 'text-green-600' : 'text-orange-500'}`}>
                    {order.status === 'delivered' ? 'Выполнен' : order.status === 'cancelled' ? 'Отменён' : 'В обработке'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logout */}
      <button onClick={ctx.logout} className="w-full flex items-center justify-center gap-2 py-3 border border-red-200 text-red-500 rounded-xl font-medium text-sm hover:bg-red-50 transition-colors">
        <LogOut size={16} /> Выйти
      </button>
    </div>
  );
}
