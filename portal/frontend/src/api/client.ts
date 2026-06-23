const API_BASE = '/portal/api';

let accessToken: string | null = localStorage.getItem('fc_portal_token');
let refreshToken: string | null = localStorage.getItem('fc_portal_refresh');

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('fc_portal_token', access);
  localStorage.setItem('fc_portal_refresh', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('fc_portal_token');
  localStorage.removeItem('fc_portal_refresh');
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function fetchApi(path: string, options: { method?: string; headers?: Record<string,string>; body?: any } = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: { ...headers, ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

export async function request<T = any>(
  path: string,
  options: { method?: string; headers?: Record<string,string>; body?: any } = {}
): Promise<T> {
  let res = await fetchApi(path, options);

  if (res.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetchApi(path, options);
    } else {
      clearTokens();
      window.location.href = '/portal/login';
      throw new Error('Сессия истекла');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка запроса' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (data: any) =>
    request<{ accessToken: string; refreshToken: string; user: any }>('/auth/register', { method: 'POST', body: data }),
  logout: () =>
    request('/auth/logout', { method: 'POST', body: { refreshToken } }),
  getMe: () => request<any>('/auth/me'),

  // Tariffs
  getTariffs: () => request<any[]>('/tariffs'),

  // Tenants
  getMyTenant: () => request<any>('/tenants/my'),
  updateMyTenant: (data: any) => request<any>('/tenants/my', { method: 'PUT', body: data }),
  changeTariff: (tariff_id: number) => request<any>('/tenants/my/change-tariff', { method: 'POST', body: { tariff_id } }),
  getTenantStats: () => request<any>('/tenants/my/stats'),

  // Payments
  getPayments: () => request<any[]>('/payments'),
  getInvoices: () => request<any[]>('/payments/invoices'),
  createPayment: (amount: number, description?: string) =>
    request<any>('/payments/create', { method: 'POST', body: { amount, description } }),
  confirmPayment: (id: number) =>
    request<any>(`/payments/${id}/confirm`, { method: 'POST' }),

  // Staff accounts
  getStaffAccounts: () => request<any[]>('/staff'),
  createStaffAccount: (data: any) => request<any>('/staff', { method: 'POST', body: data }),
  updateStaffAccount: (id: number, data: any) => request<any>(`/staff/${id}`, { method: 'PUT', body: data }),
  deleteStaffAccount: (id: number) => request(`/staff/${id}`, { method: 'DELETE' }),

  // Admin (superadmin only)
  adminGetTenants: (params?: { status?: string; search?: string }) =>
    request<any[]>(`/admin/tenants${params ? '?' + new URLSearchParams(params as any).toString() : ''}`),
  adminGetTenant: (id: number) => request<any>(`/admin/tenants/${id}`),
  adminUpdateTenantStatus: (id: number, status: string) =>
    request<any>(`/admin/tenants/${id}/status`, { method: 'PATCH', body: { status } }),
  adminCreateTenant: (data: any) => request<any>('/admin/tenants', { method: 'POST', body: data }),
  adminGetStats: () => request<any>('/admin/stats'),
  adminGetAudit: (limit = 50, offset = 0) => request<any[]>(`/admin/audit?limit=${limit}&offset=${offset}`),
  adminGetTariffs: () => request<any[]>('/admin/tariffs'),
  adminCreateTariff: (data: any) => request<any>('/admin/tariffs', { method: 'POST', body: data }),
  adminUpdateTariff: (id: number, data: any) => request<any>(`/admin/tariffs/${id}`, { method: 'PUT', body: data }),
  adminDeleteTenant: (id: number) => request(`/admin/tenants/${id}`, { method: 'DELETE' }),
  adminExtendSubscription: (id: number, months: number) =>
    request<any>(`/admin/tenants/${id}/extend`, { method: 'PATCH', body: { months } }),
  adminUpdateTenantNotes: (id: number, notes: string) =>
    request<any>(`/admin/tenants/${id}/notes`, { method: 'PATCH', body: { notes } }),
  adminNotifyTenant: (id: number, subject: string, body: string, type?: string) =>
    request<any>(`/admin/tenants/${id}/notify`, { method: 'POST', body: { subject, body, type } }),
  adminGetTenantNotifications: (id: number) =>
    request<any[]>(`/admin/tenants/${id}/notifications`),
  adminGetAllNotifications: () => request<any[]>('/admin/notifications'),
  adminExportTenantsCSV: () => '/api/admin/tenants/export/csv',

  // Analytics dashboard
  adminGetDashboard: () => request<any>('/admin/dashboard'),

  // User management
  adminGetTenantUsers: (tenantId: number) => request<any>(`/admin/users/${tenantId}`),

  // Impersonation
  adminImpersonate: (staffId: number, tenantId: number) =>
    request<any>('/admin/impersonate', { method: 'POST', body: { staff_id: staffId, tenant_id: tenantId } }),

  // Audit export
  adminAuditExport: (params?: { tenant_id?: number; action?: string; from?: string; to?: string }) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return '/api/admin/audit/export' + q;
  },

  // Invoices
  adminCreateInvoice: (tenantId: number, amount: number, description?: string, due_date?: string) =>
    request<any>('/admin/invoices/manual', { method: 'POST', body: { tenant_id: tenantId, amount, description, due_date } }),
  adminGetInvoices: (params?: { tenant_id?: number; status?: string }) =>
    request<any[]>('/admin/invoices' + (params ? '?' + new URLSearchParams(params as any).toString() : '')),

  // Broadcast
  adminBroadcast: (subject: string, body: string, type?: string, tariff_ids?: number[]) =>
    request<any>('/admin/broadcast', { method: 'POST', body: { subject, body, type, tariff_ids } }),

  // Modules
  adminGetModules: (tenantId?: number) =>
    request<any[]>('/admin/modules' + (tenantId ? `?tenant_id=${tenantId}` : '')),
  adminUpdateModules: (tenantId: number, modules: { code: string; enabled: boolean }[]) =>
    request<any>(`/admin/modules/${tenantId}`, { method: 'PUT', body: { modules } }),

  // Tickets
  getTickets: (params?: { status?: string; priority?: string }) =>
    request<any[]>('/tickets' + (params ? '?' + new URLSearchParams(params as any).toString() : '')),
  createTicket: (subject: string, description: string, priority?: string, attachment?: string) =>
    request<any>('/tickets', { method: 'POST', body: { subject, description, priority, attachment } }),
  getTicket: (id: number) => request<any>(`/tickets/${id}`),
  addTicketMessage: (id: number, message: string, isInternal?: boolean) =>
    request<any>(`/tickets/${id}/messages`, { method: 'POST', body: { message, is_internal: isInternal } }),
  updateTicketStatus: (id: number, status: string) =>
    request<any>(`/tickets/${id}/status`, { method: 'PATCH', body: { status } }),

  // Articles
  getArticles: (params?: { category?: string; search?: string }) =>
    request<any[]>('/articles' + (params ? '?' + new URLSearchParams(params as any).toString() : '')),
  getArticle: (slug: string) => request<any>(`/articles/${slug}`),

  // Templates
  getTemplates: () => request<any[]>('/templates'),
  createTemplate: (data: any) => request<any>('/templates', { method: 'POST', body: data }),
  updateTemplate: (id: number, data: any) => request<any>(`/templates/${id}`, { method: 'PUT', body: data }),
  deleteTemplate: (id: number) => request(`/templates/${id}`, { method: 'DELETE' }),

  // Monitoring
  getUptimeStatus: () => request<any[]>('/monitoring/status'),
  getUptimeChecks: (params?: { tenant_id?: number; days?: number }) =>
    request<any[]>('/monitoring/uptime' + (params ? '?' + new URLSearchParams(params as any).toString() : '')),
  runUptimeCheck: () => request<any>('/monitoring/check', { method: 'POST' }),
  getResourceUsage: () => request<any[]>('/monitoring/usage'),

  // Branding
  getPlatformBranding: () => request<any>('/branding/platform'),
  updatePlatformBranding: (data: any) => request<any>('/branding/platform', { method: 'PUT', body: data }),
  getTenantBranding: (tenantId: number) => request<any>(`/branding/tenant/${tenantId}`),
  updateTenantBranding: (tenantId: number, data: any) =>
    request<any>(`/branding/tenant/${tenantId}`, { method: 'PUT', body: data }),

  // Tenant extended (superadmin)
  adminUpdateTenant: (id: number, data: any) =>
    request<any>(`/admin/tenants/${id}`, { method: 'PUT', body: data }),
  adminImpersonateTenant: (tenantId: number) =>
    request<any>(`/admin/tenants/${tenantId}/impersonate`, { method: 'POST' }),
  adminResetTenantPassword: (tenantId: number) =>
    request<any>(`/admin/tenants/${tenantId}/reset-password`, { method: 'POST' }),
  adminGetTenantStatistics: (tenantId: number) =>
    request<any>(`/admin/tenants/${tenantId}/statistics`),
  adminGetTenantStaff: (tenantId: number) =>
    request<any[]>(`/admin/tenants/${tenantId}/staff`),
  adminBlockStaff: (tenantId: number, staffId: number) =>
    request<any>(`/admin/tenants/${tenantId}/staff/${staffId}/block`, { method: 'PUT' }),
  adminUnblockStaff: (tenantId: number, staffId: number) =>
    request<any>(`/admin/tenants/${tenantId}/staff/${staffId}/unblock`, { method: 'PUT' }),
  adminGetBranches: (tenantId?: number) =>
    request<any[]>(`/admin/branches${tenantId ? '?tenant_id=' + tenantId : ''}`),
  adminCreateBranch: (data: any) =>
    request<any>('/admin/branches', { method: 'POST', body: data }),
  adminUpdateBranch: (id: number, data: any) =>
    request<any>(`/admin/branches/${id}`, { method: 'PUT', body: data }),
  adminDeleteBranch: (id: number) =>
    request(`/admin/branches/${id}`, { method: 'DELETE' }),
  adminGetSuperadminLogs: (params?: { tenant_id?: number; limit?: number; offset?: number }) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<any[]>('/admin/superadmin-logs' + q);
  },
  // App settings management
  getAppSettings: (tenantId: number) =>
    request<any>(`/admin/tenants/${tenantId}/app-settings`),
  updateAppSettings: (tenantId: number, app_settings: any) =>
    request<any>(`/admin/tenants/${tenantId}/app-settings`, { method: 'PUT', body: { app_settings } }),
  checkAppSettingsLimits: (tenantId: number, app_settings: any) =>
    request<any>(`/admin/tenants/${tenantId}/app-settings/check-limits`, { method: 'POST', body: { app_settings } }),
  getAppSettingsTemplates: () =>
    request<any[]>('/admin/app-settings/templates'),

  // Tenant's own app settings & usage
  getMyAppSettings: () => request<any>('/tenants/my/app-settings'),

  // Access mode management
  getAccessMode: (tenantId: number) => request<any>(`/admin/tenants/${tenantId}/access-mode`),
  updateAccessMode: (tenantId: number, accessMode: string) =>
    request<any>(`/admin/tenants/${tenantId}/access-mode`, { method: 'PUT', body: { access_mode: accessMode } }),
  resetDemoData: (tenantId: number) =>
    request<any>(`/admin/tenants/${tenantId}/reset-demo`, { method: 'POST' }),

  // Branches for tenant users
  getMyBranches: () => request<any[]>('/tenants/my/branches'),
  createMyBranch: (data: any) => request<any>('/tenants/my/branches', { method: 'POST', body: data }),
  updateMyBranch: (id: number, data: any) => request<any>(`/tenants/my/branches/${id}`, { method: 'PUT', body: data }),
  deleteMyBranch: (id: number) => request(`/tenants/my/branches/${id}`, { method: 'DELETE' }),

  // Payment providers
  getPaymentProviders: () => request<any[]>('/subscriptions/providers'),

  // Subscriptions (self-service)
  getSubscriptionStatus: () => request<any>('/subscriptions/status'),
  createSubscription: (data: { tariffId: number; cardNumber?: string; expireDate?: string; provider?: string }) =>
    request<any>('/subscriptions/create', { method: 'POST', body: data }),
  confirmSubscription: (id: number) =>
    request<any>(`/subscriptions/confirm/${id}`, { method: 'POST' }),
  cancelSubscription: (reason?: string) =>
    request<any>('/subscriptions/cancel', { method: 'POST', body: { reason } }),
  changeSubscriptionTariff: (tariffId: number) =>
    request<any>('/subscriptions/change-tariff', { method: 'POST', body: { tariffId } }),
  getSubscriptionPayments: () => request<any[]>('/subscriptions/payments'),
  getSubscriptionHistory: () => request<any[]>('/subscriptions/history'),

  // Admin: payment providers
  adminGetPaymentProviders: () => request<any[]>('/admin/payment-providers'),
  adminCreatePaymentProvider: (data: { code: string; name: string; description?: string }) =>
    request<any>('/admin/payment-providers', { method: 'POST', body: data }),
  adminUpdatePaymentProvider: (code: string, data: { is_active?: boolean; config?: any }) =>
    request<any>(`/admin/payment-providers/${code}`, { method: 'PUT', body: data }),
  adminDeletePaymentProvider: (code: string) =>
    request<any>(`/admin/payment-providers/${code}`, { method: 'DELETE' }),

  // Admin: subscription management
  adminGetSubscriptions: (params?: { status?: string; tariff_id?: number; provider?: string }) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<any[]>('/admin/subscriptions' + q);
  },
  adminGetTenantSubscriptions: (tenantId: number) =>
    request<any[]>(`/admin/subscriptions/${tenantId}`),
  adminUpdateSubscriptionStatus: (id: number, data: { status: string; end_date?: string; note?: string }) =>
    request<any>(`/admin/subscriptions/${id}/status`, { method: 'PUT', body: data }),
  adminRenewSubscription: (id: number, months?: number) =>
    request<any>(`/admin/subscriptions/${id}/renew`, { method: 'POST', body: { months: months || 1 } }),
  adminGetTenantPayments: (tenantId: number) =>
    request<any[]>(`/admin/subscriptions/${tenantId}/payments`),

  // Exchange Rates (superadmin)
  adminGetExchangeRates: () => request<any[]>('/admin/exchange-rates'),
  adminCreateExchangeRate: (data: { currency_code: string; name: string; symbol: string; rate: number }) =>
    request<any>('/admin/exchange-rates', { method: 'POST', body: data }),
  adminUpdateExchangeRate: (id: number, data: { rate?: number; name?: string; symbol?: string }) =>
    request<any>(`/admin/exchange-rates/${id}`, { method: 'PUT', body: data }),
  adminDeleteExchangeRate: (id: number) =>
    request(`/admin/exchange-rates/${id}`, { method: 'DELETE' }),
  adminAutoUpdateExchangeRates: () =>
    request<any>('/admin/exchange-rates/auto-update', { method: 'POST' }),

  // Search
  globalSearch: (q: string) => request<any>(`/search?q=${encodeURIComponent(q)}`),
};

export const AVAILABLE_CURRENCIES = [
  { code: 'RUB', name: 'Российский рубль', symbol: '₽' },
  { code: 'USD', name: 'Доллар США', symbol: '$' },
  { code: 'EUR', name: 'Евро', symbol: '€' },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸' },
  { code: 'UZS', name: 'Узбекский сум', symbol: "so'm" },
  { code: 'BYN', name: 'Белорусский рубль', symbol: 'Br' },
  { code: 'AMD', name: 'Армянский драм', symbol: '֏' },
  { code: 'KGS', name: 'Киргизский сом', symbol: 'с' },
  { code: 'CNY', name: 'Китайский юань', symbol: '¥' },
  { code: 'TRY', name: 'Турецкая лира', symbol: '₺' },
  { code: 'GBP', name: 'Фунт стерлингов', symbol: '£' },
  { code: 'AED', name: 'Дирхам ОАЭ', symbol: 'د.إ' },
];
