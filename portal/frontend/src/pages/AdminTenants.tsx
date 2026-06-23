import { useEffect, useState } from 'react';
import { api, AVAILABLE_CURRENCIES } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X, Check, AlertCircle, Download, Trash2, Calendar, Bell, FileText, ExternalLink, Edit3, User, MapPin, BarChart3, Shield, Key, LogIn, Eye, EyeOff, Copy, RefreshCw, Smartphone, Layers } from 'lucide-react';

export function AdminTenants() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [showNotify, setShowNotify] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [tenantStaff, setTenantStaff] = useState<any[]>([]);
  const [tenantBranches, setTenantBranches] = useState<any[]>([]);
  const [tenantStats, setTenantStats] = useState<any>(null);
  const [tenantLogs, setTenantLogs] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<Record<string,any>>({});
  const [showEdit, setShowEdit] = useState(false);
  const [impersonationResult, setImpersonationResult] = useState<any>(null);
  const [passwordResult, setPasswordResult] = useState<any>(null);
  const [createResult, setCreateResult] = useState<any>(null);
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '' });
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editBranchId, setEditBranchId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [tariffs, setTariffs] = useState<any[]>([]);

  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.adminGetTenants(search ? { search } : {}),
      api.adminGetStats(),
    ]).then(([t, s]) => { setTenants(t); setStats(s); })
    .catch(() => {})
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([
      api.adminGetTenants(),
      api.adminGetStats(),
      api.adminGetTariffs(),
    ]).then(([t, s, tr]) => { setTenants(t); setStats(s); setTariffs(tr); })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    setActiveTab('details');
    setImpersonationResult(null);
    setPasswordResult(null);
    setAppSettings(null);
    loadTenantData(selectedTenant.id);
  }, [selectedTenant?.id]);

  useEffect(() => {
    if (activeTab === 'apps' && selectedTenant) {
      loadAppSettings();
    }
  }, [activeTab, selectedTenant?.id]);

  const loadTenantData = async (id: number) => {
    try {
      const [staff, branches, statsData, logs] = await Promise.all([
        api.adminGetTenantStaff(id).catch(() => []),
        api.adminGetBranches(id).catch(() => []),
        api.adminGetTenantStatistics(id).catch(() => null),
        api.adminGetSuperadminLogs({ tenant_id: id, limit: 20 }).catch(() => []),
      ]);
      setTenantStaff(staff);
      setTenantBranches(branches);
      setTenantStats(statsData);
      setTenantLogs(logs);
    } catch {}
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const handleStatus = async (id: number, status: string) => {
    try { await api.adminUpdateTenantStatus(id, status); load(); if (selectedTenant?.id === id) setSelectedTenant({ ...selectedTenant, status }); } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены? Все данные арендатора будут удалены.')) return;
    try { await api.adminDeleteTenant(id); load(); setSelectedTenant(null); } catch {}
  };

  const handleExtend = async (id: number) => {
    const months = prompt('На сколько месяцев продлить?', '1');
    if (!months || parseInt(months) < 1) return;
    try {
      const updated = await api.adminExtendSubscription(id, parseInt(months));
      if (selectedTenant?.id === id) setSelectedTenant({ ...selectedTenant, subscription_end: updated.subscription_end });
      load();
    } catch {}
  };

  const handleNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const subject = formData.get('subject') as string;
    const body = formData.get('body') as string;
    const type = formData.get('type') as string;
    try { await api.adminNotifyTenant(showNotify!, subject, body, type); setShowNotify(null); alert('Уведомление отправлено'); } catch {}
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await api.adminCreateTenant(form);
      setShowCreate(false);
      setCreateResult({ name: form.name, admin_username: form.admin_username, admin_password: form.admin_password });
      setForm({ name: '', nickname: '', inn: '', phone: '', email: '', address: '', tariff_id: 1, admin_username: '', admin_password: '', access_mode: 'demo', with_demo_data: false, base_currency: 'RUB' });
      load();
    } catch (err: any) { setError(err.message); }
  };

  const handleEditSave = async () => {
    try {
      const updated = await api.adminUpdateTenant(selectedTenant.id, editForm);
      setSelectedTenant({ ...selectedTenant, ...updated });
      setShowEdit(false);
      load();
    } catch (err: any) { alert(err.message); }
  };

  const handleImpersonate = async () => {
    try {
      const result = await api.adminImpersonateTenant(selectedTenant.id);
      setImpersonationResult(result);
    } catch (err: any) { alert(err.message); }
  };

  const handleResetPassword = async () => {
    if (!confirm('Сбросить пароль администратора ресторана?')) return;
    try {
      const result = await api.adminResetTenantPassword(selectedTenant.id);
      setPasswordResult(result);
    } catch (err: any) { alert(err.message); }
  };

  const handleBlockStaff = async (staffId: number) => {
    try { await api.adminBlockStaff(selectedTenant.id, staffId); loadTenantData(selectedTenant.id); } catch {}
  };

  const handleUnblockStaff = async (staffId: number) => {
    try { await api.adminUnblockStaff(selectedTenant.id, staffId); loadTenantData(selectedTenant.id); } catch {}
  };

  const handleSaveBranch = async () => {
    try {
      if (editBranchId) {
        await api.adminUpdateBranch(editBranchId, branchForm);
      } else {
        await api.adminCreateBranch({ tenant_id: selectedTenant.id, ...branchForm });
      }
      setBranchForm({ name: '', address: '', phone: '' });
      setEditBranchId(null);
      setShowBranchForm(false);
      loadTenantData(selectedTenant.id);
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteBranch = async (id: number) => {
    if (!confirm('Удалить точку?')) return;
    try { await api.adminDeleteBranch(id); loadTenantData(selectedTenant.id); } catch {}
  };

  const [form, setForm] = useState({
    name: '', nickname: '', inn: '', phone: '', email: '', address: '', tariff_id: 1,
    admin_username: '', admin_password: '', access_mode: 'demo', with_demo_data: false, base_currency: 'RUB',
  });

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700',
    suspended: 'bg-red-100 text-red-700', cancelled: 'bg-zinc-100 text-zinc-500',
  };

  const statusLabels: Record<string, string> = {
    active: 'Активен', pending: 'Ожидает', suspended: 'Заблокирован', cancelled: 'Отменён',
  };

  const accessModeColors: Record<string, string> = {
    demo: 'bg-amber-100 text-amber-700', production: 'bg-green-100 text-green-700',
  };

  const accessModeLabels: Record<string, string> = {
    demo: 'Демо', production: 'Продакшн',
  };

  const [appSettings, setAppSettings] = useState<any>(null);
  const [appSettingsLoading, setAppSettingsLoading] = useState(false);
  const [appSettingsError, setAppSettingsError] = useState('');
  const [appSettingsTemplates, setAppSettingsTemplates] = useState<any[]>([]);
  const [showAppSettingsTemplatePicker, setShowAppSettingsTemplatePicker] = useState(false);
  const [limitWarnings, setLimitWarnings] = useState<any[]>([]);
  const [showLimitConfirm, setShowLimitConfirm] = useState(false);
  const [pendingAppSettingsSave, setPendingAppSettingsSave] = useState<any>(null);

  const loadAppSettings = async () => {
    if (!selectedTenant) return;
    setAppSettingsLoading(true);
    setAppSettingsError('');
    try {
      const data = await api.getAppSettings(selectedTenant.id);
      setAppSettings(data.app_settings);
      const templates = await api.getAppSettingsTemplates();
      setAppSettingsTemplates(templates);
    } catch (err: any) {
      setAppSettingsError(err.message);
    } finally {
      setAppSettingsLoading(false);
    }
  };

  const handleAppLimitChange = (roleKey: string, value: string) => {
    const limit = value === '' ? -1 : parseInt(value, 10);
    setAppSettings((prev: any) => ({
      ...prev,
      [roleKey]: isNaN(limit) ? -1 : limit,
    }));
  };

  const handleSaveAppSettings = async () => {
    if (!selectedTenant || !appSettings) return;
    setAppSettingsError('');
    try {
      const check = await api.checkAppSettingsLimits(selectedTenant.id, appSettings);
      if (check.has_warnings) {
        setLimitWarnings(check.warnings);
        setPendingAppSettingsSave(appSettings);
        setShowLimitConfirm(true);
        return;
      }
      await api.updateAppSettings(selectedTenant.id, appSettings);
      alert('Лимиты сохранены');
    } catch (err: any) {
      setAppSettingsError(err.message);
    }
  };

  const handleConfirmLimitReduce = async () => {
    if (!selectedTenant || !pendingAppSettingsSave) return;
    try {
      await api.updateAppSettings(selectedTenant.id, pendingAppSettingsSave);
      setShowLimitConfirm(false);
      setPendingAppSettingsSave(null);
      setLimitWarnings([]);
      alert('Лимиты сохранены. Существующие пользователи останутся активными, но добавлять новых будет нельзя до освобождения мест.');
    } catch (err: any) {
      setAppSettingsError(err.message);
    }
  };

  const handleApplyAppTemplate = (template: any) => {
    setAppSettings(template.app_settings);
    setShowAppSettingsTemplatePicker(false);
  };

  const handleAccessModeChange = async (tenantId: number, newMode: string) => {
    try {
      const updated = await api.updateAccessMode(tenantId, newMode);
      setSelectedTenant({ ...selectedTenant, access_mode: newMode });
      load();
    } catch (err: any) { alert(err.message); }
  };

  const handleResetDemo = async (tenantId: number) => {
    if (!confirm('Сбросить демо-данные? Все текущие данные в демо-режиме будут удалены и заменены стартовым набором.')) return;
    try {
      await api.resetDemoData(tenantId);
      alert('Демо-данные успешно сброшены');
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Управление ресторанами</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Всего: {stats?.total_tenants || 0}</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/admin/export" download
            className="border border-zinc-300 text-zinc-700 font-medium px-4 py-2 rounded-xl hover:bg-zinc-50 transition text-sm flex items-center gap-2">
            <Download size={16} /> CSV
          </a>
          <button onClick={() => setShowCreate(true)} className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-xl hover:bg-zinc-800 transition text-sm flex items-center gap-2">
            <Plus size={16} /> Создать
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-zinc-900">{stats.total_tenants}</div>
            <div className="text-xs text-zinc-500">Всего</div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-green-600">{stats.active_tenants}</div>
            <div className="text-xs text-zinc-500">Активных</div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-zinc-900">{stats.monthly_revenue.toLocaleString('ru-RU')} ₽</div>
            <div className="text-xs text-zinc-500">Выручка за месяц</div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-zinc-900">{stats.total_revenue.toLocaleString('ru-RU')} ₽</div>
            <div className="text-xs text-zinc-500">Всего</div>
          </div>
        </div>
      )}

      {/* Create tenant modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Создать ресторан</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-3">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Название ресторана *" className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" /></div>
                <input value={form.nickname} onChange={e => setForm(p => ({ ...p, nickname: e.target.value }))} placeholder="Ник (nickname) — для входа" className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={form.inn} onChange={e => setForm(p => ({ ...p, inn: e.target.value }))} required placeholder="ИНН *" className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required placeholder="Телефон *" className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <div className="col-span-2"><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required type="email" placeholder="Email *" className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" /></div>
                <div className="col-span-2"><input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Адрес" className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" /></div>
                <select value={form.tariff_id} onChange={e => setForm(p => ({ ...p, tariff_id: parseInt(e.target.value) }))} className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400">
                  {tariffs.map(t => <option key={t.id} value={t.id}>{t.name} — {t.price_monthly} ₽/мес</option>)}
                </select>
                <select value={form.access_mode} onChange={e => setForm(p => ({ ...p, access_mode: e.target.value }))} className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="demo">Демо-режим</option>
                  <option value="production">Реальный (Production)</option>
                </select>
                <select value={form.base_currency} onChange={e => setForm(p => ({ ...p, base_currency: e.target.value }))} className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400">
                  {AVAILABLE_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
                </select>
                <input value={form.admin_username} onChange={e => setForm(p => ({ ...p, admin_username: e.target.value }))} required placeholder="Логин админа *" className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <input value={form.admin_password} onChange={e => setForm(p => ({ ...p, admin_password: e.target.value }))} required type="password" placeholder="Пароль админа *" className="px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                <div className="col-span-2 flex items-center gap-2">
                  <input id="with_demo_data" type="checkbox" checked={form.with_demo_data} onChange={e => setForm(p => ({ ...p, with_demo_data: e.target.checked }))}
                    className="w-4 h-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-400" />
                  <label htmlFor="with_demo_data" className="text-sm text-zinc-700 cursor-pointer">Заполнить тестовыми данными</label>
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition">Создать ресторан</button>
            </form>
          </div>
        </div>
      )}

      {/* Send notification modal */}
      {showNotify && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNotify(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Отправить уведомление</h2>
              <button onClick={() => setShowNotify(null)} className="p-1 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleNotify} className="space-y-3">
              <input name="subject" required placeholder="Тема" className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              <textarea name="body" required placeholder="Текст уведомления" rows={4} className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              <select name="type" className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400">
                <option value="info">Информация</option>
                <option value="warning">Предупреждение</option>
                <option value="billing">Оплата</option>
                <option value="maintenance">Техработы</option>
              </select>
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition">Отправить</button>
            </form>
          </div>
        </div>
      )}

      {/* Create success dialog */}
      {createResult && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCreateResult(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-green-700">Ресторан создан</h2>
              <button onClick={() => setCreateResult(null)} className="p-1 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-zinc-700 mb-2">Ресторан: <strong>{createResult.name}</strong></p>
              <div className="text-sm space-y-1">
                <p><span className="text-zinc-500">Логин:</span> <strong className="font-mono">{createResult.admin_username}</strong></p>
                <p><span className="text-zinc-500">Пароль:</span> <strong className="font-mono">{createResult.admin_password}</strong></p>
              </div>
              <p className="text-xs text-zinc-500 mt-3">Сохраните эти данные. Пароль не может быть восстановлен, только сброшен.</p>
            </div>
            <button onClick={() => setCreateResult(null)} className="w-full bg-zinc-900 text-white font-bold py-2.5 rounded-xl hover:bg-zinc-800 transition text-sm">
              Понятно
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию, email, ИНН..."
            className="w-full pl-9 pr-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
      </form>

      {/* Tenant list */}
      {loading ? (
        <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>
      ) : (
        <div className="space-y-2">
          {tenants.map(t => (
            <div key={t.id} className="bg-white border border-zinc-200 rounded-xl px-5 py-3.5 flex items-center justify-between hover:shadow-sm transition cursor-pointer" onClick={() => setSelectedTenant(t)}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {t.name?.[0] || '?'}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-zinc-900 text-sm truncate">{t.name}</div>
                  <div className="text-xs text-zinc-500 truncate">{t.email} · {t.inn}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${accessModeColors[t.access_mode] || 'bg-zinc-100 text-zinc-500'}`}>
                  {accessModeLabels[t.access_mode] || '—'}
                </span>
                <span className="text-xs text-zinc-400 hidden sm:inline">{t.tariff_name || '—'}</span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusColors[t.status] || ''}`}>{statusLabels[t.status]}</span>
                {t.status !== 'suspended' ? (
                  <button onClick={(e) => { e.stopPropagation(); handleStatus(t.id, 'suspended'); }} className="p-1.5 text-zinc-400 hover:text-red-500 transition" title="Заблокировать"><X size={15} /></button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); handleStatus(t.id, 'active'); }} className="p-1.5 text-zinc-400 hover:text-green-500 transition" title="Активировать"><Check size={15} /></button>
                )}
              </div>
            </div>
          ))}
          {tenants.length === 0 && <p className="text-center text-zinc-400 text-sm py-8">Рестораны не найдены</p>}
        </div>
      )}

      {/* Tenant detail modal (full-featured) */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2 sm:p-4" onClick={() => { setSelectedTenant(null); setShowEdit(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white z-10 border-b border-zinc-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0">
                    {selectedTenant.name?.[0] || '?'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">{selectedTenant.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[selectedTenant.status] || ''}`}>{statusLabels[selectedTenant.status]}</span>
                      {selectedTenant.nickname && <span className="text-xs text-zinc-400">@{selectedTenant.nickname}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => { setSelectedTenant(null); setShowEdit(false); }} className="p-1.5 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 flex-wrap">
                {[
                  { id: 'details', icon: User, label: 'Основное' },
                  { id: 'staff', icon: Shield, label: 'Сотрудники' },
                  { id: 'apps', icon: Smartphone, label: 'Лимиты' },
                  { id: 'branches', icon: MapPin, label: 'Точки' },
                  { id: 'stats', icon: BarChart3, label: 'Статистика' },
                  { id: 'logs', icon: FileText, label: 'Логи' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === tab.id ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                    <tab.icon size={15} /> {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {/* TAB: Details */}
              {activeTab === 'details' && (
                <div>
                  {showEdit ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs text-zinc-500 block mb-1">Название</label>
                          <input value={editForm.name ?? selectedTenant.name ?? ''} onChange={e => setEditForm(p => ({...p, name: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">ИНН</label>
                          <input value={(editForm.inn ?? selectedTenant.inn) || ''} onChange={e => setEditForm(p => ({...p, inn: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Название</label>
                          <input value={editForm.name ?? selectedTenant.name ?? ''} onChange={e => setEditForm(p => ({...p, name: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Ник (nickname) — для входа в админку</label>
                          <input value={editForm.nickname ?? selectedTenant.nickname ?? ''} onChange={e => setEditForm(p => ({...p, nickname: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Email</label>
                          <input value={editForm.email ?? selectedTenant.email ?? ''} onChange={e => setEditForm(p => ({...p, email: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Адрес</label>
                          <input value={editForm.address ?? selectedTenant.address ?? ''} onChange={e => setEditForm(p => ({...p, address: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Юридический адрес</label>
                          <input value={(editForm.legal_address ?? selectedTenant.legal_address) || ''} onChange={e => setEditForm(p => ({...p, legal_address: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-zinc-500 block mb-1">Режим работы</label>
                          <input value={(editForm.working_hours ?? selectedTenant.working_hours) || ''} onChange={e => setEditForm(p => ({...p, working_hours: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Логин администратора</label>
                          <input value={(editForm.admin_username ?? selectedTenant.admin_username) || ''} onChange={e => setEditForm(p => ({...p, admin_username: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Новый пароль админа</label>
                          <input type="text" value={editForm.admin_password || ''} onChange={e => setEditForm(p => ({...p, admin_password: e.target.value}))} placeholder="Оставьте пустым, чтобы не менять" className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Logo URL</label>
                          <input value={(editForm.logo_url ?? selectedTenant.logo_url) || ''} onChange={e => setEditForm(p => ({...p, logo_url: e.target.value}))} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={editForm.allow_create_branches ?? selectedTenant.allow_create_branches} onChange={e => setEditForm(p => ({...p, allow_create_branches: e.target.checked ? 1 : 0}))}
                              className="w-4 h-4 rounded border-zinc-300 text-orange-500 focus:ring-orange-400" />
                            <span className="text-sm text-zinc-700">Разрешено создавать точки</span>
                          </label>
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Базовая валюта</label>
                          <select value={editForm.base_currency ?? selectedTenant.base_currency ?? 'RUB'} onChange={e => setEditForm(p => ({...p, base_currency: e.target.value}))}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400">
                            {AVAILABLE_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={handleEditSave} className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800">Сохранить</button>
                        <button onClick={() => setShowEdit(false)} className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-sm hover:bg-zinc-50">Отмена</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-2 gap-3 text-sm mb-5">
                        <div><span className="text-zinc-500">ИНН:</span> {selectedTenant.inn}</div>
                        <div><span className="text-zinc-500">Телефон:</span> {selectedTenant.phone}</div>
                        <div><span className="text-zinc-500">Логин админа:</span> {selectedTenant.admin_username || '—'}</div>
                        <div><span className="text-zinc-500">Пароль админа:</span> {selectedTenant.admin_username ? '••••••••' : '—'}</div>
                        <div className="col-span-2"><span className="text-zinc-500">Email:</span> {selectedTenant.email}</div>
                        <div><span className="text-zinc-500">Тариф:</span> {selectedTenant.tariff_name || '—'}</div>
                        <div><span className="text-zinc-500">Статус:</span> <span className={`font-bold ${selectedTenant.status === 'active' ? 'text-green-600' : selectedTenant.status === 'suspended' ? 'text-red-600' : ''}`}>{statusLabels[selectedTenant.status]}</span></div>
                        <div><span className="text-zinc-500">Подписка до:</span> {selectedTenant.subscription_end ? new Date(selectedTenant.subscription_end).toLocaleDateString('ru-RU') : '—'}</div>
                        <div><span className="text-zinc-500">Создан:</span> {selectedTenant.created_at ? new Date(selectedTenant.created_at).toLocaleDateString('ru-RU') : '—'}</div>
                        <div className="col-span-2"><span className="text-zinc-500">Адрес:</span> {selectedTenant.address || '—'}</div>
                        <div className="col-span-2"><span className="text-zinc-500">Юридический адрес:</span> {selectedTenant.legal_address || '—'}</div>
                        <div className="col-span-2"><span className="text-zinc-500">Режим работы:</span> {selectedTenant.working_hours || '—'}</div>
                        <div><span className="text-zinc-500">Точки:</span> {selectedTenant.allow_create_branches ? <span className="text-green-600 font-medium">Разрешено</span> : <span className="text-red-500 font-medium">Запрещено</span>}</div>
                        <div><span className="text-zinc-500">Валюта:</span> {(AVAILABLE_CURRENCIES.find(c => c.code === (selectedTenant.base_currency || 'RUB')))?.symbol || '₽'} {selectedTenant.base_currency || 'RUB'}</div>
                        <div className="col-span-2 border-t border-zinc-100 pt-3 mt-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs text-zinc-500 font-medium">Режим доступа:</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleAccessModeChange(selectedTenant.id, 'demo')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTenant.access_mode === 'demo' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}>
                                Демо
                              </button>
                              <button onClick={() => handleAccessModeChange(selectedTenant.id, 'production')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTenant.access_mode === 'production' ? 'bg-green-100 text-green-700 ring-2 ring-green-300' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}>
                                Реальный
                              </button>
                            </div>
                            {selectedTenant.access_mode === 'demo' && (
                              <button onClick={() => handleResetDemo(selectedTenant.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition ml-2">
                                <RefreshCw size={13} /> Сбросить демо-данные
                              </button>
                            )}
                          </div>
                          {selectedTenant.access_mode === 'demo' && (
                            <p className="text-[11px] text-amber-600 mt-1.5">
                              Все данные в демо-режиме не являются боевыми и могут быть удалены.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4">
                        <button onClick={() => { setEditForm({}); setShowEdit(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition"><Edit3 size={14} /> Редактировать</button>
                        {selectedTenant.status !== 'suspended' ? (
                          <button onClick={() => handleStatus(selectedTenant.id, 'suspended')} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition"><X size={14} /> Заблокировать</button>
                        ) : (
                          <button onClick={() => handleStatus(selectedTenant.id, 'active')} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100 transition"><Check size={14} /> Разблокировать</button>
                        )}
                        <button onClick={() => handleExtend(selectedTenant.id)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition"><Calendar size={14} /> Продлить</button>
                        <button onClick={() => { setShowNotify(selectedTenant.id); }} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100 transition"><Bell size={14} /> Уведомить</button>
                        <button onClick={() => handleDelete(selectedTenant.id)} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition"><Trash2 size={14} /> Удалить</button>
                      </div>

                      {/* Superadmin actions */}
                      <div className="border-t border-zinc-200 mt-4 pt-4">
                        <h3 className="font-bold text-sm text-zinc-700 mb-3">Действия суперадминистратора</h3>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={handleImpersonate} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-100 transition"><LogIn size={14} /> Войти как администратор</button>
                          <button onClick={handleResetPassword} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition"><Key size={14} /> Сбросить пароль</button>
                        </div>

                        {impersonationResult && (
                          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2"><LogIn size={15} /> Токен имперсонации</div>
                            <div className="bg-white border border-amber-300 rounded-lg p-2 text-xs font-mono break-all text-zinc-700 mb-2">{impersonationResult.token}</div>
                            <button onClick={() => navigator.clipboard.writeText(impersonationResult.token)} className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900"><Copy size={13} /> Скопировать токен</button>
                          </div>
                        )}

                        {passwordResult && (
                          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-red-800 mb-2"><Key size={15} /> Новый временный пароль</div>
                            <div className="bg-white border border-red-300 rounded-lg p-2 text-sm font-mono font-bold text-red-700 mb-2">{passwordResult.temp_password}</div>
                            <p className="text-xs text-red-600">Пароль был сброшен. Передайте его администратору ресторана.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Staff */}
              {activeTab === 'staff' && (
                <div>
                  <p className="text-sm text-zinc-500 mb-3">Сотрудники ресторана {tenantStaff.length}</p>
                  {tenantStaff.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-8">Нет сотрудников</p>
                  ) : (
                    <div className="space-y-2">
                      {tenantStaff.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between bg-zinc-50 rounded-xl px-4 py-3">
                          <div>
                            <div className="font-medium text-sm text-zinc-900">{s.first_name || s.username}</div>
                            <div className="text-xs text-zinc-500">{s.username} · {s.role}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {s.is_active ? 'Активен' : 'Заблокирован'}
                            </span>
                            {s.is_active ? (
                              <button onClick={() => handleBlockStaff(s.id)} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Заблокировать</button>
                            ) : (
                              <button onClick={() => handleUnblockStaff(s.id)} className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">Разблокировать</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Лимиты (role-based quotas) */}
              {activeTab === 'apps' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-zinc-500">Лимиты сотрудников по ролям</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowAppSettingsTemplatePicker(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded-lg text-sm hover:bg-zinc-200">
                        <Layers size={14} /> Шаблоны
                      </button>
                    </div>
                  </div>

                  {appSettingsError && (
                    <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-3">{appSettingsError}</div>
                  )}

                  {appSettingsLoading ? (
                    <div className="text-center py-8 text-zinc-400">Загрузка...</div>
                  ) : appSettings ? (
                    <div className="space-y-3">
                      {/* Template picker popup */}
                      {showAppSettingsTemplatePicker && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-sm text-blue-800">Выберите шаблон лимитов</h4>
                            <button onClick={() => setShowAppSettingsTemplatePicker(false)} className="text-blue-500 hover:text-blue-700"><X size={16} /></button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {appSettingsTemplates.map(t => (
                              <button key={t.id} onClick={() => handleApplyAppTemplate(t)}
                                className="bg-white border border-blue-200 rounded-xl p-3 text-left hover:shadow-sm transition">
                                <div className="font-medium text-sm text-zinc-900">{t.name}</div>
                                <div className="text-xs text-zinc-500 mt-1">{t.description}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {[
                        { key: 'admin', label: 'Администратор' },
                        { key: 'waiter', label: 'Официант' },
                        { key: 'chef', label: 'Повар' },
                        { key: 'kitchen', label: 'Кухня' },
                        { key: 'courier', label: 'Курьер' },
                        { key: 'manager', label: 'Менеджер' },
                        { key: 'stock_manager', label: 'Кладовщик' },
                        { key: 'guest', label: 'Гости (регистрация)' },
                      ].map(({ key, label }) => {
                        const val = appSettings[key] !== undefined ? appSettings[key] : -1;
                        return (
                          <div key={key} className="bg-white border border-zinc-200 rounded-xl px-4 py-3 flex items-center justify-between">
                            <div className="font-medium text-sm text-zinc-900">{label}</div>
                            <div className="flex items-center gap-2">
                              <input type="number" value={val < 0 ? '' : val}
                                onChange={e => handleAppLimitChange(key, e.target.value)}
                                placeholder="Безлимит"
                                className="w-20 px-2 py-1 border border-zinc-300 rounded-lg text-sm text-center" />
                              <span className="text-[11px] text-zinc-400">(пусто = безлимит, 0 = отключено)</span>
                            </div>
                          </div>
                        );
                      })}

                      <button onClick={handleSaveAppSettings}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition text-sm">
                        Сохранить лимиты
                      </button>
                    </div>
                  ) : (
                    <p className="text-center py-8 text-zinc-400">Не удалось загрузить лимиты</p>
                  )}

                  {/* Limit warning confirmation dialog */}
                  {showLimitConfirm && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowLimitConfirm(false); setPendingAppSettingsSave(null); }}>
                      <div className="bg-white rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-3 text-amber-600">
                          <AlertCircle size={20} />
                          <h3 className="font-bold text-zinc-900">Внимание! Превышение лимитов</h3>
                        </div>
                        <div className="space-y-2 mb-4">
                          {limitWarnings.map((w, i) => (
                            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                              <p className="font-medium text-amber-800">{w.label || w.role}</p>
                              <p className="text-amber-700 mt-1">
                                Используется <strong>{w.current_count}</strong> пользователей,
                                новый лимит <strong>{w.proposed_limit}</strong>.
                                {' '}Превышение: <strong>{w.excess}</strong>.
                              </p>
                              <p className="text-xs text-amber-600 mt-1">
                                При уменьшении лимита лишние пользователи останутся активными, но добавлять новых будет нельзя.
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-zinc-600 mb-4">Продолжить сохранение лимитов?</p>
                        <div className="flex gap-2">
                          <button onClick={handleConfirmLimitReduce}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-xl text-sm">
                            Да, продолжить
                          </button>
                          <button onClick={() => { setShowLimitConfirm(false); setPendingAppSettingsSave(null); }}
                            className="flex-1 border border-zinc-300 text-zinc-700 font-medium py-2.5 rounded-xl text-sm hover:bg-zinc-50">
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Branches */}
              {activeTab === 'branches' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-zinc-500">Точки ресторана (филиалы) {tenantBranches.length}</p>
                    <button onClick={() => { setBranchForm({ name: '', address: '', phone: '' }); setEditBranchId(null); setShowBranchForm(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-sm hover:bg-zinc-800"><Plus size={14} /> Добавить точку</button>
                  </div>

                  {showBranchForm && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-4">
                      <h4 className="font-medium text-sm mb-3">{editBranchId ? 'Редактировать точку' : 'Новая точка'}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                        <input value={branchForm.name} onChange={e => setBranchForm(p => ({...p, name: e.target.value}))} placeholder="Название *" className="px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        <input value={branchForm.address} onChange={e => setBranchForm(p => ({...p, address: e.target.value}))} placeholder="Адрес" className="px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                        <input value={branchForm.phone} onChange={e => setBranchForm(p => ({...p, phone: e.target.value}))} placeholder="Телефон" className="px-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveBranch} className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-sm">Сохранить</button>
                        <button onClick={() => setShowBranchForm(false)} className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm">Отмена</button>
                      </div>
                    </div>
                  )}

                  {tenantBranches.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-8">Нет точек</p>
                  ) : (
                    <div className="space-y-2">
                      {tenantBranches.map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between bg-zinc-50 rounded-xl px-4 py-3">
                          <div>
                            <div className="font-medium text-sm text-zinc-900">{b.name}</div>
                            <div className="text-xs text-zinc-500">{b.address || '—'} {b.phone ? '· ' + b.phone : ''}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setBranchForm({ name: b.name, address: b.address || '', phone: b.phone || '' }); setEditBranchId(b.id); setShowBranchForm(true); }}
                              className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">Ред.</button>
                            <button onClick={() => handleDeleteBranch(b.id)} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Уд.</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Statistics */}
              {activeTab === 'stats' && (
                <div>
                  <p className="text-sm text-zinc-500 mb-4">Статистика ресторана</p>
                  {tenantStats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-zinc-900">{tenantStats.staff_count || 0}</div>
                        <div className="text-xs text-zinc-500">Сотрудников</div>
                      </div>
                      <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-zinc-900">{tenantStats.orders_count || 0}</div>
                        <div className="text-xs text-zinc-500">Заказов</div>
                      </div>
                      <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{(tenantStats.monthly_revenue || 0).toLocaleString('ru-RU')} ₽</div>
                        <div className="text-xs text-zinc-500">Выручка за месяц</div>
                      </div>
                      <div className="bg-white border border-zinc-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">{(tenantStats.total_paid || 0).toLocaleString('ru-RU')} ₽</div>
                        <div className="text-xs text-zinc-500">Оплачено всего</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 text-center py-8">Загрузка статистики...</p>
                  )}
                </div>
              )}

              {/* TAB: Logs */}
              {activeTab === 'logs' && (
                <div>
                  <p className="text-sm text-zinc-500 mb-3">Действия суперадминистратора</p>
                  {tenantLogs.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-8">Нет записей</p>
                  ) : (
                    <div className="space-y-1">
                      {tenantLogs.map((l: any) => (
                        <div key={l.id} className="flex items-start gap-3 bg-zinc-50 rounded-lg px-3 py-2 text-xs">
                          <span className="text-zinc-400 shrink-0 font-mono">{l.created_at ? new Date(l.created_at).toLocaleString('ru-RU') : ''}</span>
                          <span className="font-medium text-zinc-700 shrink-0">{l.action}</span>
                          <span className="text-zinc-500 truncate">{l.admin_email || ''}</span>
                          {l.details && <span className="text-zinc-400 truncate">{l.details}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
