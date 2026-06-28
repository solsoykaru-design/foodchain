import { useState, useEffect } from 'react';
import { Headset, Package, Users, BarChart3, Settings } from 'lucide-react';
import OrdersDashboard from './components/OrdersDashboard';
import HeadsetsAdmin from './components/HeadsetsAdmin';
import VoiceStats from './components/VoiceStats';
import * as api from '../api';

type Tab = 'orders' | 'headsets' | 'stats';

export default function VoiceWaiterApp() {
  const [tab, setTab] = useState<Tab>('orders');
  const [connected, setConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/voice`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('[VoiceWaiter] WebSocket connected');
      setConnected(true);
    };

    socket.onclose = () => {
      console.log('[VoiceWaiter] WebSocket disconnected');
      setConnected(false);
    };

    socket.onerror = (err) => {
      console.error('[VoiceWaiter] WebSocket error:', err);
      setConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[VoiceWaiter] Message:', data);
        
        if (data.type === 'ordersUpdated') {
          // Trigger refresh of orders dashboard
          window.dispatchEvent(new CustomEvent('voiceOrdersUpdated', { detail: data }));
        }
      } catch (e) {
        console.error('[VoiceWaiter] Parse error:', e);
      }
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headset className="w-8 h-8 text-orange-500" />
            <div>
              <h1 className="text-2xl font-bold">Голосовой AI-официант</h1>
              <p className="text-sm text-zinc-400">Планшет управления заказами</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              connected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {connected ? 'Подключено' : 'Отключено'}
              </span>
            </div>
            
            <div className="text-sm text-zinc-400">
              {new Date().toLocaleDateString('ru-RU', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-zinc-900/50 border-b border-zinc-800 px-6">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('orders')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              tab === 'orders'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Package className="w-5 h-5" />
            Заказы
          </button>
          
          <button
            onClick={() => setTab('headsets')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              tab === 'headsets'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Headset className="w-5 h-5" />
            Гарнитуры
          </button>
          
          <button
            onClick={() => setTab('stats')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              tab === 'stats'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            Статистика
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="p-6">
        {tab === 'orders' && <OrdersDashboard />}
        {tab === 'headsets' && <HeadsetsAdmin />}
        {tab === 'stats' && <VoiceStats />}
      </main>
    </div>
  );
}
