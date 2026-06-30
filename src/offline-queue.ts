// ─── Offline Request Queue (IndexedDB) ─────────────────────────

const DB_NAME = 'foodchain-offline';
const DB_VERSION = 1;
const STORE = 'requests';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  createdAt: string;
  status: 'pending' | 'done' | 'failed';
  error?: string;
}

export async function enqueueRequest(req: Omit<QueuedRequest, 'id' | 'createdAt' | 'status'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const item: QueuedRequest = { ...req, createdAt: new Date().toISOString(), status: 'pending' };
    const result = store.add(item);
    result.onsuccess = () => resolve(result.result as number);
    result.onerror = () => reject(result.error);
  });
}

export async function getPendingRequests(): Promise<QueuedRequest[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('status');
    const req = index.getAll('pending');
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function markRequestDone(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.status = 'done';
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function markRequestFailed(id: number, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.status = 'failed';
        item.error = error;
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function clearDoneRequests(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const index = store.index('status');
    const req = index.openCursor('done');
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getQueueCount(): Promise<number> {
  const pending = await getPendingRequests();
  return pending.length;
}

export async function processQueue(): Promise<{ processed: number; failed: number }> {
  const pending = await getPendingRequests();
  const API_BASE = (localStorage.getItem('foodchain_api_url') || import.meta.env.VITE_API_URL || '').trim();
  let processed = 0;
  let failed = 0;

  for (const req of pending) {
    try {
      const res = await fetch(`${API_BASE}${req.url}`, {
        method: req.method,
        headers: req.headers || {},
        body: req.body,
      });
      if (res.ok) {
        await markRequestDone(req.id!);
        processed++;
      } else {
        const text = await res.text().catch(() => 'HTTP error');
        await markRequestFailed(req.id!, text);
        failed++;
      }
    } catch (e: any) {
      await markRequestFailed(req.id!, e.message || 'Network error');
      failed++;
    }
  }

  if (processed > 0 || failed > 0) {
    console.log(`[OfflineQueue] processed=${processed}, failed=${failed}`);
  }
  return { processed, failed };
}
