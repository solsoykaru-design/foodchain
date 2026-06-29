import { useState } from 'react';
import DashboardView from './DashboardView';
import PurchaseOrdersView from './PurchaseOrdersView';
import AlertsView from './AlertsView';
import { useOnlineStatus } from './useOnlineStatus';
import { LayoutDashboard, ShoppingCart, Bell, LogOut, User, Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface Props {
  user: any;
  onLogout: () => void;
}

type Tab = 'dashboard' | 'orders' | 'alerts';

export default function ManagerApp({ user, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const online = useOnlineStatus();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">FoodChain Manager</h1>
            <p className="text-xs text-zinc-500">{user.tenantName || 'Ресторан'}</p>
          </div>
          <div className="flex items-center gap-2">
            {!online && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
                <WifiOff size={14} /> Офлайн
              </span>
            )}
            <button onClick={() => setRefreshKey(k => k + 1)} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500" title="Обновить">
              <RefreshCw size={20} />
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium">{user.name || user.username || 'Управляющий'}</p>
              <p className="text-[10px] text-zinc-500 uppercase">{user.role}</p>
            </div>
            <button onClick={onLogout} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 max-w-md mx-auto sm:max-w-2xl">
        {tab === 'dashboard' && <DashboardView key={refreshKey} onNavigate={setTab} />}
        {tab === 'orders' && <PurchaseOrdersView key={refreshKey} />}
        {tab === 'alerts' && <AlertsView key={refreshKey} />}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-2 pb-safe">
        <div className="flex justify-around max-w-md mx-auto sm:max-w-2xl">
          <NavButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={<LayoutDashboard size={22} />} label="Дашборд" />
          <NavButton active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ShoppingCart size={22} />} label="Заказы" />
          <NavButton active={tab === 'alerts'} onClick={() => setTab('alerts')} icon={<Bell size={22} />} label="Алерты" />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center py-2 px-4 text-xs transition-colors ${active ? 'text-blue-500' : 'text-zinc-500'}`}
    >
      {icon}
      <span className="mt-1">{label}</span>
    </button>
  );
}
