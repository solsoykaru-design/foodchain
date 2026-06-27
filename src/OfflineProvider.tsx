import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Wifi, WifiOff, RefreshCw, Database, Cloud, CheckCircle2 } from 'lucide-react';
import { getPendingRequests, markRequestDone, markRequestFailed, getQueueCount, clearDoneRequests } from './offline-queue';

interface OfflineContextType {
  isOnline: boolean;
  queueCount: number;
  retryQueue: () => Promise<void>;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  forceSync: () => Promise<void>;
  pendingCount: number;
  cache: Record<string, any>;
  getCached: (key: string) => any;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true, queueCount: 0, retryQueue: async () => {},
  lastSyncAt: null, syncStatus: 'idle', forceSync: async () => {}, pendingCount: 0,
  cache: {}, getCached: () => undefined,
});

export function useOffline() {
  return useContext(OfflineContext);
}

const SYNC_KEY = 'fc_offline_last_sync';

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(localStorage.getItem(SYNC_KEY));
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [localCache, setLocalCache] = useState<Record<string, any>>({});

  const refreshQueueCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setQueueCount(count);
    } catch {}
  }, []);

  const performSync = useCallback(async () => {
    if (!isOnline) return;
    setSyncStatus('syncing');
    try {
      const API_BASE = localStorage.getItem('foodchain_api_url') || '';
      const token = localStorage.getItem('fc_token') || '';
      const res = await fetch(`${API_BASE}/api/offline/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ actions: [], last_sync_at: lastSyncAt }),
      });
      if (res.ok) {
        const data = await res.json();
        const now = new Date().toISOString();
        localStorage.setItem(SYNC_KEY, now);
        setLastSyncAt(now);
        localStorage.setItem('fc_offline_cache', JSON.stringify(data.syncData || {}));
        setLocalCache(data.syncData || {});
        setSyncStatus('idle');
      }
    } catch { setSyncStatus('error'); }
  }, [isOnline, lastSyncAt]);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); setDismissed(false); performSync(); };
    const onOffline = () => { setIsOnline(false); setDismissed(false); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [performSync]);

  useEffect(() => { refreshQueueCount(); }, [isOnline, refreshQueueCount]);

  // Load local cache from IndexedDB on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('fc_offline_cache');
      if (cached) setLocalCache(JSON.parse(cached));
    } catch {}
  }, []);

  const retryQueue = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const API_BASE = localStorage.getItem('foodchain_api_url') || '';
      const token = localStorage.getItem('fc_token') || localStorage.getItem('foodchain_waiter_token') || '';
      const authHeaders: Record<string, string> = {};
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      const pending = await getPendingRequests();
      for (const req of pending) {
        if (req.id === undefined) continue;
        try {
          const res = await fetch(`${API_BASE}${req.url}`, {
            method: req.method,
            headers: { 'Content-Type': 'application/json', ...authHeaders, ...req.headers },
            body: req.body,
          });
          if (res.ok) {
            await markRequestDone(req.id);
          } else {
            await markRequestFailed(req.id, `HTTP ${res.status}`);
          }
        } catch {
          await markRequestFailed(req.id, 'Network error');
        }
      }
      await clearDoneRequests();
      await refreshQueueCount();
      await performSync();
    } catch {}
    setRetrying(false);
  }, [retrying, refreshQueueCount, performSync]);

  // Auto-retry when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0) {
      retryQueue();
    }
  }, [isOnline, queueCount, retryQueue]);

  // Periodic sync every 5 minutes
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => performSync(), 300000);
    return () => clearInterval(interval);
  }, [isOnline, performSync]);

  // Poll pending count every 2s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const count = await getQueueCount();
        setPendingCount(count);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getCached = useCallback((key: string) => {
    return localCache[key];
  }, [localCache]);

  const forceSync = useCallback(async () => {
    await retryQueue();
    await performSync();
  }, [retryQueue, performSync]);

  return (
    <OfflineContext.Provider value={{ isOnline, queueCount, retryQueue, lastSyncAt, syncStatus, forceSync, pendingCount, cache: localCache, getCached }}>
      {children}

      {/* Sync status indicator */}
      {syncStatus === 'syncing' && (
        <div className="fixed top-1 right-1 z-[9999] w-2 h-2 rounded-full bg-blue-400 animate-pulse" title="Синхронизация..." />
      )}

      {/* Offline banner — fixed at top */}
      {!isOnline && !dismissed && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-between shadow-lg">
          <span className="flex items-center gap-2">
            <WifiOff size={16} /> Нет подключения к интернету
          </span>
          <button onClick={() => setDismissed(true)} className="text-white/80 hover:text-white text-xs font-bold px-2 py-1 rounded">
            ✕
          </button>
        </div>
      )}

      {/* Pending queue banner */}
      {isOnline && queueCount > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999]">
          <button onClick={retryQueue} disabled={retrying}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition">
            {retrying ? <RefreshCw size={16} className="animate-spin" /> : <Wifi size={16} />}
            {retrying ? 'Отправка...' : `Отправить сохранённые (${queueCount})`}
          </button>
        </div>
      )}

      {/* Sync status indicator in bottom-left */}
      {isOnline && lastSyncAt && queueCount === 0 && (
        <div className="fixed bottom-4 left-4 z-[9999]">
          <div className="bg-zinc-900/90 text-zinc-400 text-[10px] px-2.5 py-1.5 rounded-lg ring-1 ring-zinc-800 flex items-center gap-1.5">
            <CheckCircle2 size={10} className="text-green-400" />
            Синхр.: {new Date(lastSyncAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </OfflineContext.Provider>
  );
}
