import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Save, Key, Database, Eye, EyeOff, Globe, MessageCircle, Building2, Shield, Smartphone, QrCode, Store, Truck, Warehouse, Users, Gift, ChefHat, Settings2 } from 'lucide-react';


const SETTINGS_LABELS: Record<string, string> = {
  app_name: 'Название приложения',
  currency: 'Валюта',
  default_delivery_fee: 'Комиссия доставки',
  min_order_amount: 'Мин. сумма заказа',
  max_check: 'Макс. чек',
  min_return: 'Мин. возврат',
  min_delivery_amount: 'Мин. сумма доставки',
  free_delivery_from: 'Бесплатная доставка от',
  delivery_cost: 'Стоимость доставки',
  enable_delivery: 'Доставка',
  enable_pickup: 'Самовывоз',
  working_time_start: 'Начало работы',
  working_time_end: 'Окончание работы',
  timezone: 'Часовой пояс',
  logo_path: 'Путь к логотипу',
  phone: 'Телефон',
  address: 'Адрес',
  confirmation_phrase: 'Фраза подтверждения',
  tips_message: 'Сообщение о чаевых',
  tip_1: 'Чай 1 (%)',
  tip_2: 'Чай 2 (%)',
  tip_3: 'Чай 3 (%)',
  tax_type: 'Тип налога',
  site_mode: 'Режим сайта',
  main_store: 'Основной магазин',
  shipment_template: 'Шаблон отгрузки',
  pin_code_length: 'Длина PIN-кода',
  access_mode: 'Режим доступа',
  return_days: 'Дней на возврат',
  return_to_warehouse: 'Возврат на склад',
  allow_negative_balance: 'Отрицательный остаток',
  enable_document_confirmation: 'Подтверждение документов',
  enable_uniqueness_control: 'Контроль уникальности',
  enable_nested_tech_card_write_off: 'Списание по вложенным тех. картам',
  disable_add_items_via_receipt: 'Запрет добавления через приход',
  enable_item_comments: 'Комментарии к блюдам',
  enable_qr_card: 'QR-карта',
  request_birthday: 'Запрашивать день рождения',
  request_email: 'Запрашивать email',
  wallet_enabled: 'Кошелёк',
  start_points_after_verification: 'Начислять баллы после верификации',
  auto_publish_reviews: 'Автопубликация отзывов',
  allow_orders_without_auth: 'Заказы без авторизации',
  allow_registered_without_auth: 'Регистрация без авторизации',
  show_available_quantity_online: 'Показывать остатки онлайн',
  limit_points_for_delivery: 'Лимит баллов для доставки',
  simplified_sms_registration: 'Упрощённая SMS-регистрация',
  initial_points: 'Начальные баллы',
  default_reservation_time: 'Время брони (сек)',
  auto_burn_points: 'Автосгорание баллов',
  burn_days: 'Дней до сгорания',
  update_burn_timer: 'Обновлять таймер сгорания',
  money_points_rate: 'Курс начисления баллов',
  loyalty_program_name: 'Название программы',
  loyalty_min_bonus_payment: 'Мин. оплата бонусами',
  loyalty_max_bonus_payment: 'Макс. оплата бонусами',
  loyalty_bonus_accrual_rate: 'Курс начисления бонусов',
  loyalty_bonus_write_off_rate: 'Курс списания бонусов',
  enable_booking: 'Бронирование',
  enable_preorder: 'Предзаказ',
  multi_branch: 'Мультифилиальность',
  staff_schedule: 'График сотрудников',
  enable_order_delay: 'Отложенные заказы',
  auto_delivery_assign: 'Автоназначение доставки',
  enable_split_payment: 'Разделение оплаты',
  enable_cashback: 'Кэшбэк',
};

interface SettingTab {
  id: string;
  label: string;
  icon: any;
  keys: string[];
}

const TABS: SettingTab[] = [
  { id: 'general', label: 'Общие', icon: Store, keys: ['app_name', 'currency', 'working_time_start', 'working_time_end', 'timezone', 'phone', 'address', 'confirmation_phrase', 'logo_path', 'shipment_template', 'pin_code_length', 'site_mode', 'access_mode'] },
  { id: 'orders', label: 'Заказы', icon: Truck, keys: ['min_order_amount', 'max_check', 'min_return', 'min_delivery_amount', 'free_delivery_from', 'delivery_cost', 'default_delivery_fee', 'enable_delivery', 'enable_pickup', 'enable_order_delay', 'auto_delivery_assign', 'enable_split_payment'] },
  { id: 'warehouse', label: 'Склад', icon: Warehouse, keys: ['allow_negative_balance', 'enable_document_confirmation', 'enable_uniqueness_control', 'enable_nested_tech_card_write_off', 'disable_add_items_via_receipt', 'return_days', 'return_to_warehouse', 'tax_type', 'main_store'] },
  { id: 'clients', label: 'Клиенты', icon: Users, keys: ['enable_item_comments', 'enable_qr_card', 'request_birthday', 'request_email', 'wallet_enabled', 'start_points_after_verification', 'auto_publish_reviews', 'allow_orders_without_auth', 'allow_registered_without_auth', 'show_available_quantity_online', 'limit_points_for_delivery', 'simplified_sms_registration', 'enable_booking', 'enable_preorder'] },
  { id: 'loyalty', label: 'Лояльность', icon: Gift, keys: ['loyalty_program_name', 'initial_points', 'default_reservation_time', 'auto_burn_points', 'burn_days', 'update_burn_timer', 'money_points_rate', 'loyalty_min_bonus_payment', 'loyalty_max_bonus_payment', 'loyalty_bonus_accrual_rate', 'loyalty_bonus_write_off_rate', 'enable_cashback', 'multi_branch', 'staff_schedule'] },
  { id: 'tips', label: 'Чаевые', icon: ChefHat, keys: ['tips_message', 'tip_1', 'tip_2', 'tip_3'] },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow ${value ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      if (settings.app_name) document.title = settings.app_name;
      window.dispatchEvent(new CustomEvent('app-name-changed', { detail: settings.app_name }));
    } catch (e: any) { addToast(e.message, 'error'); } finally { setSaving(false); }
  };

  const updateSetting = (key: string, value: any) => setSettings((prev: any) => ({ ...prev, [key]: value }));

  const isBool = (key: string) => key.startsWith('enable_') || key.startsWith('allow_') || key.startsWith('request_') || key.startsWith('auto_') || key.startsWith('start_') || key === 'wallet_enabled' || key === 'multi_branch' || key === 'staff_schedule' || key === 'auto_publish_reviews' || key === 'show_available_quantity_online' || key === 'limit_points_for_delivery' || key === 'simplified_sms_registration' || key === 'update_burn_timer' || key === 'disable_add_items_via_receipt';

  const changePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) return addToast('Пароли не совпадают', 'warning');
    if (pwForm.new_password.length < 4) return addToast('Пароль должен быть минимум 4 символа', 'warning');
    try {
      await api.changePassword(pwForm.old_password, pwForm.new_password);addToast('Пароль изменён', 'success');
      setPwForm({ old_password: '', new_password: '', confirm: '' });
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const createBackup = async () => {
    try {
      await api.createBackup();
      setBackupMsg('Бэкап создан');
    } catch (e: any) { setBackupMsg('Ошибка: ' + e.message); }
  };

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Настройки</h1>
        <button onClick={saveSettings} disabled={saving} className="bg-blue-500 hover:bg-blue-600 active:scale-[0.97] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm">
          <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          {currentTab && <currentTab.icon size={22} className="text-blue-500" />}
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{currentTab?.label || 'Настройки'}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {currentTab?.keys.filter(k => settings[k] !== undefined).map(key => {
            const val = settings[key];
            const label = SETTINGS_LABELS[key] || key.replace(/_/g, ' ');
            return (
              <div key={key} className="flex items-center justify-between py-2 px-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
                {isBool(key) ? (
                  <Toggle value={!!val} onChange={v => updateSetting(key, v)} />
                ) : (
                  <input
                    value={String(val ?? '')}
                    onChange={e => updateSetting(key, e.target.value)}
                    className="w-48 text-right border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-5 flex items-center gap-2"><Globe size={20} className="text-blue-500" /> Интеграции</h3>
        <IntegrationsSection />
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Key size={18} className="text-amber-500" /> Смена пароля</h3>
          <div className="space-y-3">
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={pwForm.old_password} onChange={e => setPwForm({...pwForm, old_password: e.target.value})} placeholder="Текущий пароль" className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 pr-10" />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <input type="password" value={pwForm.new_password} onChange={e => setPwForm({...pwForm, new_password: e.target.value})} placeholder="Новый пароль" className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} placeholder="Подтвердите пароль" className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <button onClick={changePassword} className="w-full bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-[0.97]">Изменить пароль</button>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Smartphone size={18} className="text-blue-500" /> 2FA</h3>
          <TwoFactorSection />
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Database size={18} className="text-green-500" /> Резервное копирование</h3>
          <p className="text-xs text-zinc-500 mb-4">Создать резервную копию базы данных</p>
          <button onClick={createBackup} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"><Database size={18} /> Создать бэкап</button>
          {backupMsg && <p className="text-xs text-center mt-3 text-zinc-500">{backupMsg}</p>}
        </div>
      </div>
    </div>
  );
}

function TwoFactorSection() {
  const [enabled, setEnabled] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'done'>('idle');

  useEffect(() => {
    const staffId = 1;
    api.get(`/api/auth/2fa/status?staffId=${staffId}`).then((r: any) => { if (r?.enabled) setEnabled(true); }).catch(() => {});
  }, []);

  const setup2fa = async () => {
    try {
      const r = await api.post('/api/auth/2fa/setup', { staffId: 1 });
      setQrCode(r.qrCode);
      setSecret(r.secret);
      setStep('verify');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const verify2fa = async () => {
    try {
      const r = await api.post('/api/auth/2fa/verify', { staffId: 1, token });
      if (r.success) { setEnabled(true); setStep('done'); addToast('2FA включена', 'success'); }
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const disable2fa = async () => {
    try {
      await api.post('/api/auth/2fa/disable', { staffId: 1 });
      setEnabled(false);
      setStep('idle');
      setQrCode('');
      setSecret('');
      setToken('');
      addToast('2FA отключена', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  if (enabled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
          <Shield size={18} /> 2FA активна
        </div>
        <button onClick={disable2fa} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-[0.97]">Отключить 2FA</button>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-zinc-500">Отсканируйте QR-код в приложении аутентификаторе и введите код:</p>
        {qrCode && <img src={qrCode} alt="QR" className="w-36 h-36 mx-auto" />}
        {secret && <p className="text-xs text-center text-zinc-400 break-all font-mono">Secret: {secret}</p>}
        <input value={token} onChange={e => setToken(e.target.value)} placeholder="6-значный код" maxLength={6} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        <button onClick={verify2fa} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-[0.97]">Подтвердить</button>
        <button onClick={() => { setStep('idle'); setToken(''); }} className="w-full text-zinc-400 hover:text-zinc-600 text-sm py-1">Назад</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">Защитите аккаунт дополнительным фактором</p>
      <button onClick={setup2fa} className="w-full bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2">
        <QrCode size={16} /> Настроить 2FA
      </button>
    </div>
  );
}

function IntegrationsSection() {
  const [cfgs, setCfgs] = useState<Record<string, any>>({});
  useEffect(() => {
    Promise.all(['1c', 'egais', 'telegram'].map(t => api.getIntegration(t).then(r => [t, r] as const)))
      .then(entries => setCfgs(Object.fromEntries(entries))).catch(() => {});
  }, []);
  const update = async (type: string) => {
    try {
      await api.updateIntegration(type, { settings: cfgs[type]?.settings || {}, isEnabled: cfgs[type]?.is_enabled || false });addToast('Сохранено', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };
  const ints = [
    { type: '1c', icon: Building2, label: '1С: Бухгалтерия', desc: 'Экспорт товаров', field: { key: 'api_url', placeholder: 'URL API' } },
    { type: 'egais', icon: Database, label: 'ЕГАИС', desc: 'Алкогольная продукция', field: { key: 'fsrar_id', placeholder: 'ID ФСРАР' } },
    { type: 'telegram', icon: MessageCircle, label: 'Telegram', desc: 'Уведомления', field: { key: 'bot_token', placeholder: 'Токен бота' } },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {ints.map(({ type, icon: Icon, label, desc, field }) => {
        const cfg = cfgs[type];
        if (!cfg) return null;
        const s = cfg.settings || {};
        const set = (key: string, val: string) => setCfgs({...cfgs, [type]: {...cfg, settings: {...s, [key]: val}}});
        return (
          <div key={type} className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon size={22} className="text-zinc-400" />
                <div>
                  <p className="font-medium text-sm text-zinc-700 dark:text-zinc-300">{label}</p>
                  <p className="text-[10px] text-zinc-400">{desc}</p>
                </div>
              </div>
              <button onClick={() => setCfgs({...cfgs, [type]: {...cfg, is_enabled: !cfg.is_enabled}})}
                className={`w-10 h-6 rounded-full transition-colors relative ${cfg.is_enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow ${cfg.is_enabled ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            {cfg.is_enabled && (
              <>
                <input value={s[field.key] || ''} onChange={e => set(field.key, e.target.value)} placeholder={field.placeholder} className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                <button onClick={() => update(type)} className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium py-2 rounded-lg transition-all active:scale-[0.97]">Сохранить</button>
              </>
            )}
          </div>
        );
      })}
      <button onClick={async () => { try { const r = await api.exportTo1C(); addToast(`Экспортировано ${r.items?.length || 0} товаров`, 'success'); } catch (e: any) { addToast(e.message, 'error'); } }}
        className="col-span-full mt-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.97] transition-all">
        Экспорт товаров в 1С
      </button>
    </div>
  );
}
