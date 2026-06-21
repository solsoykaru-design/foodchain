import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import { addToast } from '../ToastContext';
import {
  Palette, Save, RotateCcw, Upload, Eye, X, Check, AlertCircle,
  Smartphone, Image as ImageIcon, Megaphone, Truck, Clock, Cog,
  Globe, HeartHandshake, CreditCard, Plus, Trash2, Edit3, GripVertical,
  RefreshCw, Search, FolderTree, Menu,
} from 'lucide-react';

const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const FONTS = ['Inter', 'Roboto', 'Montserrat', 'Open Sans', 'Playfair Display', 'Lato', 'Raleway', 'Nunito'];
const CHANNELS = [
  { key: 'showOnSite', label: 'Сайт' },
  { key: 'showOnApp', label: 'Приложение' },
  { key: 'showOnKiosk', label: 'Киоск' },
  { key: 'showOnWaiter', label: 'Официант' },
  { key: 'showOnAggregators', label: 'Агрегаторы' },
];

const TABS = [
  { id: 'appearance', label: 'Внешний вид', icon: Palette },
  { id: 'banners', label: 'Баннеры и слайды', icon: ImageIcon },
  { id: 'promotions', label: 'Акции', icon: Megaphone },
  { id: 'delivery', label: 'Доставка', icon: Truck },
  { id: 'working_hours', label: 'Режим работы', icon: Clock },
  { id: 'modifiers', label: 'Модификаторы', icon: Cog },
  { id: 'visibility', label: 'Видимость каналов', icon: Globe },
  { id: 'tips', label: 'Чаевые и сборы', icon: HeartHandshake },
  { id: 'payment', label: 'Оплата', icon: CreditCard },
];

export default function AppManagementPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('appearance');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [settings, setSettings] = useState<any>({
    delivery: { free_delivery_enabled: false, free_delivery_from: 0, estimated_time: 60, pickup_enabled: true, pickup_points: [] },
    working_status: 'open', auto_switch: true,
    tips_enabled: true, tips_percent: 10,
    service_fee_enabled: false, service_fee_type: 'percent', service_fee_value: 0, service_fee_description: '',
    payment_methods: { cash: true, card_courier: true, online: true, in_place: true },
  });
  const [branding, setBranding] = useState<any>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [workingHours, setWorkingHours] = useState<any[]>([]);
  const [specialDays, setSpecialDays] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [modifiers, setModifiers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, b, br, bn, p, wh, sd, mg, md, cat, dz] = await Promise.all([
        api.getAppSettings().catch(() => ({ settings: null })),
        api.getBranding().catch(() => null),
        Promise.resolve(null),
        api.getAppBanners().catch(() => []),
        api.getAppPromotions().catch(() => []),
        api.getAppWorkingHours().catch(() => ({ workingHours: [], specialDays: [] })),
        Promise.resolve(null),
        api.getAppModifiers().catch(() => ({ groups: [], modifiers: [] })),
        Promise.resolve(null),
        api.getAppVisibility().catch(() => []),
        api.getDeliveryZones().catch(() => []),
      ]);
      if (s?.settings) setSettings(s.settings);
      if (b?.branding) setBranding(b.branding);
      else setBranding({
        common: {
          logoUrl: '', restaurantName: '', iconUrl: '', faviconUrl: '',
          primaryColor: '#FF5722', secondaryColor: '#FFC107',
          textColor: '#1F2937', secondaryTextColor: '#6B7280',
          backgroundColor: '#F9FAFB', cardColor: '#FFFFFF',
          successColor: '#10B981', errorColor: '#EF4444', warningColor: '#F59E0B',
          fontFamily: 'Inter', headingSize: 'medium', bodySize: 'medium',
          buttonRadius: 'medium', cardStyle: 'shadow', shadow: 'medium',
          loginBackground: '', homeBackground: '', emptyStateImage: '',
        },
        site: {
          title: '', slogan: '', bannerUrl: '', aboutText: '',
          phone: '', address: '', email: '',
          social: { instagram: '', vk: '', telegram: '' },
          browserTitle: '', metaDescription: '',
        },
        apps: { guest: {}, courier: {}, waiter: {}, kitchen: {} },
      });
      if (bn) setBanners(bn);
      if (p) setPromotions(p);
      if (wh) { setWorkingHours(wh.workingHours || []); setSpecialDays(wh.specialDays || []); }
      if (mg) { setModifierGroups(mg.groups || []); setModifiers(mg.modifiers || []); }
      if (cat) setCategories(cat);
      if (dz) setDeliveryZones(dz);
      const dishesData = await api.getDishes().catch(() => []);
      setDishes(dishesData);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (branding?.common?.fontFamily) {
      const font = branding.common.fontFamily;
      if (font && font !== 'Inter') {
        const linkId = 'app-font-link';
        const existing = document.getElementById(linkId);
        if (existing) existing.remove();
        const link = document.createElement('link');
        link.id = linkId; link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
        document.head.appendChild(link);
      }
    }
  }, [branding?.common?.fontFamily]);

  const showSuccess = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };
  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(''), 5000); };

  const saveGeneral = async () => {
    setSaving(true);
    try {
      await api.updateAppSettings(settings);
      showSuccess('Настройки сохранены');
    } catch (e: any) { showError(e.message); }
    finally { setSaving(false); }
  };

  const saveBranding = async () => {
    if (!branding) return;
    setSaving(true);
    try {
      await api.saveBranding(branding);
      showSuccess('Настройки внешнего вида сохранены');
    } catch (e: any) { showError(e.message); }
    finally { setSaving(false); }
  };

  const resetAll = async () => {
    if (!confirm('Сбросить все настройки приложения?')) return;
    setSaving(true);
    try {
      const data = await api.resetAppSettings();
      setSettings(data.settings);
      showSuccess('Настройки сброшены');
    } catch (e: any) { showError(e.message); }
    finally { setSaving(false); }
  };

  const updateCommon = (key: string, value: any) => {
    if (!branding) return;
    setBranding((prev: any) => ({ ...prev, common: { ...prev.common, [key]: value } }));
  };

  const fld = "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30";
  const lbl = "text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 block";
  const toggleCls = (on: boolean) =>
    `relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`;
  const toggleKnob = (on: boolean) =>
    `inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${on ? 'translate-x-[18px]' : 'translate-x-[3px]'}`;
  const btnCls = "flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 disabled:opacity-50 active:scale-[0.97] transition-all";
  const btnOutline = "flex items-center gap-2 px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-xl font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 active:scale-[0.97] transition-all";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Управление мобильным приложением</h2>
          <p className="text-sm text-zinc-500 mt-1">Настройка внешнего вида, контента и функционала гостевого приложения</p>
        </div>
        <div className="flex gap-2">
          <button onClick={resetAll} disabled={saving} className={btnOutline}><RotateCcw size={16} /> Сбросить</button>
        </div>
      </div>

      {message && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2.5 text-sm text-green-700 dark:text-green-400 flex items-center gap-2"><Check size={16} /> {message}</div>}
      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700 pb-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-b-0 border-zinc-200 dark:border-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        {activeTab === 'appearance' && <AppearanceTab branding={branding} setBranding={setBranding} updateCommon={updateCommon} save={saveBranding} saving={saving} btnCls={btnCls} btnOutline={btnOutline} fld={fld} lbl={lbl} />}
        {activeTab === 'banners' && <BannersTab banners={banners} setBanners={setBanners} dishes={dishes} categories={categories} promotions={promotions} showSuccess={showSuccess} showError={showError} btnCls={btnCls} btnOutline={btnOutline} fld={fld} lbl={lbl} />}
        {activeTab === 'promotions' && <PromotionsTab promotions={promotions} setPromotions={setPromotions} dishes={dishes} categories={categories} showSuccess={showSuccess} showError={showError} btnCls={btnCls} btnOutline={btnOutline} fld={fld} lbl={lbl} />}
        {activeTab === 'delivery' && <DeliveryTab settings={settings} setSettings={setSettings} deliveryZones={deliveryZones} save={saveGeneral} saving={saving} btnCls={btnCls} fld={fld} lbl={lbl} />}
        {activeTab === 'working_hours' && <WorkingHoursTab settings={settings} setSettings={setSettings} workingHours={workingHours} setWorkingHours={setWorkingHours} specialDays={specialDays} setSpecialDays={setSpecialDays} showSuccess={showSuccess} showError={showError} btnCls={btnCls} fld={fld} lbl={lbl} save={saveGeneral} saving={saving} />}
        {activeTab === 'modifiers' && <ModifiersTab modifierGroups={modifierGroups} setModifierGroups={setModifierGroups} modifiers={modifiers} setModifiers={setModifiers} showSuccess={showSuccess} showError={showError} fld={fld} lbl={lbl} />}
        {activeTab === 'visibility' && <VisibilityTab categories={categories} setCategories={setCategories} showError={showError} />}
        {activeTab === 'tips' && <TipsTab settings={settings} setSettings={setSettings} save={saveGeneral} saving={saving} btnCls={btnCls} fld={fld} lbl={lbl} toggleCls={toggleCls} toggleKnob={toggleKnob} />}
        {activeTab === 'payment' && <PaymentTab settings={settings} setSettings={setSettings} save={saveGeneral} saving={saving} btnCls={btnCls} toggleCls={toggleCls} toggleKnob={toggleKnob} />}
      </div>
    </div>
  );
}

// ─── Inline sub-components ─────────────────────────────────────

function AppearanceTab({ branding, setBranding, updateCommon, save, saving, btnCls, btnOutline, fld, lbl }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFieldRef = useRef('');
  const [uploadingField, setUploadingField] = useState('');

  if (!branding) return <p className="text-zinc-400 text-center py-8">Загрузка...</p>;

  const c = branding.common || {};
  const triggerUpload = (field: string) => {
    uploadFieldRef.current = field;
    fileInputRef.current?.click();
  };
  const handleFileUpload = async () => {
    const input = fileInputRef.current;
    const field = uploadFieldRef.current;
    if (!input || !input.files?.length || !field) return;
    setUploadingField(field);
    try {
      const result = await api.uploadBrandingImage(input.files[0]);
      updateCommon(field, result.url);
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setUploadingField(''); input.value = ''; }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-900 dark:text-white">Внешний вид приложения</h3>
        <div className="flex gap-2">
          <button onClick={() => { if (confirm('Сбросить настройки внешнего вида?')) { api.resetBranding().then(d => setBranding(d.branding)).catch(alert); }}} className={btnOutline}><RotateCcw size={14} /> Сбросить</button>
          <button onClick={save} disabled={saving} className={btnCls}><Save size={14} /> {saving ? '...' : 'Сохранить'}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">Цветовая схема</h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'primaryColor', label: 'Основной' },
              { key: 'secondaryColor', label: 'Вторичный' },
              { key: 'backgroundColor', label: 'Фон' },
              { key: 'textColor', label: 'Текст' },
              { key: 'cardColor', label: 'Карточки' },
              { key: 'successColor', label: 'Успех' },
              { key: 'errorColor', label: 'Ошибка' },
              { key: 'warningColor', label: 'Предупреждение' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <input type="color" value={c[key] || '#000000'} onChange={e => updateCommon(key, e.target.value)} className="w-9 h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] text-zinc-400 block">{label}</label>
                  <input value={c[key] || ''} onChange={e => updateCommon(key, e.target.value)} className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono bg-white dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>

          <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm pt-2 border-t border-zinc-200 dark:border-zinc-700">Логотип и иконки</h4>
          {[
            { key: 'logoUrl', label: 'Логотип' },
            { key: 'iconUrl', label: 'Иконка (512x512)' },
            { key: 'faviconUrl', label: 'Favicon' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs font-medium text-zinc-500 block mb-1">{label}</label>
              <div className="flex gap-2 items-center">
                {c[key] && <img src={c[key]} className="w-9 h-9 rounded-lg object-contain border border-zinc-200 dark:border-zinc-700 shrink-0" />}
                <button onClick={() => triggerUpload(key)} className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <Upload size={14} /> {uploadingField === key ? '...' : 'Загрузить'}
                </button>
                <input value={c[key] || ''} onChange={e => updateCommon(key, e.target.value)} placeholder="Или URL" className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">Шрифты</h4>
          <div>
            <label className={lbl}>Основной шрифт</label>
            <select value={c.fontFamily || 'Inter'} onChange={e => updateCommon('fontFamily', e.target.value)}
              className={fld} style={{ fontFamily: c.fontFamily }}>
              {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
          </div>

          <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm pt-2 border-t border-zinc-200 dark:border-zinc-700">Фоновые изображения</h4>
          {[
            { key: 'loginBackground', label: 'Фон экрана входа' },
            { key: 'homeBackground', label: 'Фон главного экрана' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs font-medium text-zinc-500 block mb-1">{label}</label>
              {c[key] && <img src={c[key]} className="w-full h-24 object-cover rounded-xl mb-2 border border-zinc-200 dark:border-zinc-700" />}
              <div className="flex gap-2">
                <button onClick={() => triggerUpload(key)} className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <Upload size={14} /> {uploadingField === key ? '...' : 'Загрузить'}
                </button>
                <input value={c[key] || ''} onChange={e => updateCommon(key, e.target.value)} placeholder="Или URL" className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
            </div>
          ))}

          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
            <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm mb-2">Предпросмотр</h4>
            <div className="w-[220px] mx-auto border-2 border-zinc-700 dark:border-zinc-500 rounded-[1.5rem] overflow-hidden shadow-lg bg-white">
              <div className="h-5 bg-zinc-800 flex items-center justify-center text-[8px] text-white font-medium">9:41</div>
              <div style={{ backgroundColor: c.primaryColor }} className="px-3 py-2 flex items-center gap-1.5">
                {c.logoUrl && <img src={c.logoUrl} className="w-5 h-5 rounded object-contain" />}
                <span className="text-white font-bold text-[10px] truncate" style={{ fontFamily: c.fontFamily }}>
                  {c.restaurantName || 'Ресторан'}
                </span>
              </div>
              <div style={{ backgroundColor: c.backgroundColor }} className="p-2 space-y-1.5 min-h-[180px]">
                <div style={{ backgroundColor: c.cardColor, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} className="p-2">
                  <p style={{ color: c.textColor, fontFamily: c.fontFamily, fontSize: '11px' }} className="font-bold">Популярное</p>
                  <div className="flex gap-1 mt-1">
                    {[1, 2].map(i => (
                      <div key={i} style={{ backgroundColor: c.backgroundColor }} className="flex-1 rounded p-1.5">
                        <div className="h-10 bg-zinc-200 rounded mb-1" />
                        <p style={{ color: c.textColor, fontSize: '9px' }} className="font-medium">Блюдо</p>
                        <p style={{ color: c.primaryColor }} className="text-[9px] font-bold">350 ₽</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button style={{ backgroundColor: c.primaryColor, color: '#fff', borderRadius: '8px', fontFamily: c.fontFamily }} className="w-full py-2 text-xs font-bold">Заказать</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
    </div>
  );
}

function BannersTab({ banners, setBanners, dishes, categories, promotions, showSuccess, showError, btnCls, btnOutline, fld, lbl }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({ image_url: '', title: '', subtitle: '', link_type: '', link_value: '', date_from: '', date_to: '', is_active: true, sort_order: 0 });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try { setBanners(await api.getAppBanners()); } catch {}
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ image_url: '', title: '', subtitle: '', link_type: '', link_value: '', date_from: '', date_to: '', is_active: true, sort_order: banners.length });
    setShowForm(true);
  };

  const openEdit = (b: any) => {
    setEditId(b.id);
    setForm({
      image_url: b.imageUrl || '',
      title: b.title || '',
      subtitle: b.subtitle || '',
      link_type: b.linkType || '',
      link_value: b.linkValue || '',
      date_from: b.dateFrom ? b.dateFrom.slice(0, 10) : '',
      date_to: b.dateTo ? b.dateTo.slice(0, 10) : '',
      is_active: b.isActive !== false,
      sort_order: b.sortOrder || 0,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.image_url) return showError('Загрузите изображение баннера');
    try {
      if (editId) await api.updateAppBanner(editId, form);
      else await api.createAppBanner(form);
      setShowForm(false);
      load();
      showSuccess(editId ? 'Баннер обновлён' : 'Баннер создан');
    } catch (e: any) { showError(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить баннер?')) return;
    try { await api.deleteAppBanner(id); load(); showSuccess('Баннер удалён'); } catch (e: any) { showError(e.message); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const { url } = await api.uploadAppImage(file); setForm({ ...form, image_url: url }); }
    catch (err: any) { showError(err.message); }
    finally { setUploading(false); }
  };

  const getLinkLabel = (type: string, val: string) => {
    if (!type || !val) return '—';
    if (type === 'url') return val;
    if (type === 'dish') { const d = dishes.find((x: any) => x.id === Number(val)); return d ? `Блюдо: ${d.name}` : val; }
    if (type === 'category') { const c = categories.find((x: any) => x.id === Number(val)); return c ? `Категория: ${c.name}` : val; }
    if (type === 'promotion') { const p = promotions.find((x: any) => x.id === Number(val)); return p ? `Акция: ${p.name}` : val; }
    return val;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-900 dark:text-white">Баннеры и слайды ({banners.length})</h3>
        <button onClick={openAdd} className={btnCls}><Plus size={16} /> Добавить баннер</button>
      </div>
      {banners.length === 0 ? (
        <div className="py-12 text-center text-zinc-400">Нет баннеров. Нажмите «Добавить баннер»</div>
      ) : (
        <div className="grid gap-3">
          {banners.map((b: any) => (
            <div key={b.id} className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <GripVertical size={16} className="text-zinc-300 cursor-grab shrink-0" />
              <div className="w-20 h-12 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
                {b.imageUrl && <img src={b.imageUrl} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-zinc-900 dark:text-white truncate">{b.title || 'Без заголовка'}</p>
                <p className="text-xs text-zinc-500 truncate">{b.subtitle}</p>
                <p className="text-[11px] text-zinc-400">{getLinkLabel(b.linkType, b.linkValue)}</p>
              </div>
              <div className="text-xs text-zinc-400 shrink-0 text-right">
                {b.dateFrom && <p>с {b.dateFrom.slice(0, 10)}</p>}
                {b.dateTo && <p>по {b.dateTo.slice(0, 10)}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
                {b.isActive ? 'Активен' : 'Неактивен'}
              </span>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(b)} className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><Edit3 size={14} /></button>
                <button onClick={() => remove(b.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{editId ? 'Редактировать' : 'Новый'} баннер</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Изображение (2048×1024, 16:9)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-lg cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm text-zinc-600">
                    <Upload size={16} /> {uploading ? '...' : 'Выбрать файл'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {form.image_url && <img src={form.image_url} className="h-10 rounded object-cover" />}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Заголовок</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={fld} />
                </div>
                <div>
                  <label className={lbl}>Подзаголовок</label>
                  <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} className={fld} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Ссылка на</label>
                  <select value={form.link_type} onChange={e => setForm({ ...form, link_type: e.target.value, link_value: '' })} className={fld}>
                    <option value="">Нет</option>
                    <option value="dish">Блюдо</option>
                    <option value="category">Категорию</option>
                    <option value="promotion">Акцию</option>
                    <option value="url">Внешний URL</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Значение</label>
                  {form.link_type === 'dish' ? (
                    <select value={form.link_value} onChange={e => setForm({ ...form, link_value: e.target.value })} className={fld}>
                      <option value="">Выберите блюдо</option>
                      {dishes.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  ) : form.link_type === 'category' ? (
                    <select value={form.link_value} onChange={e => setForm({ ...form, link_value: e.target.value })} className={fld}>
                      <option value="">Выберите категорию</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : form.link_type === 'promotion' ? (
                    <select value={form.link_value} onChange={e => setForm({ ...form, link_value: e.target.value })} className={fld}>
                      <option value="">Выберите акцию</option>
                      {promotions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : (
                    <input value={form.link_value} onChange={e => setForm({ ...form, link_value: e.target.value })} placeholder="URL или ID" className={fld} />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Дата начала</label>
                  <input type="date" value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })} className={fld} />
                </div>
                <div>
                  <label className={lbl}>Дата окончания</label>
                  <input type="date" value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })} className={fld} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Активен</span>
              </label>
              <button onClick={save} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg text-sm hover:bg-blue-600 active:scale-[0.97]">{editId ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PromotionsTab({ promotions, setPromotions, dishes, categories, showSuccess, showError, btnCls, btnOutline, fld, lbl }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({
    name: '', description: '', type: 'dish_discount', discount_percent: 0, discount_amount: 0,
    dish_id: null, category_id: null, combo_dishes: [], combo_price: 0, promo_code: '',
    min_order_amount: 0, max_uses: 0, date_from: '', date_to: '', is_active: true,
    show_on_dish: false, show_as_banner: false, show_on_page: false,
  });

  const load = async () => {
    try { setPromotions(await api.getAppPromotions()); } catch {}
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', description: '', type: 'dish_discount', discount_percent: 0, discount_amount: 0, dish_id: null, category_id: null, combo_dishes: [], combo_price: 0, promo_code: '', min_order_amount: 0, max_uses: 0, date_from: '', date_to: '', is_active: true, show_on_dish: false, show_as_banner: false, show_on_page: false });
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name || '',
      description: p.description || '',
      type: p.type || 'dish_discount',
      discount_percent: p.discountPercent || 0,
      discount_amount: p.discountAmount || 0,
      dish_id: p.dishId || null,
      category_id: p.categoryId || null,
      combo_dishes: typeof p.comboDishes === 'string' ? JSON.parse(p.comboDishes) : (p.comboDishes || []),
      combo_price: p.comboPrice || 0,
      promo_code: p.promoCode || '',
      min_order_amount: p.minOrderAmount || 0,
      max_uses: p.maxUses || 0,
      date_from: p.dateFrom ? p.dateFrom.slice(0, 10) : '',
      date_to: p.dateTo ? p.dateTo.slice(0, 10) : '',
      is_active: p.isActive !== false,
      show_on_dish: !!p.showOnDish,
      show_as_banner: !!p.showAsBanner,
      show_on_page: !!p.showOnPage,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return showError('Введите название акции');
    try {
      if (editId) await api.updateAppPromotion(editId, form);
      else await api.createAppPromotion(form);
      setShowForm(false);
      load();
      showSuccess(editId ? 'Акция обновлена' : 'Акция создана');
    } catch (e: any) { showError(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить акцию?')) return;
    try { await api.deleteAppPromotion(id); load(); showSuccess('Акция удалена'); } catch (e: any) { showError(e.message); }
  };

  const typeLabels: Record<string, string> = {
    dish_discount: 'Скидка на блюдо',
    category_discount: 'Скидка на категорию',
    combo: 'Комбо-набор',
    promo_code: 'Промокод',
    order_discount: 'Скидка на весь заказ',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-900 dark:text-white">Акции и предложения ({promotions.length})</h3>
        <button onClick={openAdd} className={btnCls}><Plus size={16} /> Добавить акцию</button>
      </div>
      {promotions.length === 0 ? (
        <div className="py-12 text-center text-zinc-400">Нет акций</div>
      ) : (
        <div className="space-y-2">
          {promotions.map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-zinc-900 dark:text-white">{p.name}</p>
                <p className="text-xs text-zinc-500">{typeLabels[p.type] || p.type}</p>
              </div>
              <span className="text-xs text-zinc-400">
                {p.discountPercent ? `${p.discountPercent}%` : ''}
                {p.discountAmount ? `${p.discountAmount}₽` : ''}
                {p.comboPrice ? `Комбо ${p.comboPrice}₽` : ''}
                {p.promoCode ? `Код: ${p.promoCode}` : ''}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
                {p.isActive ? 'Активна' : 'Неактивна'}
              </span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><Edit3 size={14} /></button>
                <button onClick={() => remove(p.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editId ? 'Редактировать' : 'Новая'} акция</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Название</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fld} />
              </div>
              <div>
                <label className={lbl}>Описание</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={fld + ' resize-none'} />
              </div>
              <div>
                <label className={lbl}>Тип акции</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={fld}>
                  {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {form.type === 'dish_discount' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Блюдо</label>
                    <select value={form.dish_id || ''} onChange={e => setForm({ ...form, dish_id: e.target.value ? Number(e.target.value) : null })} className={fld}>
                      <option value="">Выберите</option>
                      {dishes.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Скидка %</label>
                    <input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: Number(e.target.value) })} className={fld} />
                  </div>
                </div>
              )}
              {form.type === 'category_discount' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Категория</label>
                    <select value={form.category_id || ''} onChange={e => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })} className={fld}>
                      <option value="">Выберите</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Скидка %</label>
                    <input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: Number(e.target.value) })} className={fld} />
                  </div>
                </div>
              )}
              {form.type === 'combo' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Блюда в комбо (ID через запятую)</label>
                    <input value={form.combo_dishes.join(',')} onChange={e => setForm({ ...form, combo_dishes: e.target.value.split(',').map(Number).filter(Boolean) })} className={fld} placeholder="1,2,3" />
                  </div>
                  <div>
                    <label className={lbl}>Цена комбо</label>
                    <input type="number" value={form.combo_price} onChange={e => setForm({ ...form, combo_price: Number(e.target.value) })} className={fld} />
                  </div>
                </div>
              )}
              {form.type === 'promo_code' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Промокод</label>
                    <input value={form.promo_code} onChange={e => setForm({ ...form, promo_code: e.target.value })} className={fld} />
                  </div>
                  <div>
                    <label className={lbl}>Скидка %</label>
                    <input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: Number(e.target.value) })} className={fld} />
                  </div>
                </div>
              )}
              {form.type === 'order_discount' && (
                <div>
                  <label className={lbl}>Скидка на заказ %</label>
                  <input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: Number(e.target.value) })} className={fld} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Мин. сумма заказа</label>
                  <input type="number" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: Number(e.target.value) })} className={fld} />
                </div>
                <div>
                  <label className={lbl}>Макс. использований</label>
                  <input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: Number(e.target.value) })} className={fld} placeholder="0 = без лимита" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Дата начала</label>
                  <input type="date" value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })} className={fld} />
                </div>
                <div>
                  <label className={lbl}>Дата окончания</label>
                  <input type="date" value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })} className={fld} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.show_on_dish} onChange={e => setForm({ ...form, show_on_dish: e.target.checked })} />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Показывать метку на блюде</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.show_as_banner} onChange={e => setForm({ ...form, show_as_banner: e.target.checked })} />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Показывать как баннер</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.show_on_page} onChange={e => setForm({ ...form, show_on_page: e.target.checked })} />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Отдельная страница акций</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Активна</span>
                </label>
              </div>
              <button onClick={save} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg text-sm hover:bg-blue-600">{editId ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryTab({ settings, setSettings, deliveryZones, save, saving, btnCls, fld, lbl }: any) {
  const d = settings.delivery || {};
  const update = (key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      delivery: { ...prev.delivery, [key]: value },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-900 dark:text-white">Настройки доставки</h3>
        <button onClick={save} disabled={saving} className={btnCls}><Save size={14} /> {saving ? '...' : 'Сохранить'}</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Среднее время доставки (мин)</label>
          <input type="number" value={d.estimated_time || 60} onChange={e => update('estimated_time', Number(e.target.value))} className={fld} />
        </div>
        <div>
          <label className={lbl}>Минимальная сумма заказа</label>
          <input type="number" value={d.min_order_amount || settings.min_order_amount || 0} onChange={e => setSettings((prev: any) => ({ ...prev, min_order_amount: Number(e.target.value) }))} className={fld} />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="free_delivery" checked={d.free_delivery_enabled} onChange={e => update('free_delivery_enabled', e.target.checked)} className="rounded" />
          <label htmlFor="free_delivery" className="text-sm text-zinc-700 dark:text-zinc-300">Бесплатная доставка</label>
        </div>
        {d.free_delivery_enabled && (
          <div>
            <label className={lbl}>Бесплатно от суммы</label>
            <input type="number" value={d.free_delivery_from || 0} onChange={e => update('free_delivery_from', Number(e.target.value))} className={fld} />
          </div>
        )}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="pickup_enabled" checked={d.pickup_enabled !== false} onChange={e => update('pickup_enabled', e.target.checked)} className="rounded" />
          <label htmlFor="pickup_enabled" className="text-sm text-zinc-700 dark:text-zinc-300">Самовывоз</label>
        </div>
      </div>

      <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm pt-4 border-t border-zinc-200 dark:border-zinc-700">Зоны доставки ({deliveryZones.length})</h4>
      {deliveryZones.length === 0 ? (
        <p className="text-sm text-zinc-400">Зоны доставки управляются в разделе «Доставка»</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Название</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Стоимость</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Мин. заказ</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Время</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {deliveryZones.map((z: any) => (
                <tr key={z.id}>
                  <td className="px-3 py-2 font-medium">{z.name}</td>
                  <td className="px-3 py-2">{z.deliveryPrice} ₽</td>
                  <td className="px-3 py-2">{z.minOrder} ₽</td>
                  <td className="px-3 py-2">{z.estimatedTime} мин</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WorkingHoursTab({ settings, setSettings, workingHours, setWorkingHours, specialDays, setSpecialDays, showSuccess, showError, btnCls, fld, lbl, saving, save }: any) {
  const [newDay, setNewDay] = useState({ day_of_week: 0, open_time: '09:00', close_time: '21:00', is_closed: false });
  const [specialForm, setSpecialForm] = useState({ date: '', is_closed: true, message: '' });

  const loadHours = async () => {
    try {
      const data = await api.getAppWorkingHours();
      setWorkingHours(data.workingHours || []);
      setSpecialDays(data.specialDays || []);
    } catch {}
  };

  const saveHours = async () => {
    try {
      const result = await api.saveAppWorkingHours(workingHours);
      setWorkingHours(result);
      showSuccess('Расписание сохранено');
    } catch (e: any) { showError(e.message); }
  };

  const addDay = () => {
    if (workingHours.some((h: any) => h.dayOfWeek === newDay.day_of_week)) {
      setWorkingHours((prev: any) => prev.map((h: any) => h.dayOfWeek === newDay.day_of_week ? { ...h, open_time: newDay.open_time, close_time: newDay.close_time, is_closed: newDay.is_closed } : h));
    } else {
      setWorkingHours((prev: any) => [...prev, { dayOfWeek: newDay.day_of_week, openTime: newDay.open_time, closeTime: newDay.close_time, isClosed: newDay.is_closed }]);
    }
  };

  const toggleDayClosed = (dayOfWeek: number) => {
    setWorkingHours((prev: any) => prev.map((h: any) => h.dayOfWeek === dayOfWeek ? { ...h, isClosed: !h.isClosed } : h));
  };

  const addSpecialDay = async () => {
    if (!specialForm.date) return showError('Выберите дату');
    try {
      const result = await api.saveAppSpecialDay(specialForm);
      setSpecialDays(result);
      setSpecialForm({ date: '', is_closed: true, message: '' });
      showSuccess('Особый день добавлен');
    } catch (e: any) { showError(e.message); }
  };

  const removeSpecialDay = async (id: number) => {
    try { await api.deleteAppSpecialDay(id); setSpecialDays((prev: any) => prev.filter((d: any) => d.id !== id)); showSuccess('Дата удалена'); } catch (e: any) { showError(e.message); }
  };

  const hoursByDay = DAY_NAMES.map((name, i) => {
    const h = workingHours.find((wh: any) => wh.dayOfWeek === i);
    return { dayOfWeek: i, name, hours: h };
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-900 dark:text-white">Режим работы</h3>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-xl text-sm hover:bg-zinc-50 disabled:opacity-50"><Save size={14} /> {saving ? '...' : 'Сохранить настройки'}</button>
          <button onClick={saveHours} className={btnCls}><Save size={14} /> Сохранить расписание</button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm text-zinc-700 dark:text-zinc-300">Статус:</label>
        <select value={settings.working_status || 'open'} onChange={e => setSettings((prev: any) => ({ ...prev, working_status: e.target.value }))} className={fld + ' w-40'}>
          <option value="open">Открыто</option>
          <option value="closed">Закрыто</option>
          <option value="paused">На паузе</option>
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.auto_switch !== false} onChange={e => setSettings((prev: any) => ({ ...prev, auto_switch: e.target.checked }))} />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Автопереключение</span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hoursByDay.map(({ dayOfWeek, name, hours }) => (
          <div key={dayOfWeek} className={`flex items-center gap-3 p-3 rounded-xl border ${hours?.isClosed ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'}`}>
            <span className="w-28 text-sm font-medium text-zinc-700 dark:text-zinc-300">{name}</span>
            {hours ? (
              <>
                <input type="time" value={hours.openTime || '09:00'} onChange={e => setWorkingHours((prev: any) => prev.map((h: any) => h.dayOfWeek === dayOfWeek ? { ...h, openTime: e.target.value } : h))}
                  disabled={hours.isClosed} className={fld + ' w-28 disabled:opacity-30'} />
                <span className="text-zinc-400">—</span>
                <input type="time" value={hours.closeTime || '21:00'} onChange={e => setWorkingHours((prev: any) => prev.map((h: any) => h.dayOfWeek === dayOfWeek ? { ...h, closeTime: e.target.value } : h))}
                  disabled={hours.isClosed} className={fld + ' w-28 disabled:opacity-30'} />
                <button onClick={() => toggleDayClosed(dayOfWeek)} className={`px-2 py-1 rounded-lg text-xs font-medium ${hours.isClosed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {hours.isClosed ? 'Открыть' : 'Закрыть'}
                </button>
              </>
            ) : (
              <div className="flex gap-2 items-center flex-1">
                <input type="time" value={newDay.open_time} onChange={e => setNewDay({ ...newDay, open_time: e.target.value, day_of_week: dayOfWeek })} className={fld + ' w-28'} />
                <span className="text-zinc-400">—</span>
                <input type="time" value={newDay.close_time} onChange={e => setNewDay({ ...newDay, close_time: e.target.value, day_of_week: dayOfWeek })} className={fld + ' w-28'} />
                <button onClick={addDay} className="text-xs text-blue-500 hover:text-blue-600 font-medium">Добавить</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm pt-4 border-t border-zinc-200 dark:border-zinc-700">Особые дни (праздники, нерабочие дни)</h4>
      <div className="flex gap-2 items-end">
        <div>
          <label className={lbl}>Дата</label>
          <input type="date" value={specialForm.date} onChange={e => setSpecialForm({ ...specialForm, date: e.target.value })} className={fld + ' w-44'} />
        </div>
        <div>
          <label className={lbl}>Сообщение</label>
          <input value={specialForm.message} onChange={e => setSpecialForm({ ...specialForm, message: e.target.value })} className={fld + ' w-60'} placeholder="Сегодня не работаем" />
        </div>
        <label className="flex items-center gap-2 pb-1">
          <input type="checkbox" checked={specialForm.is_closed} onChange={e => setSpecialForm({ ...specialForm, is_closed: e.target.checked })} />
          <span className="text-sm text-zinc-600">Закрыто</span>
        </label>
        <button onClick={addSpecialDay} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">Добавить</button>
      </div>
      {specialDays.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {specialDays.map((d: any) => (
            <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
              <span className="font-medium">{d.date}</span>
              {d.message && <span className="text-zinc-500">— {d.message}</span>}
              <button onClick={() => removeSpecialDay(d.id)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModifiersTab({ modifierGroups, setModifierGroups, modifiers, setModifiers, showSuccess, showError, fld, lbl }: any) {
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showModForm, setShowModForm] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', sort_order: 0 });
  const [editGroupId, setEditGroupId] = useState<number | null>(null);
  const [modForm, setModForm] = useState<{ group_id: number | null; name: string; price: number; description: string; sort_order: number; is_active: boolean }>({ group_id: null, name: '', price: 0, description: '', sort_order: 0, is_active: true });
  const [editModId, setEditModId] = useState<number | null>(null);

  const load = async () => {
    try {
      const data = await api.getAppModifiers();
      setModifierGroups(data.groups || []);
      setModifiers(data.modifiers || []);
    } catch {}
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) return showError('Введите название группы');
    try {
      if (editGroupId) await api.updateAppModifierGroup(editGroupId, groupForm);
      else await api.createAppModifierGroup(groupForm);
      setShowGroupForm(false);
      load();
      showSuccess(editGroupId ? 'Группа обновлена' : 'Группа создана');
    } catch (e: any) { showError(e.message); }
  };

  const removeGroup = async (id: number) => {
    if (!confirm('Удалить группу?')) return;
    try { await api.deleteAppModifierGroup(id); load(); showSuccess('Группа удалена'); } catch (e: any) { showError(e.message); }
  };

  const saveMod = async () => {
    if (!modForm.name.trim()) return showError('Введите название модификатора');
    try {
      if (editModId) await api.updateAppModifier(editModId, modForm);
      else await api.createAppModifier(modForm);
      setShowModForm(false);
      load();
      showSuccess(editModId ? 'Модификатор обновлён' : 'Модификатор создан');
    } catch (e: any) { showError(e.message); }
  };

  const removeMod = async (id: number) => {
    if (!confirm('Удалить модификатор?')) return;
    try { await api.deleteAppModifier(id); load(); showSuccess('Модификатор удалён'); } catch (e: any) { showError(e.message); }
  };

  const groupedModifiers = modifierGroups.map((g: any) => ({
    group: g,
    items: modifiers.filter((m: any) => m.groupId === g.id),
  }));
  const ungrouped = modifiers.filter((m: any) => !m.groupId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-900 dark:text-white">Общие модификаторы</h3>
        <div className="flex gap-2">
          <button onClick={() => { setEditGroupId(null); setGroupForm({ name: '', sort_order: 0 }); setShowGroupForm(true); }} className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 rounded-xl text-sm hover:bg-zinc-50"><Plus size={14} /> Группу</button>
          <button onClick={() => { setEditModId(null); setModForm({ group_id: null, name: '', price: 0, description: '', sort_order: 0, is_active: true }); setShowModForm(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600"><Plus size={14} /> Модификатор</button>
        </div>
      </div>

      {modifierGroups.length === 0 && modifiers.length === 0 && (
        <div className="py-12 text-center text-zinc-400">Нет модификаторов</div>
      )}

      {groupedModifiers.map(({ group, items }: any) => (
        <div key={group.id} className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
            <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{group.name}</span>
            <div className="flex gap-1">
              <button onClick={() => { setEditGroupId(group.id); setGroupForm({ name: group.name, sort_order: group.sortOrder || 0 }); setShowGroupForm(true); }} className="p-1 text-zinc-400 hover:text-blue-500"><Edit3 size={13} /></button>
              <button onClick={() => removeGroup(group.id)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          </div>
          {items.length === 0 && <p className="px-4 py-3 text-xs text-zinc-400">Нет модификаторов</p>}
          {items.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
              <span className={`w-2 h-2 rounded-full ${m.isActive ? 'bg-green-500' : 'bg-zinc-300'}`} />
              <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">{m.name}</span>
              <span className="text-sm text-zinc-500">{m.price} ₽</span>
              <span className="text-xs text-zinc-400">{m.description}</span>
              <div className="flex gap-1">
                <button onClick={() => { setEditModId(m.id); setModForm({ group_id: m.groupId, name: m.name, price: m.price, description: m.description || '', sort_order: m.sortOrder || 0, is_active: m.isActive !== false }); setShowModForm(true); }} className="p-1 text-zinc-400 hover:text-blue-500"><Edit3 size={13} /></button>
                <button onClick={() => removeMod(m.id)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {ungrouped.length > 0 && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
            <span className="font-semibold text-sm text-zinc-500">Без группы</span>
          </div>
          {ungrouped.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2 border-b border-zinc-100 last:border-b-0">
              <span className={`w-2 h-2 rounded-full ${m.isActive ? 'bg-green-500' : 'bg-zinc-300'}`} />
              <span className="flex-1 text-sm font-medium">{m.name}</span>
              <span className="text-sm text-zinc-500">{m.price} ₽</span>
              <span className="text-xs text-zinc-400">{m.description}</span>
              <div className="flex gap-1">
                <button onClick={() => { setEditModId(m.id); setModForm({ group_id: null, name: m.name, price: m.price, description: m.description || '', sort_order: m.sortOrder || 0, is_active: m.isActive !== false }); setShowModForm(true); }} className="p-1 text-zinc-400 hover:text-blue-500"><Edit3 size={13} /></button>
                <button onClick={() => removeMod(m.id)} className="p-1 text-zinc-400 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showGroupForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowGroupForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editGroupId ? 'Редактировать' : 'Новая'} группа</h3>
              <button onClick={() => setShowGroupForm(false)} className="p-1 text-zinc-400"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Название группы</label>
                <input value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} className={fld} />
              </div>
              <div>
                <label className={lbl}>Порядок</label>
                <input type="number" value={groupForm.sort_order} onChange={e => setGroupForm({ ...groupForm, sort_order: Number(e.target.value) })} className={fld} />
              </div>
              <button onClick={saveGroup} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg text-sm">{editGroupId ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {showModForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editModId ? 'Редактировать' : 'Новый'} модификатор</h3>
              <button onClick={() => setShowModForm(false)} className="p-1 text-zinc-400"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Название</label>
                <input value={modForm.name} onChange={e => setModForm({ ...modForm, name: e.target.value })} className={fld} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Цена</label>
                  <input type="number" value={modForm.price} onChange={e => setModForm({ ...modForm, price: Number(e.target.value) })} className={fld} />
                </div>
                <div>
                  <label className={lbl}>Группа</label>
                  <select value={modForm.group_id || ''} onChange={e => setModForm({ ...modForm, group_id: e.target.value ? Number(e.target.value) : null })} className={fld}>
                    <option value="">Без группы</option>
                    {modifierGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Описание</label>
                <input value={modForm.description} onChange={e => setModForm({ ...modForm, description: e.target.value })} className={fld} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={modForm.is_active} onChange={e => setModForm({ ...modForm, is_active: e.target.checked })} />
                <span className="text-sm text-zinc-700">Активен</span>
              </label>
              <button onClick={saveMod} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg text-sm">{editModId ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VisibilityTab({ categories, setCategories, showError }: any) {
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const toggleVisibility = async (catId: number, field: string, value: boolean) => {
    setSavingId(catId);
    try {
      const cat = categories.find((c: any) => c.id === catId);
      if (!cat) return;
      await api.updateMenuCategoryVisibility(catId, { [field]: value });
      setCategories((prev: any) => prev.map((c: any) => c.id === catId ? { ...c, [field]: value } : c));
    } catch (e: any) { showError(e.message); }
    finally { setSavingId(null); }
  };

  const filtered = categories.filter((c: any) => !search || c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-900 dark:text-white">Видимость категорий на каналах</h3>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className="w-48 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 pl-8" />
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-zinc-500 uppercase">Категория</th>
              {CHANNELS.map(ch => (
                <th key={ch.key} className="text-center px-3 py-2.5 text-xs font-semibold text-zinc-500 uppercase">{ch.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((cat: any) => (
              <tr key={cat.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                <td className="px-3 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                  <span className="inline-flex items-center gap-1.5">{cat.icon || '📁'} {cat.name}</span>
                </td>
                {CHANNELS.map(ch => (
                  <td key={ch.key} className="text-center px-3 py-2.5">
                    <button onClick={() => toggleVisibility(cat.id, ch.key, !cat[ch.key])}
                      disabled={savingId === cat.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${cat[ch.key] ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'} disabled:opacity-50`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${cat[ch.key] ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-zinc-400">Нет категорий</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TipsTab({ settings, setSettings, save, saving, btnCls, fld, lbl, toggleCls, toggleKnob }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-900 dark:text-white">Чаевые и сборы</h3>
        <button onClick={save} disabled={saving} className={btnCls}><Save size={14} /> {saving ? '...' : 'Сохранить'}</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">Чаевые</h4>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Разрешены</span>
            <button onClick={() => setSettings((prev: any) => ({ ...prev, tips_enabled: !prev.tips_enabled }))} className={toggleCls(settings.tips_enabled)}>
              <span className={toggleKnob(settings.tips_enabled)} />
            </button>
          </div>
          {settings.tips_enabled && (
            <div>
              <label className={lbl}>Процент от суммы заказа</label>
              <input type="number" value={settings.tips_percent || 10} onChange={e => setSettings((prev: any) => ({ ...prev, tips_percent: Number(e.target.value) }))} className={fld + ' w-32'} />
            </div>
          )}
        </div>

        <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">Сервисный сбор</h4>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Включён</span>
            <button onClick={() => setSettings((prev: any) => ({ ...prev, service_fee_enabled: !prev.service_fee_enabled }))} className={toggleCls(settings.service_fee_enabled)}>
              <span className={toggleKnob(settings.service_fee_enabled)} />
            </button>
          </div>
          {settings.service_fee_enabled && (
            <div className="space-y-3">
              <div>
                <label className={lbl}>Тип</label>
                <select value={settings.service_fee_type || 'percent'} onChange={e => setSettings((prev: any) => ({ ...prev, service_fee_type: e.target.value }))} className={fld}>
                  <option value="percent">Процент</option>
                  <option value="fixed">Фиксированная сумма</option>
                </select>
              </div>
              <div>
                <label className={lbl}>{settings.service_fee_type === 'percent' ? 'Процент' : 'Сумма'}</label>
                <input type="number" value={settings.service_fee_value || 0} onChange={e => setSettings((prev: any) => ({ ...prev, service_fee_value: Number(e.target.value) }))} className={fld + ' w-32'} />
              </div>
              <div>
                <label className={lbl}>Описание</label>
                <input value={settings.service_fee_description || ''} onChange={e => setSettings((prev: any) => ({ ...prev, service_fee_description: e.target.value }))} className={fld} placeholder="Например: «Сбор за обслуживание»" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentTab({ settings, setSettings, save, saving, btnCls, toggleCls, toggleKnob }: any) {
  const pm = settings.payment_methods || {};
  const updatePayment = (key: string, value: boolean) => {
    setSettings((prev: any) => ({
      ...prev,
      payment_methods: { ...prev.payment_methods, [key]: value },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-900 dark:text-white">Способы оплаты в приложении</h3>
        <button onClick={save} disabled={saving} className={btnCls}><Save size={14} /> {saving ? '...' : 'Сохранить'}</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { key: 'cash', label: 'Наличные', desc: 'Оплата наличными курьеру или в заведении' },
          { key: 'card_courier', label: 'Карта курьеру', desc: 'Оплата картой курьеру при получении' },
          { key: 'online', label: 'Онлайн (эквайринг)', desc: 'Оплата картой онлайн через платёжную систему' },
          { key: 'in_place', label: 'В заведении', desc: 'Оплата при получении в ресторане' },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div>
              <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
            </div>
            <button onClick={() => updatePayment(key, !pm[key])} className={toggleCls(pm[key] !== false)}>
              <span className={toggleKnob(pm[key] !== false)} />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-400 mt-2">Настройки платёжной системы (Т-Банк) управляются в разделе «Платёжные системы»</p>
    </div>
  );
}
