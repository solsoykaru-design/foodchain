import type { Order, OrderStatus, Review, BarcodeGenerateResult } from './types';

const API_BASE = localStorage.getItem('foodchain_api_url') || '';

const listeners: Record<string, Array<(data: any) => void>> = {};

export function onEvent(type: string, fn: (data: any) => void) {
  if (!listeners[type]) listeners[type] = [];
  listeners[type].push(fn);
  if (type.startsWith('order') || type.startsWith('poll')) {
    startPollingIfNeeded();
  }
  return () => {
    listeners[type] = listeners[type].filter(f => f !== fn);
  };
}

export function offEvent(type: string, fn: (data: any) => void) {
  if (listeners[type]) listeners[type] = listeners[type].filter(f => f !== fn);
}

function emit(type: string, data: any) {
  const ev = listeners[type];
  if (ev) ev.forEach(fn => fn(data));
}

let lastFetch = 0;
let polling = false;
let knownOrders = new Map<number, { updatedAt: string; courierId?: number }>();

function startPolling() {
  if (polling) return;
  polling = true;
  const poll = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders?t=${Date.now()}`);
      if (res.ok) {
        const orders: Order[] = await res.json();
        if (knownOrders.size === 0) {
          orders.forEach(o => knownOrders.set(o.id, { updatedAt: o.updatedAt, courierId: o.courierId }));
        } else {
          orders.forEach(o => {
            const known = knownOrders.get(o.id);
            if (!known) {
              knownOrders.set(o.id, { updatedAt: o.updatedAt, courierId: o.courierId });
              emit('order:new', o);
              emit('order:update', o);
              if (o.courierId) emit('order:courier', o);
            } else if (known.updatedAt !== o.updatedAt || known.courierId !== o.courierId) {
              const courierChanged = known.courierId !== o.courierId;
              knownOrders.set(o.id, { updatedAt: o.updatedAt, courierId: o.courierId });
              emit('order:update', o);
              if (courierChanged && o.courierId) emit('order:courier', o);
            }
          });
        }
        emit('poll:orders', orders);
      }
    } catch {}
    lastFetch = Date.now();
  };
  poll();
  setInterval(poll, 3000);
}

export function startPollingIfNeeded() {
  if (!polling) startPolling();
}

async function enqueueAndReturn(path: string, options: RequestInit) {
  try {
    const { enqueueRequest } = await import('./offline-queue');
    const token = localStorage.getItem('fc_token') || localStorage.getItem('foodchain_waiter_token') || '';
    const reqHeaders: Record<string, string> = {};
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    await enqueueRequest({
      url: path, method: options.method || 'POST',
      body: options.body as string | undefined,
      headers: { ...reqHeaders, ...options?.headers as Record<string, string> | undefined },
    });
    return { queued: true, message: 'Запрос сохранён и будет отправлен при восстановлении соединения' };
  } catch (e) { console.warn('[Offline] Queue error:', e); }
  throw new OfflineError('Нет подключения к интернету');
}

function serveFromCacheOrThrow(path: string, fallbackMsg: string) {
  try {
    const cached = localStorage.getItem('fc_offline_cache');
    if (cached) {
      const data = JSON.parse(cached);
      const key = Object.keys(data).find(k => path.includes(k));
      if (key) return data[key];
    }
  } catch {}
  throw new OfflineError(fallbackMsg);
}

const REQUEST_TIMEOUT = 25000;

export async function request(path: string, options?: RequestInit) {
  const token = localStorage.getItem('fc_token');
  const authHeaders: Record<string, string> = {};
  if (token) authHeaders['Authorization'] = `Bearer ${token}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...authHeaders, ...options?.headers },
    });
    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      if (body.offline) {
        if (options?.method && options.method !== 'GET') {
          return await enqueueAndReturn(path, options);
        }
        return serveFromCacheOrThrow(path, body.error || 'Нет подключения к интернету');
      }
    }
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'API Error');
    }
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof OfflineError) throw err;
    if (err instanceof TypeError && err.message.includes('fetch')) {
      if (options?.method && options.method !== 'GET') {
        return await enqueueAndReturn(path, options);
      }
      return serveFromCacheOrThrow(path, 'Нет подключения к интернету');
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Таймаут запроса');
    }
    throw err;
  }
}

export class OfflineError extends Error {
  constructor(msg: string) { super(msg); this.name = 'OfflineError'; }
}

export function get(path: string) { return request(path); }

export function post(path: string, body?: any) { return request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); }

export function put(path: string, body?: any) { return request(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }); }

export function del(path: string) { return request(path, { method: 'DELETE' }); }

// Auth
export async function requestCode(phone: string): Promise<{ success: boolean; message: string }> {
  return request('/api/auth/request-code', { method: 'POST', body: JSON.stringify({ phone }) });
}

export async function verifyCode(phone: string, code: string): Promise<{ success: boolean; message: string }> {
  return request('/api/auth/verify-code', { method: 'POST', body: JSON.stringify({ phone, code }) });
}

export async function phoneLogin(phone: string, name?: string): Promise<{ token: string; user: any }> {
  const body: any = { phone };
  if (name) body.name = name;
  const data = await request('/api/auth/phone-login', { method: 'POST', body: JSON.stringify(body) });
  if (data.token) {
    localStorage.setItem('fc_token', data.token);
  }
  return data;
}

export async function getMe(): Promise<{ user: any }> {
  return request('/api/auth/me');
}

export async function updateProfile(data: { name?: string; email?: string; birthday?: string }): Promise<{ user: any }> {
  return request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) });
}

export async function login(phone: string, password?: string, role?: string) {
  const body: any = { phone, role };
  if (password) body.password = password;
  const data = await request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
  return data;
}

export async function register(name: string, phone: string, role?: string, password?: string) {
  const body: any = { name, phone, role };
  if (password) body.password = password;
  const data = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
  return data;
}

export async function adminLogin(username: string, password: string, twoFactorCode?: string) {
  const body: any = { username, password };
  if (twoFactorCode) body.twoFactorCode = twoFactorCode;
  const data = await request('/api/auth/admin-login', { method: 'POST', body: JSON.stringify(body) });
  return data;
}

// 2FA
export async function get2FAStatus(staffId: number): Promise<{ enabled: boolean }> {
  return request(`/api/auth/2fa/status?staffId=${staffId}`);
}
export async function setup2FA(staffId: number): Promise<{ secret: string; qrCode: string }> {
  return request('/api/auth/2fa/setup', { method: 'POST', body: JSON.stringify({ staffId }) });
}
export async function verify2FA(staffId: number, token: string): Promise<{ success: boolean }> {
  return request('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ staffId, token }) });
}
export async function disable2FA(staffId: number): Promise<{ success: boolean }> {
  return request('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ staffId }) });
}

// Orders
export async function getOrders(params?: { status?: string; courier_id?: number; user_id?: number }): Promise<Order[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.courier_id) query.set('courier_id', String(params.courier_id));
  if (params?.user_id) query.set('user_id', String(params.user_id));
  const qs = query.toString();
  return request(`/api/orders${qs ? '?' + qs : ''}`);
}

export async function getOrder(id: number): Promise<Order> {
  return request(`/api/orders/${id}`);
}

export async function getOrdersTrack(phone: string): Promise<Order[]> {
  return request(`/api/orders/track?phone=${encodeURIComponent(phone)}`);
}

export async function getOrderTracking(id: number): Promise<any> {
  return request(`/api/orders/${id}/tracking`);
}

export async function getOrderChatInfo(id: number): Promise<any> {
  return request(`/api/orders/${id}/chat`);
}

export async function createOrder(data: {
  user_id: number; user_name: string; user_phone: string;
  address?: string; items: any[]; total: number;
  payment_method?: string; type?: string; comment?: string;
  bonus_used?: number; promo_code?: string;
}): Promise<Order> {
  return request('/api/orders', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateOrderStatus(id: number, status: OrderStatus, note?: string): Promise<Order> {
  return request(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) });
}

export async function assignOrder(id: number, courier_id: number, courier_name: string, assigned_by: number): Promise<Order> {
  return request(`/api/orders/${id}/assign`, { method: 'PUT', body: JSON.stringify({ courier_id, courier_name, assigned_by }) });
}

export async function updateOrderItems(id: number, items: { dishId: number; quantity: number }[]): Promise<Order> {
  return request(`/api/orders/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) });
}

export async function assignOrderCourier(id: number, courier_id: number, courier_name: string): Promise<Order> {
  return request(`/api/orders/${id}/assign-courier`, { method: 'PUT', body: JSON.stringify({ courier_id, courier_name }) });
}

export async function splitOrder(id: number, splits: any[]): Promise<any> { return request(`/api/orders/${id}/split`, { method: 'PATCH', body: JSON.stringify({ splits }) }); }
export async function getOrderSplits(id: number): Promise<any> { return request(`/api/orders/${id}/splits`); }
export async function payOrderSplit(splitId: number, method: string): Promise<any> { return request(`/api/order-splits/${splitId}/pay`, { method: 'POST', body: JSON.stringify({ payment_method: method }) }); }

export async function changeOrderStatus(id: number, status: string, note?: string): Promise<Order> {
  return request(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) });
}

// Users
export async function getUsers(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/api/users${qs}`);
}

// Couriers
export async function getCouriers(availableOnly?: boolean) {
  const qs = availableOnly ? '?available=true' : '';
  return request(`/api/couriers${qs}`);
}

export async function updateCourierAvailability(id: number, is_available: boolean) {
  return request(`/api/couriers/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ is_available }) });
}

// Reviews
export async function getReviews(order_id?: number): Promise<Review[]> {
  const qs = order_id ? `?order_id=${order_id}` : '';
  return request(`/api/reviews${qs}`);
}

export async function createReview(data: {
  order_id: number; user_id: number; user_name: string;
  dish_name?: string; rating: number; text: string; courier_id?: number;
}) {
  return request('/api/reviews', { method: 'POST', body: JSON.stringify(data) });
}

// Notifications
export async function getNotifications(params?: { user_id?: number; courier_id?: number }) {
  const query = new URLSearchParams();
  if (params?.user_id) query.set('user_id', String(params.user_id));
  if (params?.courier_id) query.set('courier_id', String(params.courier_id));
  const qs = query.toString();
  return request(`/api/notifications${qs ? '?' + qs : ''}`);
}

export async function markNotificationRead(id: number) {
  return request(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

// ─── Tenant Limits ──────────────────────────────────────────────
export async function getTenantLimits(): Promise<{ tenant_id: number; usage: Record<string, { limit: number; current: number }> }> {
  return request('/api/tenant-limits');
}

// ─── Branding ─────────────────────────────────────────────────────
export async function getBranding(): Promise<{ branding: any }> {
  return request('/api/branding');
}

export async function saveBranding(branding: any): Promise<{ branding: any; message: string }> {
  return request('/api/branding', { method: 'PUT', body: JSON.stringify({ branding }) });
}

export async function resetBranding(): Promise<{ branding: any; message: string }> {
  return request('/api/branding/reset', { method: 'POST' });
}

export async function uploadBrandingImage(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('fc_token');
  const res = await fetch(`${API_BASE}/api/branding/upload`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
  return res.json();
}

// ─── Site Settings ─────────────────────────────────────────────────
export async function getSiteSettings(): Promise<{ settings: any }> {
  return request('/api/site-settings');
}

export async function saveSiteSettings(settings: any): Promise<{ settings: any; message: string }> {
  return request('/api/site-settings', { method: 'PUT', body: JSON.stringify({ settings }) });
}

export async function resetSiteSettings(): Promise<{ settings: any; message: string }> {
  return request('/api/site-settings/reset', { method: 'POST' });
}

export async function uploadSiteImage(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('fc_token');
  const res = await fetch(`${API_BASE}/api/site-settings/upload`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
  return res.json();
}

// Dishes
export async function getMenuItems(params: {
  category_id?: number; store_id?: number; tech_card_filter?: string; type?: string;
  search?: string; sort_by?: string; sort_order?: string; page?: number; limit?: number;
} = {}): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number }> {
  const qs = new URLSearchParams();
  if (params.category_id) qs.set('category_id', String(params.category_id));
  if (params.store_id) qs.set('store_id', String(params.store_id));
  if (params.tech_card_filter) qs.set('tech_card_filter', params.tech_card_filter);
  if (params.type) qs.set('type', params.type);
  if (params.search) qs.set('search', params.search);
  if (params.sort_by) qs.set('sort_by', params.sort_by);
  if (params.sort_order) qs.set('sort_order', params.sort_order);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return request(`/api/menu-items${q ? '?' + q : ''}`);
}

export async function getDishes(categoryId?: number, includeSubcats?: boolean): Promise<any[]> {
  const params = new URLSearchParams();
  if (categoryId) params.set('category_id', String(categoryId));
  if (includeSubcats) params.set('include_subcategories', 'true');
  const qs = params.toString();
  return request(`/api/dishes${qs ? '?' + qs : ''}`);
}

export async function createDish(data: any): Promise<any> {
  return request('/api/dishes', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDish(id: number, data: any): Promise<any> {
  return request(`/api/dishes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteDish(id: number): Promise<void> {
  return request(`/api/dishes/${id}`, { method: 'DELETE' });
}

export async function getFohOrders(): Promise<any> { return request('/api/kitchen/orders?status=preparing,ready'); }

// Menu Categories
export async function getMenuCategories(tree?: boolean): Promise<any[]> {
  const qs = tree ? '?tree=true' : '';
  return request(`/api/menu-categories${qs}`);
}

export async function createMenuCategory(data: any): Promise<any> {
  return request('/api/menu-categories', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateMenuCategory(id: number, data: any): Promise<any> {
  return request(`/api/menu-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteMenuCategory(id: number): Promise<void> {
  return request(`/api/menu-categories/${id}`, { method: 'DELETE' });
}

export async function updateMenuCategoryVisibility(id: number, data: Record<string, boolean>): Promise<any> {
  return request(`/api/menu-categories/${id}/visibility`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function batchUpdateMenuCategoryVisibility(ids: number[], data: Record<string, boolean>): Promise<any> {
  return request('/api/menu-categories/batch-visibility', { method: 'PUT', body: JSON.stringify({ ids, ...data }) });
}

export async function getPublicMenu(channel: string): Promise<any> {
  return request(`/api/public/menu?channel=${channel}`);
}

// Tech Cards
export async function getTechCards(dishId?: number): Promise<any[]> {
  const qs = dishId ? `?dish_id=${dishId}` : '';
  return request(`/api/tech-cards${qs}`);
}

export async function createTechCard(data: any): Promise<any> {
  return request('/api/tech-cards', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTechCard(id: number, data: any): Promise<any> {
  return request(`/api/tech-cards/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTechCard(id: number): Promise<void> {
  return request(`/api/tech-cards/${id}`, { method: 'DELETE' });
}

// New stock-oriented Tech Cards API
export async function getTechCardsList(params?: { search?: string; type?: string; store?: string; is_active?: string; page?: number; limit?: number }): Promise<any> {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString() : '';
  return request(`/api/tech-cards/list${qs}`);
}

export async function createStockTechCard(data: any): Promise<any> {
  return request('/api/tech-card', { method: 'POST', body: JSON.stringify(data) });
}

export async function getStockTechCard(id: number): Promise<any> {
  return request(`/api/tech-card/${id}`);
}

export async function updateStockTechCard(id: number, data: any): Promise<any> {
  return request(`/api/tech-card/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteStockTechCard(id: number): Promise<void> {
  return request(`/api/tech-card/${id}`, { method: 'DELETE' });
}

export async function calculateTechCardKbju(id: number): Promise<any> {
  return request(`/api/tech-card/${id}/calculate-kbju`, { method: 'POST' });
}

export async function copyTechCard(id: number, validFrom?: string): Promise<any> {
  return request(`/api/tech-card/${id}/copy`, { method: 'POST', body: JSON.stringify({ validFrom }) });
}

export async function exportTechCardsXlsx(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/tech-cards/export`);
  if (!res.ok) throw new Error('Ошибка экспорта');
  return res.blob();
}

export async function importTechCardsXlsx(rows: any[]): Promise<any> {
  return request('/api/tech-cards/import', { method: 'POST', body: JSON.stringify({ rows }) });
}

export async function getTechCardIngredients(techCardId: number): Promise<any[]> {
  return request(`/api/tech-card/${techCardId}/ingredients`);
}

export async function addTechCardIngredient(techCardId: number, data: any): Promise<any> {
  return request(`/api/tech-card/${techCardId}/ingredients`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTechCardIngredient(techCardId: number, ingId: number, data: any): Promise<any> {
  return request(`/api/tech-card/${techCardId}/ingredients/${ingId}`, { method: 'PUT', body: JSON.stringify(data) });
}

// Dish Tech Cards API (new system)
export async function getDishTechCards(params?: { search?: string; is_active?: string; page?: number; limit?: number }): Promise<any> {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))).toString() : '';
  return request(`/api/tech-cards${qs}`);
}

export async function getDishTechCard(id: number): Promise<any> {
  return request(`/api/tech-cards/${id}`);
}

export async function createDishTechCard(data: any): Promise<any> {
  return request('/api/tech-cards', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDishTechCard(id: number, data: any): Promise<any> {
  return request(`/api/tech-cards/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteDishTechCard(id: number): Promise<any> {
  return request(`/api/tech-cards/${id}`, { method: 'DELETE' });
}

export async function getDishTechCardsStats(): Promise<any> {
  return request('/api/tech-cards-stats');
}

export async function deleteTechCardIngredient(techCardId: number, ingId: number): Promise<void> {
  return request(`/api/tech-card/${techCardId}/ingredients/${ingId}`, { method: 'DELETE' });
}

export async function aiGenerateTechCard(dishName: string): Promise<any> {
  return request('/api/tech-cards/ai-generate', { method: 'POST', body: JSON.stringify({ dish_name: dishName }) });
}

export async function aiSaveTechCard(data: any): Promise<any> {
  return request('/api/tech-cards/ai-save', { method: 'POST', body: JSON.stringify(data) });
}

export async function getTechCardModifiers(techCardId: number): Promise<any[]> {
  return request(`/api/tech-card/${techCardId}/modifiers`);
}

export async function addTechCardModifier(techCardId: number, data: any): Promise<any> {
  return request(`/api/tech-card/${techCardId}/modifiers`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTechCardModifier(techCardId: number, modId: number, data: any): Promise<any> {
  return request(`/api/tech-card/${techCardId}/modifiers/${modId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTechCardModifier(techCardId: number, modId: number): Promise<void> {
  return request(`/api/tech-card/${techCardId}/modifiers/${modId}`, { method: 'DELETE' });
}

// Upload
export async function uploadImage(base64: string, folder: string): Promise<{url: string}> {
  return request('/api/upload', { method: 'POST', body: JSON.stringify({ base64, folder }) });
}

// Tables
export async function getTables(): Promise<any[]> {
  return request('/api/tables');
}

export async function createTable(data: any): Promise<any> {
  return request('/api/tables', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTable(id: number, data: any): Promise<any> {
  return request(`/api/tables/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTable(id: number): Promise<void> {
  return request(`/api/tables/${id}`, { method: 'DELETE' });
}

// Bookings
export async function getBookings(params?: any): Promise<any[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`/api/bookings${qs}`);
}

export async function createBooking(data: any): Promise<any> {
  return request('/api/bookings', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBookingStatus(id: number, status: string): Promise<any> {
  return request(`/api/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function deleteBooking(id: number): Promise<void> {
  return request(`/api/bookings/${id}`, { method: 'DELETE' });
}

// Inventory
export async function getInventory(params?: any): Promise<any[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`/api/inventory${qs}`);
}

export async function createInventoryItem(data: any): Promise<any> {
  return request('/api/inventory', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateInventoryItem(id: number, data: any): Promise<any> {
  return request(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteInventoryItem(id: number): Promise<void> {
  return request(`/api/inventory/${id}`, { method: 'DELETE' });
}

export async function getInventoryTransactions(itemId?: number): Promise<any[]> {
  const qs = itemId ? `?item_id=${itemId}` : '';
  return request(`/api/inventory/transactions${qs}`);
}

export async function createInventoryTransaction(data: any): Promise<any> {
  return request('/api/inventory/transactions', { method: 'POST', body: JSON.stringify(data) });
}

// Suppliers
export async function getSuppliers(): Promise<any[]> {
  return request('/api/suppliers');
}

export async function createSupplier(data: any): Promise<any> {
  return request('/api/suppliers', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateSupplier(id: number, data: any): Promise<any> {
  return request(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteSupplier(id: number): Promise<void> {
  return request(`/api/suppliers/${id}`, { method: 'DELETE' });
}

// Pickup Points
export async function getPickupPoints(): Promise<any[]> {
  return request('/api/pickup-points');
}

export async function createPickupPoint(data: any): Promise<any> {
  return request('/api/pickup-points', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePickupPoint(id: number, data: any): Promise<any> {
  return request(`/api/pickup-points/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePickupPoint(id: number): Promise<void> {
  return request(`/api/pickup-points/${id}`, { method: 'DELETE' });
}

export async function getPickupOrders(): Promise<any[]> {
  return request('/api/pickup-orders');
}

// Staff
export async function getStaff(): Promise<any[]> {
  return request('/api/staff');
}

export async function createStaff(data: any): Promise<any> {
  return request('/api/staff', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateStaff(id: number, data: any): Promise<any> {
  return request(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteStaff(id: number): Promise<void> {
  return request(`/api/staff/${id}`, { method: 'DELETE' });
}

export async function getStaffShifts(params?: any): Promise<any[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`/api/staff/shifts${qs}`);
}

export async function createStaffShift(data: any): Promise<any> {
  return request('/api/staff/shifts', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteStaffShift(id: number): Promise<void> {
  return request(`/api/staff/shifts/${id}`, { method: 'DELETE' });
}

export async function getStaffPermissions(staffId: number): Promise<any[]> {
  return request(`/api/staff/${staffId}/permissions`);
}

export async function updateStaffPermissions(staffId: number, permissions: any[]): Promise<void> {
  return request(`/api/staff/${staffId}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) });
}

// Delivery
export async function getDeliveryOrders(): Promise<any[]> {
  return request('/api/delivery-orders');
}

export async function getDeliveryZones(): Promise<any[]> {
  return request('/api/delivery-zones');
}

export async function createDeliveryZone(data: any): Promise<any> {
  return request('/api/delivery-zones', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDeliveryZone(id: number, data: any): Promise<any> {
  return request(`/api/delivery-zones/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteDeliveryZone(id: number): Promise<void> {
  return request(`/api/delivery-zones/${id}`, { method: 'DELETE' });
}

// Finance
export async function getFinanceSummary(from?: string, to?: string): Promise<any> {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const q = qs.toString();
  return request(`/api/finance/summary${q ? '?' + q : ''}`);
}

export async function getFinanceTransactions(params?: any): Promise<any[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`/api/finance/transactions${qs}`);
}

export async function createFinanceTransaction(data: any): Promise<any> {
  return request('/api/finance/transactions', { method: 'POST', body: JSON.stringify(data) });
}

export async function getFinanceReport(from: string, to: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/finance/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Ошибка загрузки отчёта');
  }
  return res.blob();
}

// Marketing
export async function getPromocodes(): Promise<any[]> {
  return request('/api/promocodes');
}

export async function createPromocode(data: any): Promise<any> {
  return request('/api/promocodes', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePromocode(id: number, data: any): Promise<any> {
  return request(`/api/promocodes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePromocode(id: number): Promise<void> {
  return request(`/api/promocodes/${id}`, { method: 'DELETE' });
}

export async function getCampaigns(): Promise<any[]> {
  return request('/api/campaigns');
}

export async function createCampaign(data: any): Promise<any> {
  return request('/api/campaigns', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCampaign(id: number, data: any): Promise<any> {
  return request(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function sendCampaign(id: number): Promise<void> {
  return request(`/api/campaigns/${id}/send`, { method: 'POST' });
}

export async function getMarketingAnalytics(): Promise<any> {
  return request('/api/marketing/analytics');
}

// Reviews (admin)
export async function getAllReviews(): Promise<any[]> {
  return request('/api/reviews/all');
}

export async function replyToReview(id: number, reply: string): Promise<any> {
  return request(`/api/reviews/${id}/reply`, { method: 'PUT', body: JSON.stringify({ reply }) });
}

export async function getReviewPhotos(): Promise<any[]> {
  return request('/api/reviews/photos');
}

// Public Settings (guest/courier apps)
export async function getPublicSettings(): Promise<Record<string, any>> {
  return request('/api/public/settings');
}

// Settings
export async function getSettings(): Promise<any> {
  return request('/api/settings');
}

export async function updateSettings(settings: any): Promise<void> {
  return request('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
}

export async function createBackup(): Promise<any> {
  return request('/api/backup', { method: 'POST' });
}

export async function changePassword(oldPassword: string, newPassword: string, username?: string): Promise<any> {
  return request('/api/settings/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword, username }) });
}

// Audit
export async function getAuditLogs(adminId?: number): Promise<any[]> {
  const qs = adminId ? `?admin_id=${adminId}` : '';
  return request(`/api/audit-logs${qs}`);
}

// Push
export async function sendPushNotification(title: string, body: string, segment?: string): Promise<void> {
  return request('/api/notifications/push', { method: 'POST', body: JSON.stringify({ title, body, segment }) });
}

// Dashboard
export async function getDashboard(): Promise<any> {
  return request('/api/dashboard');
}

// Bulk operations
export async function bulkUpdateOrderStatus(ids: number[], status: string, note?: string): Promise<void> {
  return request('/api/orders/bulk-status', { method: 'PATCH', body: JSON.stringify({ ids, status, note }) });
}

export async function getOrdersMultiStatus(statuses: string[]): Promise<Order[]> {
  return request('/api/orders/multi-status', { method: 'POST', body: JSON.stringify({ statuses }) });
}

// Discounts
export async function getDiscounts(): Promise<any[]> { return request('/api/discounts'); }
export async function createDiscount(data: any): Promise<any> {
  return request('/api/discounts', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateDiscount(id: number, data: any): Promise<any> {
  return request(`/api/discounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteDiscount(id: number): Promise<void> {
  return request(`/api/discounts/${id}`, { method: 'DELETE' });
}

// Bonuses
export async function getBonuses(): Promise<any[]> { return request('/api/bonuses'); }
export async function getBonusTransactions(): Promise<any[]> { return request('/api/bonuses/transactions'); }
export async function accrueBonus(userId: number, amount: number, description?: string): Promise<any> {
  return request('/api/bonuses/accrue', { method: 'POST', body: JSON.stringify({ user_id: userId, amount, description }) });
}

// Loyalty program
export async function getGuestBonusInfo(userId: number): Promise<any> {
  return request(`/api/loyalty/guest/${userId}`);
}
export async function getGuestBonusTransactions(userId: number, page?: number, limit?: number): Promise<any> {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return request(`/api/loyalty/guest/${userId}/transactions${qs ? '?' + qs : ''}`);
}
export async function getLoyaltySettings(): Promise<any> {
  return request('/api/loyalty/settings');
}
export async function calculateBonusDiscount(userId: number, orderTotal: number): Promise<any> {
  return request('/api/loyalty/calculate-discount', { method: 'POST', body: JSON.stringify({ userId, orderTotal }) });
}
export async function spendBonuses(userId: number, amount: number, orderId: number, description?: string): Promise<any> {
  return request('/api/loyalty/spend', { method: 'POST', body: JSON.stringify({ userId, amount, orderId, description }) });
}

// Admin loyalty
export async function adminGetLoyaltyGuests(): Promise<any[]> {
  return request('/api/admin/loyalty/guests');
}
export async function adminUpdateLoyaltySettings(data: any): Promise<any> {
  return request('/api/admin/loyalty/settings', { method: 'PUT', body: JSON.stringify(data) });
}
export async function adminAdjustLoyalty(userId: number, amount: number, description?: string, type?: string): Promise<any> {
  return request('/api/admin/loyalty/adjust', { method: 'POST', body: JSON.stringify({ userId, amount, description, type }) });
}

// Certificates
export async function getCertificates(): Promise<any[]> { return request('/api/certificates'); }
export async function createCertificate(data: any): Promise<any> {
  return request('/api/certificates', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateCertificate(id: number, data: any): Promise<any> {
  return request(`/api/certificates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteCertificate(id: number): Promise<void> {
  return request(`/api/certificates/${id}`, { method: 'DELETE' });
}

// File upload
export async function uploadFile(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка загрузки файла' }));
    throw new Error(err.error || 'Ошибка загрузки файла');
  }
  return res.json();
}

// Generate code
export async function generateCode(type: string, length?: number): Promise<{ code: string }> {
  return request('/api/generate-code', { method: 'POST', body: JSON.stringify({ type, length }) });
}

// Guests search for discounts
export async function searchGuests(q: string): Promise<{ id: number; name: string; phone: string }[]> {
  return request(`/api/guests/search?q=${encodeURIComponent(q)}`);
}

// Clients
export async function getClients(search?: string): Promise<any[]> {
  return request(`/api/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`);
}
export async function getClient(id: number): Promise<any> {
  return request(`/api/clients/${id}`);
}
export async function updateClient(id: number, data: any): Promise<any> {
  return request(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// Courier App
export async function courierLogin(username: string, password: string): Promise<any> {
  return request('/api/courier/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}
export async function getCourierProfile(id: number): Promise<any> {
  return request(`/api/courier/profile/${id}`);
}
export async function courierToggleOnline(staffId: number, isOnline: boolean): Promise<any> {
  return request('/api/courier/online', { method: 'POST', body: JSON.stringify({ staff_id: staffId, is_online: isOnline }) });
}
export async function courierSendLocation(staffId: number, lat: number, lng: number): Promise<any> {
  return request('/api/courier/location', { method: 'POST', body: JSON.stringify({ staff_id: staffId, lat, lng }) });
}

// Salary
export async function getSalary(params?: { month?: number; year?: number; staff_id?: number; status?: string }): Promise<any[]> {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_,v]) => v !== undefined).map(([k,v]) => [k, String(v)]))).toString() : '';
  return request(`/api/salary${qs}`);
}

export async function calculateSalary(data: { staff_id?: number; month?: number; year?: number; all?: boolean }): Promise<any> {
  return request('/api/salary/calculate', { method: 'POST', body: JSON.stringify(data) });
}

export async function paySalary(data: { salary_id: number; staff_id: number; amount?: number; paid_date?: string; payment_method?: string; note?: string }): Promise<any> {
  return request('/api/salary/pay', { method: 'POST', body: JSON.stringify(data) });
}

export async function getSalaryReport(month?: number, year?: number): Promise<any> {
  const qs = new URLSearchParams();
  if (month) qs.set('month', String(month));
  if (year) qs.set('year', String(year));
  const q = qs.toString();
  return request(`/api/salary/report${q ? '?' + q : ''}`);
}

export async function getSalaryHistory(staffId: number): Promise<{ salary: any[]; log: any[] }> {
  return request(`/api/salary/history/${staffId}`);
}

// Payment methods
export async function getPaymentMethods(): Promise<any[]> {
  return request('/api/payment-methods');
}

export async function updatePaymentMethod(id: number, data: { is_active?: boolean; name?: string; description?: string; sort_order?: number }): Promise<any> {
  return request(`/api/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function getActivePaymentMethods(): Promise<any[]> {
  return request('/api/active-payment-methods');
}

// Inventory price history
export async function getPriceHistory(itemId: number): Promise<any[]> {
  return request(`/api/inventory/price-history/${itemId}`);
}

// Documents
export async function getDocumentTypes(): Promise<{value: string; label: string}[]> {
  return request('/api/documents/types');
}

export async function getDocuments(params?: { type?: string; search?: string; page?: number; limit?: number }): Promise<{items: any[]; total: number; page: number; totalPages: number}> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.search) qs.set('search', params.search);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return request(`/api/documents${q ? '?' + q : ''}`);
}

export async function getDocument(id: number): Promise<any> {
  return request(`/api/documents/${id}`);
}

export async function createDocument(data: any): Promise<any> {
  return request('/api/documents', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDocument(id: number, data: any): Promise<any> {
  return request(`/api/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteDocument(id: number): Promise<void> {
  return request(`/api/documents/${id}`, { method: 'DELETE' });
}

export async function importDocuments(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/documents/import`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка импорта' }));
    throw new Error(err.error || 'Ошибка импорта');
  }
  return res.json();
}

// Forecast
export async function getForecast(params?: { product_id?: number; from_date?: string; to_date?: string }): Promise<any[]> {
  const qs = new URLSearchParams();
  if (params?.product_id) qs.set('product_id', String(params.product_id));
  if (params?.from_date) qs.set('from_date', params.from_date);
  if (params?.to_date) qs.set('to_date', params.to_date);
  const q = qs.toString();
  return request(`/api/forecast${q ? '?' + q : ''}`);
}
export async function generateForecast(): Promise<any[]> {
  return request('/api/forecast/generate', { method: 'POST' });
}
export async function getForecastHistory(productId: number, days = 90): Promise<any[]> {
  return request(`/api/forecast/history?product_id=${productId}&days=${days}`);
}
export async function adjustForecast(forecastId: number, quantity: number): Promise<any> {
  return request('/api/forecast/adjust', { method: 'PUT', body: JSON.stringify({ forecast_id: forecastId, quantity }) });
}

// Stock Item Card
export async function getStockItem(id: number): Promise<any> {
  return request(`/api/stock-item/${id}`);
}
export async function updateStockItem(id: number, data: any): Promise<void> {
  await request(`/api/stock-item/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function getStockItemTechCards(itemId: number, params?: { store?: string; current_only?: boolean; page?: number; limit?: number }): Promise<any> {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_,v]) => v !== undefined).map(([k,v]) => [k, String(v)]))).toString() : '';
  return request(`/api/stock-item/${itemId}/tech-cards${qs}`);
}
export async function getContragents(search?: string): Promise<any[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/api/contragents${qs}`);
}
export async function createContragent(data: any): Promise<any> {
  return request('/api/contragents', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateContragent(id: number, data: any): Promise<any> {
  return request(`/api/contragents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteContragent(id: number): Promise<void> {
  await request(`/api/contragents/${id}`, { method: 'DELETE' });
}
export async function getStockItemTechCardsAsIngredient(itemId: number): Promise<any> {
  return request(`/api/stock-item/${itemId}/tech-cards-as-ingredient`);
}
export async function searchStockItems(q: string): Promise<any[]> {
  return request(`/api/stock-items/search?q=${encodeURIComponent(q)}`);
}
export async function getStockItemBreakdownTechCards(itemId: number, params?: { store?: string; current_only?: boolean; page?: number; limit?: number }): Promise<any> {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_,v]) => v !== undefined).map(([k,v]) => [k, String(v)]))).toString() : '';
  return request(`/api/stock-item/${itemId}/breakdown-tech-cards${qs}`);
}
export async function getStockItemPackagings(itemId: number): Promise<any[]> {
  return request(`/api/stock-item/${itemId}/packagings`);
}
export async function addStockItemPackaging(itemId: number, data: any): Promise<any> {
  return request(`/api/stock-item/${itemId}/packagings`, { method: 'POST', body: JSON.stringify(data) });
}
export async function updateStockItemPackaging(itemId: number, packId: number, data: any): Promise<void> {
  await request(`/api/stock-item/${itemId}/packagings/${packId}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteStockItemPackaging(itemId: number, packId: number): Promise<void> {
  await request(`/api/stock-item/${itemId}/packagings/${packId}`, { method: 'DELETE' });
}
export async function getStockItemComposition(itemId: number, hideArchived?: boolean): Promise<any[]> {
  const qs = hideArchived ? '?hide_archived=1' : '';
  return request(`/api/stock-item/${itemId}/composition${qs}`);
}
export async function getStockItemBatches(itemId: number, params?: { warehouse?: string; page?: number; limit?: number }): Promise<any> {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_,v]) => v !== undefined).map(([k,v]) => [k, String(v)]))).toString() : '';
  return request(`/api/stock-item/${itemId}/batches${qs}`);
}
export async function getStockItemContragents(itemId: number): Promise<any[]> {
  return request(`/api/stock-item/${itemId}/contragents`);
}
export async function addStockItemContragent(itemId: number, data: any): Promise<any> {
  return request(`/api/stock-item/${itemId}/contragents`, { method: 'POST', body: JSON.stringify(data) });
}
export async function deleteStockItemContragent(itemId: number, contragentId: number): Promise<void> {
  await request(`/api/stock-item/${itemId}/contragents/${contragentId}`, { method: 'DELETE' });
}
export async function getStockItemHistory(itemId: number, params?: { warehouse?: string; doc_type?: string; date_from?: string; date_to?: string; page?: number; limit?: number }): Promise<any> {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_,v]) => v !== undefined).map(([k,v]) => [k, String(v)]))).toString() : '';
  return request(`/api/stock-item/${itemId}/history${qs}`);
}
export async function getStockItemWarehouseBindings(itemId: number, params?: { only_bound?: boolean; search?: string }): Promise<any[]> {
  const qs: any = {};
  if (params?.only_bound) qs.only_bound = '1';
  if (params?.search) qs.search = params.search;
  const sq = Object.keys(qs).length ? '?' + new URLSearchParams(qs).toString() : '';
  return request(`/api/stock-item/${itemId}/warehouse-bindings${sq}`);
}
export async function updateStockItemWarehouseBinding(itemId: number, bindingId: number, data: any): Promise<void> {
  await request(`/api/stock-item/${itemId}/warehouse-bindings/${bindingId}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function bindStockItemToAllWarehouses(itemId: number): Promise<void> {
  await request(`/api/stock-item/${itemId}/warehouse-bindings/bind-all`, { method: 'POST' });
}

// Stock Categories
export async function getStockCategories(tree?: boolean, tenantId?: number): Promise<any[]> {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenant_id', String(tenantId));
  if (tree) params.set('tree', 'true');
  const qs = params.toString();
  return request(`/api/categories${qs ? '?' + qs : ''}`);
}
export async function createStockCategory(data: { name: string; parent_id?: number; tenant_id?: number }): Promise<any> {
  return request('/api/categories', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateStockCategory(id: number, data: { name?: string; parent_id?: number | null }): Promise<any> {
  return request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteStockCategory(id: number): Promise<void> {
  await request(`/api/categories/${id}`, { method: 'DELETE' });
}

// ─── Loyalty Levels ───────────────────────────────────────────
export async function getLoyaltyLevels(): Promise<any[]> { return request('/api/loyalty-levels'); }
export async function createLoyaltyLevel(data: any): Promise<any> { return request('/api/loyalty-levels', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateLoyaltyLevel(id: number, data: any): Promise<any> { return request(`/api/loyalty-levels/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function deleteLoyaltyLevel(id: number): Promise<void> { await request(`/api/loyalty-levels/${id}`, { method: 'DELETE' }); }

// ─── KPI ──────────────────────────────────────────────────────
export async function getKpiTargets(): Promise<any[]> { return request('/api/kpi-targets'); }
export async function createKpiTarget(data: any): Promise<any> { return request('/api/kpi-targets', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateKpiTarget(id: number, data: any): Promise<any> { return request(`/api/kpi-targets/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function deleteKpiTarget(id: number): Promise<void> { await request(`/api/kpi-targets/${id}`, { method: 'DELETE' }); }
export async function getKpiResults(staffId: number): Promise<any[]> { return request(`/api/kpi-results/${staffId}`); }

// ─── Cashflow ─────────────────────────────────────────────────
export async function getCashflow(from?: string, to?: string): Promise<any> {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from); if (to) qs.set('to', to);
  return request(`/api/finance/cashflow?${qs.toString()}`);
}

// ─── Online Payments ──────────────────────────────────────────
export async function createPayment(data: {
  orderId?: number; amount: number; description?: string; returnUrl?: string;
  paymentMethod?: string; provider?: string; subscriptionId?: number; tenantId?: number;
}): Promise<any> {
  return request('/api/payment/create', { method: 'POST', body: JSON.stringify(data) });
}

export async function getPaymentStatus(id: string): Promise<any> {
  return request(`/api/payment/status/${id}`);
}

export async function refundPayment(paymentId: string, amount?: number): Promise<any> {
  return request('/api/payment/refund', { method: 'POST', body: JSON.stringify({ paymentId, amount }) });
}

export async function getPaymentSettings(): Promise<any[]> {
  return request('/api/admin/payment/settings');
}

export async function updatePaymentSettings(provider: string, data: any): Promise<any> {
  return request(`/api/admin/payment/settings/${provider}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function testPaymentConnection(provider: string): Promise<any> {
  return request(`/api/admin/payment/settings/${provider}/test`, { method: 'POST' });
}

export async function createQrPayment(data: {
  orderId?: number; amount: number; description?: string; returnUrl?: string;
  qrType: 'sbp' | 'sber'; tenantId?: number;
}): Promise<any> {
  return request('/api/payment/qr', { method: 'POST', body: JSON.stringify(data) });
}

export async function getQrPaymentStatus(paymentId: string): Promise<any> {
  return request(`/api/payment/qr-status/${paymentId}`);
}

export async function getAdminPayments(params?: {
  page?: number; limit?: number; status?: string; provider?: string; type?: string;
  date_from?: string; date_to?: string;
}): Promise<any> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.provider) qs.set('provider', params.provider);
  if (params?.type) qs.set('type', params.type);
  if (params?.date_from) qs.set('date_from', params.date_from);
  if (params?.date_to) qs.set('date_to', params.date_to);
  const q = qs.toString();
  return request(`/api/admin/payments${q ? '?' + q : ''}`);
}

export async function getTariffs(): Promise<any[]> {
  return request('/api/tariffs');
}

export async function createTariff(data: any): Promise<any> {
  return request('/api/admin/tariffs', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTariff(id: number, data: any): Promise<any> {
  return request(`/api/admin/tariffs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTariff(id: number): Promise<any> {
  return request(`/api/admin/tariffs/${id}`, { method: 'DELETE' });
}

export async function getSubscriptions(tenantId?: number): Promise<any[]> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : '';
  return request(`/api/subscriptions${qs}`);
}

export async function createSubscription(tenantId: number, tariffId: number): Promise<any> {
  return request('/api/subscriptions/create', { method: 'POST', body: JSON.stringify({ tenantId, tariffId }) });
}

export async function updateSubscription(id: number, data: any): Promise<any> {
  return request(`/api/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

// ─── Integrations ─────────────────────────────────────────────
export async function getIntegration(type: string): Promise<any> { return request(`/api/integrations/${type}`); }
export async function updateIntegration(type: string, data: any): Promise<any> { return request(`/api/integrations/${type}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function exportTo1C(): Promise<any> { return request('/api/integrations/1c/export-products'); }
export async function markEgaisProduct(itemId: number, data: any): Promise<any> { return request(`/api/integrations/egais/mark-product`, { method: 'PUT', body: JSON.stringify(data) }); }

// ─── Aggregator Integration ──────────────────────────────────
export async function getAggregators(): Promise<any[]> { return request('/api/admin/integrations/aggregators'); }
export async function getAggregator(provider: string): Promise<any> { return request(`/api/admin/integrations/aggregators/${provider}`); }
export async function updateAggregator(provider: string, data: any): Promise<any> {
  return request(`/api/admin/integrations/aggregators/${provider}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function testAggregatorConnection(provider: string, credentials?: Record<string, string>, tenantId?: number): Promise<any> {
  return request(`/api/admin/integrations/aggregators/${provider}/test`, { method: 'POST', body: JSON.stringify({ tenant_id: tenantId || 1, credentials }) });
}
export async function syncAggregatorMenu(provider: string, tenantId?: number): Promise<any> {
  return request(`/api/admin/integrations/aggregators/${provider}/sync-menu`, { method: 'POST', body: JSON.stringify({ tenant_id: tenantId || 1 }) });
}
export async function syncAggregatorStatuses(provider: string, tenantId?: number): Promise<any> {
  return request(`/api/admin/integrations/aggregators/${provider}/sync-statuses`, { method: 'POST', body: JSON.stringify({ tenant_id: tenantId || 1 }) });
}
export async function getAggregatorLogs(provider: string, params?: { page?: number; limit?: number; operation?: string; status?: string }): Promise<any> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.operation) qs.set('operation', params.operation);
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  return request(`/api/admin/integrations/aggregators/${provider}/logs${q ? '?' + q : ''}`);
}

// ─── Global Search ────────────────────────────────────────────
export async function globalSearch(q: string): Promise<any> { return request(`/api/search?q=${encodeURIComponent(q)}`); }

// ─── Waiter Terminal ─────────────────────────────────────────
export async function getWaiterTables(): Promise<any[]> { return request('/api/waiter/tables'); }
export async function seatTable(tableId: number, waiterId: number, waiterName: string, guestCount?: number): Promise<any> {
  return request('/api/waiter/seated', { method: 'POST', body: JSON.stringify({ tableId, waiterId, waiterName, guestCount }) });
}
export async function voiceOrder(text: string): Promise<any> {
  return request('/api/mobile/voice-order', { method: 'POST', body: JSON.stringify({ text }) });
}

// ─── Voice AI Waiter ─────────────────────────────────────────
export async function voiceDraftCreate(waiterId: number, tableId?: number, tableName?: string): Promise<any> {
  return request('/api/waiter/voice/draft', { method: 'POST', body: JSON.stringify({ waiterId, tableId, tableName }) });
}

export async function voiceDraftAddItems(draftId: string, items: any[], tableId?: number, tableName?: string): Promise<any> {
  return request(`/api/waiter/voice/draft/${draftId}/items`, { method: 'POST', body: JSON.stringify({ items, tableId, tableName }) });
}

export async function voiceDraftGet(draftId: string): Promise<any> {
  return request(`/api/waiter/voice/draft/${draftId}`);
}

export async function voiceDraftsList(waiterId?: number): Promise<any> {
  const qs = waiterId ? `?waiterId=${waiterId}` : '';
  return request(`/api/waiter/voice/drafts${qs}`);
}

export async function voiceDraftDelete(draftId: string): Promise<any> {
  return request(`/api/waiter/voice/draft/${draftId}`, { method: 'DELETE' });
}

export async function voiceConfirm(draftId: string, waiterId: number, waiterName?: string): Promise<any> {
  return request('/api/waiter/voice/confirm', { method: 'POST', body: JSON.stringify({ draftId, waiterId, waiterName }) });
}

export async function voicePay(orderId: number, paymentMethod?: string): Promise<any> {
  return request('/api/waiter/voice/pay', { method: 'POST', body: JSON.stringify({ orderId, paymentMethod }) });
}

export async function voiceClose(orderId: number): Promise<any> {
  return request('/api/waiter/voice/close', { method: 'POST', body: JSON.stringify({ orderId }) });
}

export async function voiceCancel(orderId?: number, draftId?: string): Promise<any> {
  return request('/api/waiter/voice/cancel', { method: 'POST', body: JSON.stringify({ orderId, draftId }) });
}

export async function voiceRefund(orderId: number, reason?: string): Promise<any> {
  return request('/api/waiter/voice/refund', { method: 'POST', body: JSON.stringify({ orderId, reason }) });
}

export async function createDineInOrder(data: any): Promise<any> {
  return request('/api/waiter/orders', { method: 'POST', body: JSON.stringify(data) });
}
export async function getActiveChecks(waiterId: number): Promise<any[]> {
  return request(`/api/waiter/active-checks?waiterId=${waiterId}`);
}
export async function getCheckOrders(checkId: number): Promise<any[]> {
  return request(`/api/waiter/check-orders/${checkId}`);
}
export async function callWaiter(tableId: number): Promise<any> {
  return request('/api/waiter/call', { method: 'POST', body: JSON.stringify({ tableId }) });
}
export async function splitOrderCheck(orderId: number, items: number[]): Promise<any> {
  return request(`/api/orders/${orderId}/split`, { method: 'POST', body: JSON.stringify({ items }) });
}
export async function mergeOrderChecks(orderIds: number[]): Promise<any> {
  return request('/api/orders/merge', { method: 'POST', body: JSON.stringify({ orderIds }) });
}
export async function processPayment(orderId: number, data: any): Promise<any> {
  return request(`/api/orders/${orderId}/payment`, { method: 'POST', body: JSON.stringify(data) });
}
export async function serveOrder(orderId: number, waiterId: number): Promise<any> {
  return request(`/api/orders/${orderId}/serve`, { method: 'POST', body: JSON.stringify({ waiterId }) });
}

// ─── Terminal (POS) Integration ───────────────────────────────
export async function getTerminalSettings(): Promise<any> {
  return request('/api/admin/terminal/settings');
}
export async function saveTerminalSettings(settings: any): Promise<any> {
  return request('/api/admin/terminal/settings', { method: 'PUT', body: JSON.stringify(settings) });
}
export async function testTerminalConnection(): Promise<any> {
  return request('/api/admin/terminal/test', { method: 'POST' });
}
export async function terminalPay(orderId: number, amount?: number): Promise<any> {
  return request('/api/terminal/pay', { method: 'POST', body: JSON.stringify({ orderId, amount }) });
}
export async function getTerminalStatus(transactionId: string): Promise<any> {
  return request(`/api/terminal/status/${transactionId}`);
}
export async function cancelTerminalPayment(transactionId: string): Promise<any> {
  return request(`/api/terminal/cancel/${transactionId}`, { method: 'POST' });
}
export async function getTerminalTransactions(params?: { page?: number; status?: string; orderId?: number }): Promise<any> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.status) qs.set('status', params.status);
  if (params?.orderId) qs.set('orderId', String(params.orderId));
  return request(`/api/admin/terminal/transactions?${qs}`);
}
export async function getTerminalLogs(params?: { page?: number; operation?: string; orderId?: number }): Promise<any> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.operation) qs.set('operation', params.operation);
  if (params?.orderId) qs.set('orderId', String(params.orderId));
  return request(`/api/admin/terminal/logs?${qs}`);
}

// ─── Kitchen Display ─────────────────────────────────────────
export async function getKitchenOrders(): Promise<any[]> { return request('/api/kitchen/orders'); }
export async function acceptKitchenOrder(orderId: number, chefId: number): Promise<any> {
  return request(`/api/kitchen/orders/${orderId}/accept`, { method: 'POST', body: JSON.stringify({ chefId }) });
}
export async function updateItemStatus(orderId: number, dishId: number, status: string, chefId?: number): Promise<any> {
  return request(`/api/orders/${orderId}/items/${dishId}/status`, { method: 'PATCH', body: JSON.stringify({ status, chefId }) });
}
export async function completeKitchenOrder(orderId: number): Promise<any> {
  return request(`/api/kitchen/orders/${orderId}/complete`, { method: 'POST' });
}
export async function getSousChefRecommendations(): Promise<any> { return request('/api/kitchen/sous-chef'); }
export async function getStepCompletions(orderId: number, dishId: number): Promise<any[]> {
  return request(`/api/kitchen/step-completions/${orderId}/${dishId}`);
}
export async function toggleStepCompletion(orderId: number, dishId: number, stepIndex: number, completed: boolean): Promise<any> {
  return request('/api/kitchen/step-completions', { method: 'POST', body: JSON.stringify({ order_id: orderId, dish_id: dishId, step_index: stepIndex, completed }) });
}
export async function getTechCardSteps(id: number): Promise<any> {
  return request(`/api/tech-cards/${id}/steps`);
}

// ─── Staff auth for waiter/kitchen ────────────────────────────
export async function staffLogin(username: string, password: string): Promise<{ token: string; user: any }> {
  return request('/api/staff/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export async function tenantLogin(tenantName: string, login: string, password: string, twoFactorCode?: string): Promise<{ token: string; user: any; require2fa?: boolean }> {
  const body: any = { tenantName, login, password };
  if (twoFactorCode) body.twoFactorCode = twoFactorCode;
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
}

export async function searchTenants(query: string): Promise<any[]> {
  return request(`/api/tenants/search?q=${encodeURIComponent(query)}`);
}

export async function getTenants(): Promise<any[]> {
  return request('/api/tenants');
}

export async function switchTenant(tenantId: number): Promise<{ token: string; tenant: any }> {
  return request('/api/auth/switch-tenant', { method: 'POST', body: JSON.stringify({ tenantId }) });
}

export async function getNearbyTenants(lat: number, lng: number, radius?: number): Promise<any[]> {
  return request(`/api/tenants/nearby?lat=${lat}&lng=${lng}${radius ? `&radius=${radius}` : ''}`);
}

// Language
export async function saveLanguage(language: string): Promise<any> {
  try {
    const raw = localStorage.getItem('foodchain_admin_user');
    if (!raw) return;
    const user = JSON.parse(raw);
    if (!user.id) return;
    return request('/api/user/language', { method: 'PUT', body: JSON.stringify({ staffId: user.id, language }) });
  } catch { return; }
}

// ─── 1C Integration ─────────────────────────────────────────
export async function get1CSettings(): Promise<any> { return request('/api/admin/integrations/1c/settings'); }
export async function update1CSettings(data: any): Promise<any> {
  return request('/api/admin/integrations/1c/settings', { method: 'PUT', body: JSON.stringify(data) });
}
export async function test1CConnection(): Promise<any> {
  return request('/api/admin/integrations/1c/test', { method: 'POST' });
}
export async function sync1C(): Promise<any> {
  return request('/api/admin/integrations/1c/sync', { method: 'POST' });
}
export async function get1CLogs(params?: { page?: number; limit?: number; direction?: string; status?: string; operation?: string; dateFrom?: string; dateTo?: string }): Promise<any> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.direction) qs.set('direction', params.direction);
  if (params?.status) qs.set('status', params.status);
  if (params?.operation) qs.set('operation', params.operation);
  if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo) qs.set('dateTo', params.dateTo);
  return request(`/api/admin/integrations/1c/logs${qs.toString() ? '?' + qs.toString() : ''}`);
}

// ─── Fiscalization ────────────────────────────────────────────
export async function getFiscalSettings(): Promise<any[]> { return request('/api/admin/fiscal/settings'); }
export async function updateFiscalSettings(provider: string, data: any): Promise<any> {
  return request(`/api/admin/fiscal/settings/${provider}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function testFiscalConnection(provider: string, settings: any): Promise<any> {
  return request('/api/admin/fiscal/test', { method: 'POST', body: JSON.stringify({ provider, settings }) });
}
export async function printFiscalReceipt(orderId: number, paymentMethod?: string): Promise<any> {
  return request(`/api/admin/fiscal/print/${orderId}`, { method: 'POST', body: JSON.stringify({ paymentMethod }) });
}
export async function printFiscalRefund(orderId: number, reason?: string): Promise<any> {
  return request(`/api/admin/fiscal/refund/${orderId}`, { method: 'POST', body: JSON.stringify({ reason }) });
}
export async function retryFiscalReceipt(receiptId: number): Promise<any> {
  return request(`/api/admin/fiscal/retry/${receiptId}`, { method: 'POST' });
}
export async function getFiscalReceipts(params?: { page?: number; limit?: number; status?: string; orderId?: number; dateFrom?: string; dateTo?: string }): Promise<any> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.orderId) qs.set('orderId', String(params.orderId));
  if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo) qs.set('dateTo', params.dateTo);
  return request(`/api/admin/fiscal/receipts${qs.toString() ? '?' + qs.toString() : ''}`);
}
export async function getFiscalStats(): Promise<any> { return request('/api/admin/fiscal/stats'); }
export async function processFiscalQueue(): Promise<any> { return request('/api/admin/fiscal/process-queue', { method: 'POST' }); }

// ─── Costing (cost price calculation) ──────────────────────────
export async function getCostingOverview(): Promise<any[]> {
  return request('/api/admin/costing/overview');
}
export async function recalculateAllCosts(): Promise<any> {
  return request('/api/admin/costing/recalculate', { method: 'POST' });
}
export async function recalculateDishCost(dishId: number): Promise<any> {
  return request(`/api/admin/costing/recalculate/${dishId}`, { method: 'POST' });
}
export async function getCostingStatus(): Promise<any> {
  return request('/api/admin/costing/status');
}

// ─── Email Settings ─────────────────────────────────
export async function getEmailSettings(): Promise<any> {
  return request('/api/email/settings');
}
export async function saveEmailSettings(settings: any): Promise<any> {
  return request('/api/email/settings', { method: 'PUT', body: JSON.stringify(settings) });
}
export async function testEmailConnection(): Promise<any> {
  return request('/api/email/test', { method: 'POST' });
}
export async function sendTestEmail(to: string, subject: string, html: string): Promise<any> {
  return request('/api/email/send', { method: 'POST', body: JSON.stringify({ to, subject, html }) });
}

// ─── Bank Statement ──────────────────────────────────
export async function uploadBankStatement(file: File): Promise<any> {
  const fd = new FormData(); fd.append('file', file);
  return request('/api/finance/bank-statement/upload', { method: 'POST', body: fd });
}
export async function getBankStatementSummary(): Promise<any> {
  return request('/api/finance/bank-statement/summary');
}
export async function getBankTransactions(): Promise<any[]> {
  return request('/api/finance/bank-statement/transactions');
}
export async function clearBankTransactions(): Promise<any> {
  return request('/api/finance/bank-statement/clear', { method: 'DELETE' });
}

// ─── Tax Accounting ───────────────────────────────────
export async function getSalesLedger(year?: number, month?: number): Promise<any> {
  return request(`/api/finance/tax/sales-ledger?year=${year || ''}&month=${month || ''}`);
}
export async function getPurchaseLedger(year?: number, month?: number): Promise<any> {
  return request(`/api/finance/tax/purchase-ledger?year=${year || ''}&month=${month || ''}`);
}
export async function getVatDeclaration(year?: number, month?: number): Promise<any> {
  return request(`/api/finance/tax/declaration?year=${year || ''}&month=${month || ''}`);
}

// ─── Auto Write-off (expiry dates) ─────────────────────────────
export async function getAutoWriteoffSettings(): Promise<any> {
  return request('/api/admin/auto-writeoff/settings');
}
export async function saveAutoWriteoffSettings(settings: any): Promise<any> {
  return request('/api/admin/auto-writeoff/settings', { method: 'PUT', body: JSON.stringify(settings) });
}
export async function getExpiringSoon(days?: number): Promise<any[]> {
  return request(`/api/admin/auto-writeoff/expiring${days ? `?days=${days}` : ''}`);
}
export async function getExpiredItems(): Promise<any[]> {
  return request('/api/admin/auto-writeoff/expired');
}
export async function runAutoWriteoff(): Promise<any> {
  return request('/api/admin/auto-writeoff/run-now', { method: 'POST' });
}
export async function calculateWriteoffLosses(ids: number[]): Promise<any[]> {
  return request('/api/admin/auto-writeoff/calculate-losses', { method: 'POST', body: JSON.stringify({ ids }) });
}

// ─── Cash Register Shifts ───────────────────────────────────────
export async function getCurrentShift(): Promise<any> {
  return request('/api/admin/shifts/current');
}
export async function openShift(staffId: number, staffName: string, openingBalance?: number): Promise<any> {
  return request('/api/admin/shifts/open', { method: 'POST', body: JSON.stringify({ staffId, staffName, openingBalance }) });
}
export async function closeShift(id: number, closingBalance: number, notes?: string): Promise<any> {
  return request(`/api/admin/shifts/${id}/close`, { method: 'PUT', body: JSON.stringify({ closingBalance, notes }) });
}
export async function getShiftZReport(id: number): Promise<any> {
  return request(`/api/admin/shifts/${id}/z-report`);
}
export async function getShifts(page?: number): Promise<any> {
  return request(`/api/admin/shifts${page ? `?page=${page}` : ''}`);
}

// ─── WebSocket ────────────────────────────────────────────────
let ws: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsReconnectAttempts = 0;
const WS_MAX_RECONNECT_DELAY = 30000;
export function connectWebSocket(onMessage?: (data: any) => void) {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  try {
    const apiBase = localStorage.getItem('foodchain_api_url') || 'http://localhost:4000';
    const wsUrl = apiBase.replace(/^http/, 'ws');
    ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        wsReconnectAttempts = 0;
        emit(data.type, data);
        onMessage?.(data);
      } catch {}
    };
    ws.onclose = () => {
      const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), WS_MAX_RECONNECT_DELAY);
      wsReconnectAttempts++;
      wsReconnectTimer = setTimeout(() => connectWebSocket(onMessage), delay);
    };
    ws.onerror = () => { ws?.close(); };
  } catch {
    const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), WS_MAX_RECONNECT_DELAY);
    wsReconnectAttempts++;
    wsReconnectTimer = setTimeout(() => connectWebSocket(onMessage), delay);
  }
}
export function disconnectWebSocket() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  ws?.close(); ws = null;
  wsReconnectAttempts = 0;
}

// ─── Auto Orders ───────────────────────────────────────────────
export async function getAutoOrdersStatus(): Promise<any> {
  return request('/api/admin/auto-orders/status');
}
export async function toggleAutoOrders(enabled: boolean): Promise<any> {
  return request('/api/admin/auto-orders/toggle', { method: 'POST', body: JSON.stringify({ enabled }) });
}
export async function runAutoOrdersCheck(): Promise<any> {
  return request('/api/admin/auto-orders/run-now', { method: 'POST' });
}
export async function getLowStockItems(): Promise<any[]> {
  return request('/api/admin/auto-orders/low-stock');
}
export async function getAutoOrderSettings(): Promise<any> {
  return request('/api/admin/auto-orders/settings');
}
export async function saveAutoOrderSettings(settings: any): Promise<any> {
  return request('/api/admin/auto-orders/settings', { method: 'PUT', body: JSON.stringify(settings) });
}
export async function approveAutoOrder(id: number): Promise<any> {
  return request(`/api/admin/auto-orders/${id}/approve`, { method: 'PUT' });
}
export async function rejectAutoOrder(id: number): Promise<any> {
  return request(`/api/admin/auto-orders/${id}/reject`, { method: 'PUT' });
}
export async function sendAutoOrder(id: number): Promise<any> {
  return request(`/api/admin/auto-orders/${id}/send`, { method: 'PUT' });
}
export async function receiveAutoOrder(id: number): Promise<any> {
  return request(`/api/admin/auto-orders/${id}/receive`, { method: 'PUT' });
}

// ─── App Management API ──────────────────────────────────────────
export async function getAppSettings(): Promise<{ settings: any }> {
  return request('/api/app/settings');
}
export async function updateAppSettings(settings: any): Promise<{ settings: any; message: string }> {
  return request('/api/app/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
}
export async function resetAppSettings(): Promise<{ settings: any; message: string }> {
  return request('/api/app/settings/reset', { method: 'POST' });
}

// Banners
export async function getAppBanners(): Promise<any[]> {
  return request('/api/app/banners');
}
export async function createAppBanner(data: any): Promise<any> {
  return request('/api/app/banners', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateAppBanner(id: number, data: any): Promise<any> {
  return request(`/api/app/banners/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteAppBanner(id: number): Promise<void> {
  return request(`/api/app/banners/${id}`, { method: 'DELETE' });
}
export async function reorderAppBanners(order: { id: number; sort_order: number }[]): Promise<any> {
  return request('/api/app/banners/reorder', { method: 'PUT', body: JSON.stringify({ order }) });
}

// Promotions
export async function getAppPromotions(): Promise<any[]> {
  return request('/api/app/promotions');
}
export async function createAppPromotion(data: any): Promise<any> {
  return request('/api/app/promotions', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateAppPromotion(id: number, data: any): Promise<any> {
  return request(`/api/app/promotions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteAppPromotion(id: number): Promise<void> {
  return request(`/api/app/promotions/${id}`, { method: 'DELETE' });
}

// Working Hours
export async function getAppWorkingHours(): Promise<{ workingHours: any[]; specialDays: any[] }> {
  return request('/api/app/working-hours');
}
export async function saveAppWorkingHours(hours: any[]): Promise<any[]> {
  return request('/api/app/working-hours', { method: 'POST', body: JSON.stringify({ hours }) });
}
export async function saveAppSpecialDay(data: any): Promise<any[]> {
  return request('/api/app/special-days', { method: 'POST', body: JSON.stringify(data) });
}
export async function deleteAppSpecialDay(id: number): Promise<void> {
  return request(`/api/app/special-days/${id}`, { method: 'DELETE' });
}

// Modifiers
export async function getAppModifiers(): Promise<{ groups: any[]; modifiers: any[] }> {
  return request('/api/app/modifiers');
}
export async function createAppModifierGroup(data: any): Promise<any> {
  return request('/api/app/modifier-groups', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateAppModifierGroup(id: number, data: any): Promise<any> {
  return request(`/api/app/modifier-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteAppModifierGroup(id: number): Promise<void> {
  return request(`/api/app/modifier-groups/${id}`, { method: 'DELETE' });
}
export async function createAppModifier(data: any): Promise<any> {
  return request('/api/app/modifiers', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateAppModifier(id: number, data: any): Promise<any> {
  return request(`/api/app/modifiers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteAppModifier(id: number): Promise<void> {
  return request(`/api/app/modifiers/${id}`, { method: 'DELETE' });
}

// Category visibility
export async function getAppVisibility(): Promise<any[]> {
  return request('/api/app/visibility');
}
export async function batchUpdateAppVisibility(updates: any[]): Promise<any> {
  return request('/api/app/visibility/batch', { method: 'PUT', body: JSON.stringify({ updates }) });
}

// Upload
export async function uploadAppImage(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('fc_token');
  const res = await fetch(`${API_BASE}/api/app/upload`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
  return res.json();
}

// Audit log
export async function getAppAuditLog(): Promise<any[]> {
  return request('/api/app/audit-log');
}

// ─── Reports API ───────────────────────────────────────────────
function reportQs(params: { from?: string; to?: string; branch_id?: number } = {}): string {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.branch_id) qs.set('branch_id', String(params.branch_id));
  const q = qs.toString();
  return q ? '?' + q : '';
}

// Sales
export async function getReportSalesSummary(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/summary${reportQs(params)}`); }
export async function getReportSalesDaily(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/daily${reportQs(params)}`); }
export async function getReportSalesHourly(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/hourly${reportQs(params)}`); }
export async function getReportSalesWeekday(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/weekday${reportQs(params)}`); }
export async function getReportSalesCumulative(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/cumulative${reportQs(params)}`); }
export async function getReportSalesDiscounts(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/discounts${reportQs(params)}`); }
export async function getReportSalesPaymentSources(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/payment-sources${reportQs(params)}`); }
export async function getReportSalesMonthly(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/monthly${reportQs(params)}`); }
export async function getReportSalesOrderSource(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/order-source${reportQs(params)}`); }
export async function getReportSalesOrderType(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/order-type${reportQs(params)}`); }
export async function getReportSalesPaymentType(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/payment-type${reportQs(params)}`); }
export async function getReportSalesBranchesDaily(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/branches-daily${reportQs(params)}`); }
export async function getReportSalesBranchesMonthly(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/sales/branches-monthly${reportQs(params)}`); }

// Finance
export async function getReportFinanceProfitDaily(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/finance/profit-daily${reportQs(params)}`); }
export async function getReportFinanceProfitBranches(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/finance/profit-branches${reportQs(params)}`); }
export async function getReportFinanceProfitProducts(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/finance/profit-products${reportQs(params)}`); }
export async function getReportFinanceProfitCategories(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/finance/profit-categories${reportQs(params)}`); }
export async function getReportFinanceAbcAnalysis(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/finance/abc-analysis${reportQs(params)}`); }
export async function getReportFinancePnL(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/finance/pnl${reportQs(params)}`); }
export async function getReportFinanceIncomeExpense(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/finance/income-expense${reportQs(params)}`); }
export async function getReportFinancePaymentsDaily(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/finance/payments-daily${reportQs(params)}`); }
export async function getReportFinanceReconciliation(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/finance/reconciliation${reportQs(params)}`); }

// Stock
export async function getReportStockLowStock(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/stock/low-stock${reportQs(params)}`); }
export async function getReportStockPurchasePricesMonthly(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/stock/purchase-prices-monthly${reportQs(params)}`); }
export async function getReportStockMovementLog(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/stock/movement-log${reportQs(params)}`); }
export async function getReportStockEstimatedBalance(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/stock/estimated-balance${reportQs(params)}`); }
export async function getReportStockDetailedBalance(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/stock/detailed-balance${reportQs(params)}`); }
export async function getReportStockTransfers(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/stock/transfers${reportQs(params)}`); }
export async function getReportStockCalories(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/stock/calories${reportQs(params)}`); }

// Marketing
export async function getReportMarketingSalesByCustomer(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/marketing/sales-by-customer${reportQs(params)}`); }
export async function getReportMarketingPromoHistory(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/marketing/promo-history${reportQs(params)}`); }
export async function getReportMarketingBonusReport(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/marketing/bonus-report${reportQs(params)}`); }
export async function getReportMarketingCardConnections(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/marketing/card-connections${reportQs(params)}`); }
export async function getReportMarketingContacts(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/marketing/contacts${reportQs(params)}`); }

// Staff
export async function getReportStaffSalesByCashier(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/staff/sales-by-cashier${reportQs(params)}`); }
export async function getReportStaffSalesByStaff(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/staff/sales-by-staff${reportQs(params)}`); }
export async function getReportStaffBonuses(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/staff/bonuses${reportQs(params)}`); }
export async function getReportStaffTips(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/staff/tips${reportQs(params)}`); }

// Fulfillment
export async function getReportFulfillmentIssuers(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/fulfillment/issuers${reportQs(params)}`); }
export async function getReportFulfillmentDeliveryOrders(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/fulfillment/delivery-orders${reportQs(params)}`); }
export async function getReportFulfillmentOrders(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/fulfillment/orders${reportQs(params)}`); }
export async function getReportFulfillmentSummary(params: { from?: string; to?: string; branch_id?: number } = {}): Promise<any> { return request(`/api/reports/fulfillment/summary${reportQs(params)}`); }

// ─── Chat API ─────────────────────────────────────────────────
export async function getChats(params?: { status?: string; waiter_id?: number; search?: string; tenant_id?: number }): Promise<any[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.waiter_id) q.set('waiter_id', String(params.waiter_id));
  if (params?.search) q.set('search', params.search);
  if (params?.tenant_id) q.set('tenant_id', String(params.tenant_id));
  return request(`/api/chats?${q.toString()}`);
}
export async function getChat(id: number): Promise<any> { return request(`/api/chats/${id}`); }
export async function createChat(data: { guest_name?: string; guest_phone?: string; order_id?: number; table_id?: number }): Promise<any> {
  return request('/api/chats', { method: 'POST', body: JSON.stringify({ tenant_id: 1, ...data }) });
}
export async function assignChat(chatId: number, waiterId: number, waiterName: string): Promise<any> {
  return request(`/api/chats/${chatId}/assign`, { method: 'POST', body: JSON.stringify({ waiter_id: waiterId, waiter_name: waiterName }) });
}
export async function closeChat(chatId: number): Promise<any> {
  return request(`/api/chats/${chatId}/close`, { method: 'POST' });
}
export async function reopenChat(chatId: number): Promise<any> {
  return request(`/api/chats/${chatId}/reopen`, { method: 'POST' });
}
export async function deleteChat(chatId: number): Promise<any> {
  return request(`/api/chats/${chatId}`, { method: 'DELETE' });
}
export async function getChatMessages(chatId: number): Promise<any[]> {
  return request(`/api/chats/${chatId}/messages`);
}
export async function sendChatMessage(chatId: number, data: { sender_type: string; sender_id?: number; sender_name?: string; message?: string; file_url?: string }): Promise<any> {
  return request(`/api/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify(data) });
}
export async function markChatMessageRead(chatId: number, messageId: number): Promise<any> {
  return request(`/api/chats/${chatId}/messages/${messageId}/read`, { method: 'PATCH' });
}
export async function uploadChatFile(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/chats/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

// ─── Staff Chats (courier ↔ waiter) ──────────────────────────
export async function getStaffChats(params?: {
  order_id?: number; status?: string;
  courier_id?: number; waiter_id?: number;
  search?: string; tenant_id?: number;
}): Promise<any[]> {
  const q = new URLSearchParams();
  if (params?.order_id) q.set('order_id', String(params.order_id));
  if (params?.status) q.set('status', params.status);
  if (params?.courier_id) q.set('courier_id', String(params.courier_id));
  if (params?.waiter_id) q.set('waiter_id', String(params.waiter_id));
  if (params?.search) q.set('search', params.search);
  if (params?.tenant_id) q.set('tenant_id', String(params.tenant_id));
  return request(`/api/staff-chats?${q.toString()}`);
}
export async function getStaffChat(id: number): Promise<any> {
  return request(`/api/staff-chats/${id}`);
}
export async function createStaffChat(data: {
  order_id: number; courier_id?: number; courier_name?: string;
  waiter_id?: number; waiter_name?: string;
}): Promise<any> {
  return request('/api/staff-chats', { method: 'POST', body: JSON.stringify(data) });
}
export async function sendStaffChatMessage(chatId: number, data: {
  sender_id: number; sender_type: string; sender_name?: string;
  message?: string; file_url?: string;
  message_type?: string; location_data?: any;
}): Promise<any> {
  return request(`/api/staff-chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify(data) });
}
export async function getStaffChatMessages(chatId: number): Promise<any[]> {
  return request(`/api/staff-chats/${chatId}/messages`);
}
export async function closeStaffChat(chatId: number): Promise<any> {
  return request(`/api/staff-chats/${chatId}/close`, { method: 'PUT' });
}
export async function toggleImportantStaffChat(chatId: number, isImportant: boolean): Promise<any> {
  return request(`/api/staff-chats/${chatId}/important`, { method: 'PUT', body: JSON.stringify({ isImportant }) });
}
export async function uploadStaffChatFile(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/staff-chats/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

// ─── Courier-Guest Chat ─────────────────────────────────────────
export async function getCourierGuestChats(params?: {
  order_id?: number; status?: string; courier_id?: number;
  guest_phone?: string; guest_id?: number; search?: string; tenant_id?: number;
}): Promise<any[]> {
  const q = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) q.set(k, String(v)); });
  return request(`/api/courier-guest-chats?${q.toString()}`);
}

export async function getCourierGuestChat(id: number): Promise<any> {
  return request(`/api/courier-guest-chats/${id}`);
}

export async function createCourierGuestChat(data: {
  order_id: number; courier_id?: number; courier_name?: string;
  guest_id?: number; guest_name?: string; guest_phone?: string;
}): Promise<any> {
  return request('/api/courier-guest-chats', { method: 'POST', body: JSON.stringify({ tenant_id: 1, ...data }) });
}

export async function getCourierGuestChatMessages(chatId: number): Promise<any[]> {
  return request(`/api/courier-guest-chats/${chatId}/messages`);
}

export async function sendCourierGuestChatMessage(chatId: number, data: {
  sender_id?: number; sender_type?: string; sender_name?: string;
  message?: string; file_url?: string; message_type?: string; location_data?: any;
}): Promise<any> {
  return request(`/api/courier-guest-chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify(data) });
}

export async function closeCourierGuestChat(chatId: number): Promise<any> {
  return request(`/api/courier-guest-chats/${chatId}/close`, { method: 'PUT' });
}

export async function toggleImportantCourierGuestChat(chatId: number, isImportant: boolean): Promise<any> {
  return request(`/api/courier-guest-chats/${chatId}/important`, { method: 'PUT', body: JSON.stringify({ isImportant }) });
}

export async function getCourierTemplates(params?: { user_id?: number; tenant_id?: number }): Promise<{ system: any[]; personal: any[] }> {
  const q = new URLSearchParams();
  if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) q.set(k, String(v)); });
  return request(`/api/courier/templates?${q.toString()}`);
}

export async function createCourierPersonalTemplate(userId: number, text: string): Promise<any> {
  return request('/api/courier/templates/personal', { method: 'POST', body: JSON.stringify({ user_id: userId, text }) });
}

export async function deleteCourierPersonalTemplate(id: number): Promise<any> {
  return request(`/api/courier/templates/personal/${id}`, { method: 'DELETE' });
}

export async function getAdminCourierTemplates(tenantId?: number): Promise<any[]> {
  const q = tenantId ? `?tenant_id=${tenantId}` : '';
  return request(`/api/admin/courier-templates${q}`);
}

export async function createAdminCourierTemplate(data: { tenant_id?: number; text: string; is_active?: boolean; sort_order?: number }): Promise<any> {
  return request('/api/admin/courier-templates', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAdminCourierTemplate(id: number, data: { text?: string; is_active?: boolean; sort_order?: number }): Promise<any> {
  return request(`/api/admin/courier-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteAdminCourierTemplate(id: number): Promise<any> {
  return request(`/api/admin/courier-templates/${id}`, { method: 'DELETE' });
}

export async function reorderAdminCourierTemplates(order: { id: number; sort_order: number }[]): Promise<any> {
  return request('/api/admin/courier-templates/reorder', { method: 'PUT', body: JSON.stringify({ order }) });
}

export async function startCourierReturn(orderId: number, lat: number, lng: number): Promise<any> {
  return request(`/api/orders/${orderId}/returning`, { method: 'POST', body: JSON.stringify({ lat, lng }) });
}
export async function cancelCourierReturn(orderId: number): Promise<any> {
  return request(`/api/orders/${orderId}/returning`, { method: 'DELETE' });
}
export async function markCourierArrived(orderId: number): Promise<any> {
  return request(`/api/orders/${orderId}/returning/arrived`, { method: 'POST' });
}
export async function getReturningCouriers(): Promise<any[]> {
  return request('/api/returning-couriers');
}

// ─── Balance Sheet / Double-Entry Accounting ──────────────

export async function getAccounts() {
  const res = await fetch(`${API_BASE}/api/accounts`);
  if (!res.ok) throw new Error('Failed to fetch accounts');
  return res.json();
}

export async function createAccount(data: { code: string; name: string; type: string; parent_id?: number; description?: string }) {
  const res = await fetch(`${API_BASE}/api/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to create account');
  return res.json();
}

export async function updateAccount(id: number, data: { code: string; name: string; type: string; parent_id?: number; description?: string }) {
  const res = await fetch(`${API_BASE}/api/accounts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update account');
  return res.json();
}

export async function deleteAccount(id: number) {
  const res = await fetch(`${API_BASE}/api/accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete account');
  return res.json();
}

export async function createJournalEntry(data: { entry_date: string; description?: string; reference_type?: string; reference_id?: number; created_by?: string; lines: Array<{ account_id: number; debit?: number; credit?: number; description?: string }> }) {
  const res = await fetch(`${API_BASE}/api/journal/entries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to create entry'); }
  return res.json();
}

export async function getJournalEntries(params?: { from?: string; to?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const res = await fetch(`${API_BASE}/api/journal/entries?${q}`);
  if (!res.ok) throw new Error('Failed to fetch entries');
  return res.json();
}

export async function getJournalEntry(id: number) {
  const res = await fetch(`${API_BASE}/api/journal/entries/${id}`);
  if (!res.ok) throw new Error('Failed to fetch entry');
  return res.json();
}

export async function getTrialBalance(params?: { from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const res = await fetch(`${API_BASE}/api/reports/trial-balance?${q}`);
  if (!res.ok) throw new Error('Failed to fetch trial balance');
  return res.json();
}

export async function getBalanceSheet(params?: { date?: string }) {
  const q = new URLSearchParams();
  if (params?.date) q.set('date', params.date);
  const res = await fetch(`${API_BASE}/api/reports/balance-sheet?${q}`);
  if (!res.ok) throw new Error('Failed to fetch balance sheet');
  return res.json();
}

// Yandex Afisha
export async function getYandexAfishaSettings(): Promise<any> { return request('/api/admin/yandex-afisha/settings'); }
export async function updateYandexAfishaSettings(data: any): Promise<any> { return request('/api/admin/yandex-afisha/settings', { method: 'PUT', body: JSON.stringify(data) }); }
export async function testYandexAfishaConnection(): Promise<any> { return request('/api/admin/yandex-afisha/test', { method: 'POST' }); }
export async function getYandexAfishaBookings(params?: any): Promise<any> { return request('/api/admin/yandex-afisha/bookings' + (params ? '?' + new URLSearchParams(params).toString() : '')); }
export async function updateYandexAfishaBookingStatus(id: number, status: string): Promise<any> { return request(`/api/admin/yandex-afisha/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
export async function getYandexAfishaStats(params?: any): Promise<any> { return request('/api/admin/yandex-afisha/stats' + (params ? '?' + new URLSearchParams(params).toString() : '')); }

// Barcodes
export async function getBarcodeInventory(): Promise<any> { return request('/api/inventory-items?barcode=not_null&limit=1000'); }
export async function getBarcodeDishes(): Promise<any> { return request('/api/dishes?barcode=not_null&limit=1000'); }
export async function generateBarcode(): Promise<BarcodeGenerateResult> { return request('/api/barcode/generate', { method: 'POST' }); }
export async function printBarcodes(ids: number[], type?: string): Promise<void> { window.open(`/api/barcode/print?ids=${ids.join(',')}${type ? `&type=${type}` : ''}`, '_blank'); }
export async function lookupByBarcode(barcode: string): Promise<any> { return request(`/api/inventory/by-barcode/${encodeURIComponent(barcode)}`); }
export async function lookupDishByBarcode(barcode: string): Promise<any> { return request(`/api/dishes?barcode=${encodeURIComponent(barcode)}`); }

// ─── Franchising ─────────────────────────────────────────────
export async function getFranchiseNetworks(): Promise<any> { return request('/api/admin/franchise/networks'); }
export async function createFranchiseNetwork(data: any): Promise<any> { return request('/api/admin/franchise/networks', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateFranchiseNetwork(id: number, data: any): Promise<any> { return request(`/api/admin/franchise/networks/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function deleteFranchiseNetwork(id: number): Promise<void> { return request(`/api/admin/franchise/networks/${id}`, { method: 'DELETE' }); }
export async function getGlobalMenuItems(networkId: number): Promise<any> { return request(`/api/admin/franchise/menu/${networkId}`); }
export async function createGlobalMenuItem(data: any): Promise<any> { return request('/api/admin/franchise/menu', { method: 'POST', body: JSON.stringify(data) }); }
export async function deleteGlobalMenuItem(id: number): Promise<void> { return request(`/api/admin/franchise/menu/${id}`, { method: 'DELETE' }); }
export async function getRoyaltyInvoices(networkId: number): Promise<any> { return request(`/api/admin/franchise/royalty/${networkId}`); }
export async function generateRoyaltyInvoices(networkId: number, period: string): Promise<any> { return request(`/api/admin/franchise/royalty/generate`, { method: 'POST', body: JSON.stringify({ network_id: networkId, period }) }); }
export async function markRoyaltyPaid(invoiceId: number): Promise<any> { return request(`/api/admin/franchise/royalty/${invoiceId}/pay`, { method: 'POST' }); }
export async function getFranchiseAdaptations(): Promise<any> { return request('/api/franchise/adaptations'); }
export async function updateFranchiseAdaptation(itemId: number, data: any): Promise<any> { return request(`/api/franchise/adaptations/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function getTenantRoyaltyInvoices(): Promise<any> { return request('/api/franchise/royalty'); }

// ─── Честный знак ─────────────────────────────────────────────
export async function getHonestSignSettings(): Promise<any> {
  return request('/api/admin/honest-sign/settings');
}
export async function updateHonestSignSettings(data: any): Promise<any> {
  return request('/api/admin/honest-sign/settings', { method: 'PUT', body: JSON.stringify(data) });
}
export async function checkHonestSignCode(marking_code: string): Promise<any> {
  return request('/api/admin/honest-sign/check', { method: 'POST', body: JSON.stringify({ marking_code }) });
}
export async function getHonestSignProducts(): Promise<any[]> {
  return request('/api/admin/honest-sign/products');
}

// ─── Gamification API ─────────────────────────────────────────
export async function getGames(): Promise<any> { return request('/api/admin/games'); }
export async function createGame(data: any): Promise<any> { return request('/api/admin/games', { method: 'POST', body: JSON.stringify(data) }); }
export async function toggleGame(id: number): Promise<any> { return request(`/api/admin/games/${id}/toggle`, { method: 'POST' }); }
export async function deleteGame(id: number): Promise<any> { return request(`/api/admin/games/${id}`, { method: 'DELETE' }); }
export async function getGamificationStats(): Promise<any> { return request('/api/admin/gamification/stats'); }
export async function getGamificationLeaderboard(): Promise<any> { return request('/api/admin/gamification/leaderboard'); }

// ─── Guest Gamification API ───────────────────────────────────
export async function playWheelOfFortune(guest_id: number, points: number, prize: string): Promise<any> {
  return request('/api/games/wheel/play', { method: 'POST', body: JSON.stringify({ guest_id, points, prize }) });
}
export async function submitQuizAnswer(guest_id: number, score: number): Promise<any> {
  return request('/api/games/quiz/answer', { method: 'POST', body: JSON.stringify({ guest_id, score }) });
}
export async function getChallenges(guest_id: number): Promise<any> {
  return request(`/api/games/challenges?guest_id=${guest_id}`);
}

// ─── Multi-currency API ───────────────────────────────────────
export async function getExchangeRates(): Promise<any> { return request('/api/admin/exchange-rates'); }
export async function createExchangeRate(data: any): Promise<any> { return request('/api/admin/exchange-rates', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateExchangeRate(id: number, rate: number): Promise<any> { return request(`/api/admin/exchange-rates/${id}`, { method: 'PUT', body: JSON.stringify({ rate }) }); }
export async function deleteExchangeRate(id: number): Promise<any> { return request(`/api/admin/exchange-rates/${id}`, { method: 'DELETE' }); }
export async function autoUpdateExchangeRates(): Promise<any> { return request('/api/admin/exchange-rates/auto-update', { method: 'POST' }); }
export async function getTenantSettings(): Promise<any> { return request('/api/admin/tenant-settings'); }
export async function updateTenantSettings(data: any): Promise<any> { return request('/api/admin/tenant-settings', { method: 'PUT', body: JSON.stringify(data) }); }

// ─── Telephony Operator API ───────────────────────────────────
export async function searchClients(query: string): Promise<any> { return request(`/api/admin/clients/search?q=${encodeURIComponent(query)}`); }
export async function addTelephonyNote(call_id: string, notes: string): Promise<any> {
  return request('/api/admin/telephony/operator/notes', { method: 'POST', body: JSON.stringify({ call_id, notes }) });
}
export async function linkTelephonyOrder(call_id: string, order_id: number): Promise<any> {
  return request('/api/admin/telephony/operator/orders', { method: 'POST', body: JSON.stringify({ call_id, order_id }) });
}

export function getSwaggerJson(): string { return API_BASE + '/api-docs/swagger.json'; }
export function getSwaggerYaml(): string { return API_BASE + '/api-docs/swagger.yaml'; }
export function getSwaggerUI(): string { return '/api-docs'; }

// ─── Extensions API ──────────────────────────────────────────
export async function getExtensions(): Promise<any> { return request('/api/admin/extensions'); }
export async function installExtension(data: any): Promise<any> { return request('/api/admin/extensions/install', { method: 'POST', body: JSON.stringify(data) }); }
export async function toggleExtension(id: number): Promise<any> { return request(`/api/admin/extensions/${id}/toggle`, { method: 'POST' }); }
export async function uninstallExtension(id: number): Promise<any> { return request(`/api/admin/extensions/${id}`, { method: 'DELETE' }); }

// ─── IP Telephony API ────────────────────────────────────────
export async function getTelephonySettings(): Promise<any> { return request('/api/admin/telephony/settings'); }
export async function updateTelephonySettings(data: any): Promise<any> { return request('/api/admin/telephony/settings', { method: 'PUT', body: JSON.stringify(data) }); }
export async function testTelephonyConnection(): Promise<any> { return request('/api/admin/telephony/test', { method: 'POST' }); }
export async function getTelephonyLogs(): Promise<any> { return request('/api/admin/telephony/logs'); }
