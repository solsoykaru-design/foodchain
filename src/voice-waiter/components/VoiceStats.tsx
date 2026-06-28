import { useState, useEffect } from 'react';
import { BarChart3, Package, Users, Headset, TrendingUp, Clock } from 'lucide-react';
import * as api from '../../api';

interface Stats {
  activeBuffers: number;
  totalHeadsets: number;
  activeHeadsets: number;
}

interface OrderStats {
  total: number;
  byStatus: Record<string, number>;
  byZone: Record<string, number>;
  avgTime: number;
}

export default function VoiceStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      const voiceStats = await api.request('/api/voice/stats');
      setStats(voiceStats);

      const orders = await api.request('/api/orders');
      const ordersArray = Array.isArray(orders) ? orders : [];

      const byStatus: Record<string, number> = {};
      const byZone: Record<string, number> = { kitchen: 0, bar: 0, hookah: 0 };

      for (const order of ordersArray) {
        byStatus[order.status] = (byStatus[order.status] || 0) + 1;

        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        for (const item of items) {
          if (item.zone && byZone[item.zone] !== undefined) {
            byZone[item.zone]++;
          }
        }
      }

      setOrderStats({
        total: ordersArray.length,
        byStatus,
        byZone,
        avgTime: 0,
      });
    } catch (e) {
      console.error('Load stats error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Статистика</h2>
        <p className="text-sm text-zinc-400 mt-1">Общая статистика голосовой системы</p>
      </div>

      {/* Voice System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-orange-900/30 rounded-xl flex items-center justify-center">
              <Headset className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Активные гарнитуры</p>
              <p className="text-3xl font-bold text-white">{stats?.activeHeadsets || 0}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Всего привязано: {stats?.totalHeadsets || 0}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Активные буферы</p>
              <p className="text-3xl font-bold text-white">{stats?.activeBuffers || 0}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Заказы в процессе формирования
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Всего заказов</p>
              <p className="text-3xl font-bold text-white">{orderStats?.total || 0}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            За всё время
          </p>
        </div>
      </div>

      {/* Orders by Status */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-400" />
          Заказы по статусам
        </h3>
        
        <div className="space-y-3">
          {Object.entries(orderStats?.byStatus || {}).map(([status, count]) => {
            const percentage = orderStats ? (count / orderStats.total) * 100 : 0;
            const colors: Record<string, string> = {
              new: 'bg-yellow-500',
              preparing: 'bg-blue-500',
              ready: 'bg-green-500',
              paid: 'bg-purple-500',
              cancelled: 'bg-red-500',
              closed: 'bg-zinc-500',
            };
            const labels: Record<string, string> = {
              new: 'Новые',
              preparing: 'В работе',
              ready: 'Готовы',
              paid: 'Оплачены',
              cancelled: 'Отменены',
              closed: 'Закрыты',
            };

            return (
              <div key={status}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-zinc-300">{labels[status] || status}</span>
                  <span className="text-sm font-bold text-white">{count}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div
                    className={`${colors[status] || 'bg-zinc-500'} h-2 rounded-full transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Orders by Zone */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-400" />
          Заказы по зонам
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-orange-400 mb-1">
              {orderStats?.byZone.kitchen || 0}
            </p>
            <p className="text-sm text-zinc-400">Кухня</p>
          </div>
          
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-400 mb-1">
              {orderStats?.byZone.bar || 0}
            </p>
            <p className="text-sm text-zinc-400">Бар</p>
          </div>
          
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-400 mb-1">
              {orderStats?.byZone.hookah || 0}
            </p>
            <p className="text-sm text-zinc-400">Кальянная</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-bold text-white mb-2">Как работает система</h4>
            <ul className="space-y-1 text-sm text-zinc-300">
              <li>• Официанты подключают Bluetooth-гарнитуры к планшету</li>
              <li>• Система распознаёт речь и автоматически определяет блюда</li>
              <li>• Заказы разбиваются по зонам: кухня, бар, кальянная</li>
              <li>• Буферы очищаются через 10 минут бездействия</li>
              <li>• Голосовые уведомления отправляются при готовности заказа</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
