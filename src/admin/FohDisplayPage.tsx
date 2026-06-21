import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../api';
import type { Order } from '../types';
import { Clock, Users } from 'lucide-react';

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

function getWaitColor(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = diff / 60000;
  if (mins > 10) return 'bg-red-600 border-red-400';
  if (mins > 5) return 'bg-yellow-600 border-yellow-400';
  return 'bg-green-700 border-green-400';
}

function getWaitTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  return `${h} ч ${mins % 60} мин`;
}

export default function FohDisplayPage() {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [mode, setMode] = useState<'ready' | 'all'>('all');
  const prevIds = useRef<Set<number>>(new Set());

  const loadOrders = useCallback(async () => {
    try {
      const data = await api.getOrdersMultiStatus(['ready', 'preparing']);
      const ready = (data || []).filter((o: Order) => o.status === 'ready');
      const currentIds = new Set(ready.map((o: Order) => o.id));
      currentIds.forEach(id => {
        if (!prevIds.current.has(id)) {
          playBeep();
        }
      });
      prevIds.current = currentIds;
      setAllOrders(data || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 3000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const displayOrders = mode === 'ready'
    ? allOrders.filter(o => o.status === 'ready')
    : allOrders;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-3xl font-bold tracking-wide">Экран раздачи</h1>
        <div className="flex gap-2 bg-zinc-900 rounded-2xl p-1">
          <button onClick={() => setMode('all')}
            className={`px-6 py-3 rounded-xl text-xl font-bold transition-all ${mode === 'all' ? 'bg-blue-500 text-white' : 'text-zinc-400 hover:text-white'}`}>
            Все ({allOrders.length})
          </button>
          <button onClick={() => setMode('ready')}
            className={`px-6 py-3 rounded-xl text-xl font-bold transition-all ${mode === 'ready' ? 'bg-green-500 text-white' : 'text-zinc-400 hover:text-white'}`}>
            Готовые ({allOrders.filter(o => o.status === 'ready').length})
          </button>
        </div>
        <div className="text-zinc-500 text-xl">
          <Clock size={24} className="inline mr-2" />
          {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 auto-rows-max content-start">
        {displayOrders.map(order => {
          const isReady = order.status === 'ready';
          return (
            <div key={order.id}
              className={`rounded-3xl border-2 p-6 flex flex-col min-h-[220px] transition-all ${getWaitColor(order.createdAt)} ${isReady ? 'ring-2 ring-green-300/50' : 'opacity-80'}`}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-5xl font-black tracking-wider">#{order.id}</span>
                <span className={`text-2xl font-bold px-4 py-1.5 rounded-xl ${isReady ? 'bg-green-500 text-black' : 'bg-amber-500 text-black'}`}>
                  {isReady ? 'ГОТОВ' : order.status === 'preparing' ? 'ГОТОВИТСЯ' : order.status}
                </span>
              </div>

              <div className="flex items-center gap-2 text-2xl mb-3">
                <Clock size={22} />
                <span className="font-bold">{getWaitTime(order.createdAt)}</span>
              </div>

              {(order.userName || order.tableNumber) && (
                <div className="flex items-center gap-2 text-xl mb-3 text-white/80">
                  <Users size={20} />
                  <span>{order.userName || `Стол ${order.tableNumber}`}</span>
                </div>
              )}

              <div className="flex-1 space-y-1.5 mt-1">
                {(order.items || []).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xl">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-bold text-white/70 ml-2">×{item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-white/20 flex justify-between items-center text-lg">
                <span className="text-white/60">{order.type === 'pickup' ? 'Самовывоз' : order.type === 'dine_in' ? 'В зале' : 'Доставка'}</span>
                {order.paymentMethod && <span className="font-medium">{order.paymentMethod === 'cash' ? 'Наличные' : 'Карта'}</span>}
              </div>
            </div>
          );
        })}
        {displayOrders.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-64">
            <p className="text-4xl text-zinc-600 font-bold">Нет заказов</p>
          </div>
        )}
      </div>
    </div>
  );
}
