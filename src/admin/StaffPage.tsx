import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { UsersRound, Plus, X, Edit3, Trash2, RefreshCw, Phone, Mail, Shield, UserCircle } from 'lucide-react';

const ROLES: { value: string; label: string }[] = [
  { value: 'admin', label: 'Администратор' },
  { value: 'waiter', label: 'Официант' },
  { value: 'chef', label: 'Повар' },
  { value: 'kitchen', label: 'Кухня' },
  { value: 'courier', label: 'Курьер' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'stock_manager', label: 'Кладовщик' },
];

const SECTIONS = [
  'dashboard', 'orders', 'kitchen', 'menu', 'tech_cards', 'bookings',
  'inventory', 'pickup_points', 'delivery', 'finance', 'marketing',
  'clients', 'reviews', 'staff', 'settings', 'audit',
];

const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Дашборд', orders: 'Заказы', kitchen: 'Кухня', menu: 'Меню',
  tech_cards: 'Тех. карты', bookings: 'Бронирования', inventory: 'Склад',
  pickup_points: 'Точки самовывоза', delivery: 'Доставка', finance: 'Финансы',
  marketing: 'Маркетинг', clients: 'Клиенты', reviews: 'Отзывы',
  staff: 'Персонал', settings: 'Настройки', audit: 'Безопасность',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  waiter: 'Официанты',
  chef: 'Повара',
  kitchen: 'Кухня',
  courier: 'Курьеры',
  manager: 'Менеджеры',
  stock_manager: 'Кладовщики',
  guest: 'Гости',
};

export default function StaffPage() {
  const { t } = useTranslation();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', role: 'courier', phone: '', email: '', password: '', username: '', salary_types: [] as string[], salary_values: {} as Record<string, number> });
  const [permissions, setPermissions] = useState<Record<string, { view: boolean; edit: boolean }>>({});
  const [limits, setLimits] = useState<Record<string, { limit: number; current: number }> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getStaff();
      setStaff(data);
      // Also load tenant limits
      api.getTenantLimits().then(l => setLimits(l.usage)).catch(() => {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getRoleLimitStatus = (role: string): { limited: boolean; current: number; limit: number } | null => {
    if (!limits || !limits[role]) return null;
    const lim = limits[role];
    if (lim.limit < 0) return null;
    return { limited: lim.current >= lim.limit, current: lim.current, limit: lim.limit };
  };

  const isAddDisabled = (): boolean => {
    const status = getRoleLimitStatus(form.role);
    return status?.limited === true;
  };

  const getAddButtonTitle = (): string => {
    const status = getRoleLimitStatus(form.role);
    if (!status) return '';
    const roleLabel = ROLE_LABELS[form.role] || form.role;
    if (status.limit === 0) return `Роль "${roleLabel}" отключена для этого ресторана`;
    if (status.limited) return `Достигнут лимит сотрудников для роли "${roleLabel}" (${status.current} из ${status.limit}). Обратитесь к суперадминистратору для увеличения лимита.`;
    return '';
  };

  useEffect(() => { load(); }, []);

  const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm({...form, password: pwd});
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ first_name: '', last_name: '', role: 'courier', phone: '', email: '', password: '', username: '', salary_types: [], salary_values: {} });
    setShowForm(true);
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    const st = Array.isArray(s.salaryType) ? s.salaryType : (s.salaryType ? [s.salaryType] : []);
    const sv = (s.salaryValue && typeof s.salaryValue === 'object') ? s.salaryValue : { per_order: 0, salary: 0, per_km: 0 };
    setForm({ first_name: s.firstName, last_name: s.lastName || '', role: s.role, phone: s.phone || '', email: s.email || '', password: '', username: s.username || '', salary_types: st, salary_values: sv });
    setShowForm(true);
    loadPermissions(s.id);
  };

  const loadPermissions = async (id: number) => {
    try {
      const perms = await api.getStaffPermissions(id);
      const map: Record<string, { view: boolean; edit: boolean }> = {};
      SECTIONS.forEach(s => { map[s] = { view: true, edit: false }; });
      perms.forEach((p: any) => {
        if (map[p.section]) map[p.section] = { view: p.canView, edit: p.canEdit };
      });
      setPermissions(map);
    } catch { setPermissions({}); }
  };

  const save = async () => {
    try {
      if (['courier', 'waiter', 'chef'].includes(form.role) && !form.username && !editId) return addToast('Логин обязателен для этой роли', 'warning');
    const tenantId = (() => { try { const u = JSON.parse(localStorage.getItem('foodchain_admin_user') || '{}'); return u.tenantId ?? u.tenant_id ?? null; } catch { return null; } })();
    const body: any = {
      first_name: form.first_name, last_name: form.last_name, role: form.role,
      phone: form.phone, email: form.email, username: form.username,
      tenant_id: tenantId,
    };
    if (editId) {
      if (form.password) body.password = form.password;
      if (['courier', 'waiter', 'chef'].includes(form.role)) {
        body.salary_type = form.salary_types;
        body.salary_value = form.salary_values;
      }
      await api.updateStaff(editId, body);
      const permArr = Object.entries(permissions).map(([section, p]) => ({ section, can_view: p.view, can_edit: p.edit }));
      await api.updateStaffPermissions(editId, permArr);
    } else {
      body.salary_type = ['courier', 'waiter', 'chef'].includes(form.role) ? form.salary_types : null;
      body.salary_value = ['courier', 'waiter', 'chef'].includes(form.role) ? form.salary_values : null;
      if (form.password) body.password = form.password;
      await api.createStaff(body);
    }
      setShowForm(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteStaff(id);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('sidebar_staff')}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t('staff_count', { active: staff.filter(s => s.isActive).length, total: staff.length })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 active:scale-[0.97] transition-all"><RefreshCw size={18} /></button>
          <button onClick={openAdd} disabled={isAddDisabled()}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${isAddDisabled() ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.97]'}`}
            title={getAddButtonTitle()}><Plus size={18} /> {t('staff_add')}</button>
        </div>
      </div>

      {/* Limit usage bars */}
      {limits && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(ROLE_LABELS).map(([roleKey, label]) => {
            const lim = limits[roleKey];
            if (!lim) return null;
            const limit = lim.limit;
            const current = lim.current;
            const pct = limit > 0 ? Math.round((current / limit) * 100) : 0;
            const isOver = limit >= 0 && current >= limit;
            if (limit < 0 && current === 0) return null;
            return (
              <div key={roleKey} className={`bg-white dark:bg-zinc-900 border rounded-xl px-3 py-2 ${isOver ? 'border-red-300 dark:border-red-800' : 'border-zinc-100 dark:border-zinc-800'}`}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-500">{label}</span>
                  <span className={`font-medium ${isOver ? 'text-red-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {current}{limit >= 0 ? ` / ${limit}` : limit < 0 ? '' : ''}
                  </span>
                </div>
                {limit > 0 && (
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${isOver ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct || 0, 100)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-400">{t('staff_loading')}</div>
      ) : staff.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
          <UsersRound size={48} className="mx-auto text-zinc-300 mb-4" />
          <p className="text-zinc-500">{t('staff_empty')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {staff.map(s => (
            <div key={s.id} className={`bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border ${s.isActive ? 'border-zinc-100 dark:border-zinc-800' : 'border-red-200 dark:border-red-900/50 opacity-70'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br ${s.role === 'admin' ? 'from-red-500 to-pink-500' : s.role === 'waiter' ? 'from-orange-500 to-red-500' : s.role === 'chef' ? 'from-green-500 to-emerald-500' : s.role === 'kitchen' ? 'from-orange-500 to-amber-500' : s.role === 'courier' ? 'from-green-500 to-emerald-500' : s.role === 'manager' ? 'from-blue-500 to-indigo-500' : 'from-purple-500 to-violet-500'}`}>
                    {(s.firstName || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-white">{s.firstName} {s.lastName || ''}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{ROLES.find(r => r.value === s.role)?.label || s.role}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                      {s.phone && <span className="flex items-center gap-1"><Phone size={12} /> {s.phone}</span>}
                      {s.email && <span className="flex items-center gap-1"><Mail size={12} /> {s.email}</span>}
                      {s.username && <span className="flex items-center gap-1 text-zinc-400">@{s.username}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-1">
                      {s.onlineToday !== undefined && (
                        <span className={`flex items-center gap-1 ${s.isOnline ? 'text-green-500' : 'text-zinc-400'}`}>
                          {s.isOnline ? `🟢 ${t('staff_online')}` : `⭕ ${t('staff_offline')}`}
                          <span className="text-zinc-400">({Math.floor(s.onlineToday / 60)}ч {s.onlineToday % 60}м {t('staff_today')})</span>
                        </span>
                      )}
                      {s.salaryType && Array.isArray(s.salaryType) && s.salaryType.map((t: string) => {
                        const val = s.salaryValue?.[t];
                        if (t === 'salary') return <span key={t} className="text-zinc-400">{(val || 0).toLocaleString()}₽/мес</span>;
                        if (t === 'per_order') return <span key={t} className="text-zinc-400">{(val || 0).toLocaleString()}₽/заказ</span>;
                        if (t === 'per_km') return <span key={t} className="text-zinc-400">{(val || 0).toLocaleString()}₽/км</span>;
                        return null;
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(s)} className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg active:scale-[0.97] transition-all"><Edit3 size={16} /></button>
                  <button onClick={() => remove(s.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg active:scale-[0.97] transition-all"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{editId ? t('staff_edit_title') : t('staff_new_title')} {t('staff_employee')}</h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500">Имя</label>
                  <input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Фамилия</label>
                  <input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Роль</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500">Телефон</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Email</label>
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                </div>
              </div>
              {['courier', 'waiter', 'chef'].includes(form.role) && (
                <>
                  <div>
                    <label className="text-xs font-medium text-zinc-500">Логин (для входа в приложение)</label>
                    <input value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500">{editId ? 'Новый пароль' : 'Пароль'}</label>
                    <div className="flex gap-2 mt-1">
                      <input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                        className="flex-1 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                      <button type="button" onClick={genPassword} className="px-3 py-2.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-600 active:scale-[0.97]">Сгенерировать</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-2 block">Тип зарплаты</label>
                    <div className="space-y-3">
                      {[
                        { value: 'per_order', label: 'За заказ' },
                        { value: 'hourly', label: 'Почасовой' },
                        { value: 'salary', label: 'Оклад' },
                        { value: 'per_km', label: 'За километраж' },
                      ].map(t => (
                        <div key={t.value} className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.salary_types.includes(t.value)}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...form.salary_types, t.value]
                                  : form.salary_types.filter(v => v !== t.value);
                                setForm({...form, salary_types: next});
                              }}
                              className="rounded border-zinc-300 dark:border-zinc-600 accent-blue-500" />
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{t.label}</span>
                          </label>
                          {form.salary_types.includes(t.value) && (
                            <input type="number" min={0} step={1}
                              value={form.salary_values[t.value] || ''}
                              onChange={e => setForm({...form, salary_values: {...form.salary_values, [t.value]: e.target.value === '' ? 0 : Number(e.target.value)}})}
                              placeholder={t.value === 'per_order' ? '₽/заказ' : t.value === 'hourly' ? '₽/час' : t.value === 'salary' ? '₽/мес' : '₽/км'}
                              className="flex-1 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white max-w-[160px]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {['admin', 'manager', 'stock_manager', 'kitchen', 'barmen'].includes(form.role) && (
                <>
                  <div>
                    <label className="text-xs font-medium text-zinc-500">Логин (для входа)</label>
                    <input value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500">{editId ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}</label>
                    <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                      className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
                  </div>
                </>
              )}

              {editId && (
                <div>
                  <label className="text-xs font-medium text-zinc-500 mb-2 block">Права доступа</label>
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
                    {SECTIONS.map(s => (
                      <div key={s} className="flex items-center justify-between py-1">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{SECTION_LABELS[s] || s}</span>
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-zinc-500 flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={permissions[s]?.view ?? true}
                              onChange={() => setPermissions(prev => ({ ...prev, [s]: { view: !(prev[s]?.view ?? true), edit: prev[s]?.edit ?? false } }))}
                              className="accent-blue-500" /> Просмотр
                          </label>
                          <label className="text-xs text-zinc-500 flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={permissions[s]?.edit ?? false}
                              onChange={() => setPermissions(prev => ({ ...prev, [s]: { view: prev[s]?.view ?? true, edit: !(prev[s]?.edit ?? false) } }))}
                              className="accent-blue-500" /> Редактирование
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={save} disabled={isAddDisabled()}
                className={`w-full font-bold py-3 rounded-xl text-sm transition-all ${isAddDisabled() ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.97]'}`}
                title={getAddButtonTitle()}>
                {editId ? t('staff_save') : t('staff_create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
