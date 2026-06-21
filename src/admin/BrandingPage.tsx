import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import {
  Palette, Save, RotateCcw, Upload, Eye, X, Check, AlertCircle,
  Type, Image, Globe, Smartphone,
} from 'lucide-react';

const FONTS = [
  'Inter', 'Roboto', 'Montserrat', 'Open Sans', 'Playfair Display',
  'Lato', 'Raleway', 'Nunito', 'Oswald', 'PT Sans',
];

const SIZES = [
  { value: 'small', label: 'Маленький' },
  { value: 'medium', label: 'Средний' },
  { value: 'large', label: 'Большой' },
];

const RADIUS_OPTIONS = [
  { value: 'none', label: 'Квадратные' },
  { value: 'small', label: 'Малый скругление' },
  { value: 'medium', label: 'Среднее скругление' },
  { value: 'large', label: 'Большое скругление' },
];

const CARD_OPTIONS = [
  { value: 'shadow', label: 'С тенью' },
  { value: 'border', label: 'С обводкой' },
  { value: 'none', label: 'Без оформления' },
];

const SHADOW_OPTIONS = [
  { value: 'none', label: 'Без тени' },
  { value: 'small', label: 'Минимальная' },
  { value: 'medium', label: 'Средняя' },
  { value: 'large', label: 'Большая' },
];

const DEFAULT_BRANDING = {
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
};

export default function BrandingPage() {
  const { t } = useTranslation();
  const [branding, setBranding] = useState<any>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('common');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFieldRef = useRef('');
  const [uploadingField, setUploadingField] = useState('');

  const c = branding?.common || DEFAULT_BRANDING.common;
  const s = branding?.site || DEFAULT_BRANDING.site;

  useEffect(() => { load(); }, []);

  // Load Google Font dynamically for preview
  useEffect(() => {
    const font = c.fontFamily;
    if (!font || font === 'Inter') return;
    const linkId = 'branding-font-link';
    const existing = document.getElementById(linkId);
    if (existing) existing.remove();
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }, [c.fontFamily]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getBranding();
      setBranding(data.branding);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.saveBranding(branding);
      setMessage('Настройки брендирования сохранены');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!confirm('Сбросить все настройки брендирования?')) return;
    setSaving(true);
    try {
      const data = await api.resetBranding();
      setBranding(data.branding);
      setMessage('Настройки сброшены до стандартных');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

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
      setBranding((prev: any) => {
        const parts = field.split('.');
        if (parts.length === 2) {
          const [section, key] = parts;
          return { ...prev, [section]: { ...prev[section], [key]: result.url } };
        }
        return { ...prev, common: { ...prev.common, [field]: result.url } };
      });
    } catch (e: any) { setError(e.message); }
    finally { setUploadingField(''); input.value = ''; }
  };

  const updateCommon = (key: string, value: any) => {
    setBranding((prev: any) => ({ ...prev, common: { ...prev.common, [key]: value } }));
  };

  const updateSite = (key: string, value: any) => {
    if (key.startsWith('social.')) {
      const socialKey = key.split('.')[1];
      setBranding((prev: any) => ({
        ...prev, site: { ...prev.site, social: { ...prev.site.social, [socialKey]: value } },
      }));
    } else {
      setBranding((prev: any) => ({ ...prev, site: { ...prev.site, [key]: value } }));
    }
  };

  const tabs = [
    { id: 'common', label: 'Общие', icon: Palette },
    { id: 'colors', label: 'Цвета и шрифты', icon: Type },
    { id: 'backgrounds', label: 'Фоны', icon: Image },
    { id: 'site', label: 'Сайт-витрина', icon: Globe },
    { id: 'preview', label: 'Предпросмотр', icon: Eye },
  ];

  if (loading) {
    return <div className="text-center py-12 text-zinc-400">Загрузка...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Брендирование</h2>
          <p className="text-sm text-zinc-500 mt-1">Настройка внешнего вида приложений и сайта</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-xl font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50">
            <RotateCcw size={16} /> Сбросить
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 disabled:opacity-50">
            <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {message && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2.5 text-sm text-green-700 dark:text-green-400 flex items-center gap-2"><Check size={16} /> {message}</div>}
      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700 pb-1 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-b-0 border-zinc-200 dark:border-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        {/* TAB: Common */}
        {activeTab === 'common' && (
          <div className="space-y-5">
            <h3 className="font-bold text-zinc-900 dark:text-white">Основные настройки</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Название ресторана</label>
                <input value={c.restaurantName} onChange={e => updateCommon('restaurantName', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Основной цвет (primary)</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={c.primaryColor} onChange={e => updateCommon('primaryColor', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer" />
                  <input value={c.primaryColor} onChange={e => updateCommon('primaryColor', e.target.value)}
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono bg-white dark:bg-zinc-800" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Логотип</label>
                <div className="flex gap-2 items-center">
                  {c.logoUrl && <img src={c.logoUrl} className="w-10 h-10 rounded-lg object-contain border border-zinc-200" />}
                  <button onClick={() => triggerUpload('logoUrl')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <Upload size={14} /> {uploadingField === 'logoUrl' ? '...' : 'Загрузить'}
                  </button>
                  <input value={c.logoUrl} onChange={e => updateCommon('logoUrl', e.target.value)} placeholder="Или URL"
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Иконка (512x512)</label>
                <div className="flex gap-2 items-center">
                  {c.iconUrl && <img src={c.iconUrl} className="w-10 h-10 rounded-lg object-contain border border-zinc-200" />}
                  <button onClick={() => triggerUpload('iconUrl')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <Upload size={14} /> {uploadingField === 'iconUrl' ? '...' : 'Загрузить'}
                  </button>
                  <input value={c.iconUrl} onChange={e => updateCommon('iconUrl', e.target.value)} placeholder="Или URL"
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Favicon</label>
                <div className="flex gap-2 items-center">
                  {c.faviconUrl && <img src={c.faviconUrl} className="w-8 h-8 rounded object-contain border border-zinc-200" />}
                  <button onClick={() => triggerUpload('faviconUrl')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <Upload size={14} /> {uploadingField === 'faviconUrl' ? '...' : 'Загрузить'}
                  </button>
                  <input value={c.faviconUrl} onChange={e => updateCommon('faviconUrl', e.target.value)} placeholder="Или URL"
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Карточки</label>
                <select value={c.cardStyle} onChange={e => updateCommon('cardStyle', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {CARD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Форма кнопок</label>
                <select value={c.buttonRadius} onChange={e => updateCommon('buttonRadius', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {RADIUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Тени</label>
                <select value={c.shadow} onChange={e => updateCommon('shadow', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {SHADOW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Colors & Fonts */}
        {activeTab === 'colors' && (
          <div className="space-y-5">
            <h3 className="font-bold text-zinc-900 dark:text-white">Цветовая схема</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'primaryColor', label: 'Основной (primary)' },
                { key: 'secondaryColor', label: 'Вторичный (secondary)' },
                { key: 'textColor', label: 'Цвет текста' },
                { key: 'secondaryTextColor', label: 'Второстепенный текст' },
                { key: 'backgroundColor', label: 'Цвет фона' },
                { key: 'cardColor', label: 'Цвет карточек' },
                { key: 'successColor', label: 'Цвет успеха' },
                { key: 'errorColor', label: 'Цвет ошибки' },
                { key: 'warningColor', label: 'Цвет предупреждения' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <input type="color" value={c[key] || '#000000'} onChange={e => updateCommon(key, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer shrink-0" />
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500 block">{label}</label>
                    <input value={c[key] || ''} onChange={e => updateCommon(key, e.target.value)}
                      className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>

            <h3 className="font-bold text-zinc-900 dark:text-white pt-4 border-t border-zinc-200 dark:border-zinc-700">Шрифты и типографика</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Основной шрифт</label>
                <select value={c.fontFamily} onChange={e => updateCommon('fontFamily', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800"
                  style={{ fontFamily: c.fontFamily }}>
                  {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Размер заголовков</label>
                <select value={c.headingSize} onChange={e => updateCommon('headingSize', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {SIZES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Размер текста</label>
                <select value={c.bodySize} onChange={e => updateCommon('bodySize', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {SIZES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Backgrounds */}
        {activeTab === 'backgrounds' && (
          <div className="space-y-5">
            <h3 className="font-bold text-zinc-900 dark:text-white">Фоновые изображения</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Фон экрана входа</label>
                {c.loginBackground && <img src={c.loginBackground} className="w-full h-32 object-cover rounded-xl mb-2 border border-zinc-200" />}
                <div className="flex gap-2">
                  <button onClick={() => triggerUpload('loginBackground')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <Upload size={14} /> {uploadingField === 'loginBackground' ? '...' : 'Загрузить'}
                  </button>
                  <input value={c.loginBackground} onChange={e => updateCommon('loginBackground', e.target.value)} placeholder="Или URL"
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Фон главного экрана</label>
                {c.homeBackground && <img src={c.homeBackground} className="w-full h-32 object-cover rounded-xl mb-2 border border-zinc-200" />}
                <div className="flex gap-2">
                  <button onClick={() => triggerUpload('homeBackground')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <Upload size={14} /> {uploadingField === 'homeBackground' ? '...' : 'Загрузить'}
                  </button>
                  <input value={c.homeBackground} onChange={e => updateCommon('homeBackground', e.target.value)} placeholder="Или URL"
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Изображение пустого состояния</label>
                {c.emptyStateImage && <img src={c.emptyStateImage} className="w-full h-32 object-contain rounded-xl mb-2 border border-zinc-200" />}
                <div className="flex gap-2">
                  <button onClick={() => triggerUpload('emptyStateImage')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <Upload size={14} /> {uploadingField === 'emptyStateImage' ? '...' : 'Загрузить'}
                  </button>
                  <input value={c.emptyStateImage} onChange={e => updateCommon('emptyStateImage', e.target.value)} placeholder="Или URL"
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Site */}
        {activeTab === 'site' && (
          <div className="space-y-5">
            <h3 className="font-bold text-zinc-900 dark:text-white">Сайт-витрина</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Заголовок страницы</label>
                <input value={s.title} onChange={e => updateSite('title', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Слоган</label>
                <input value={s.slogan} onChange={e => updateSite('slogan', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Баннер</label>
                {s.bannerUrl && <img src={s.bannerUrl} className="w-full h-40 object-cover rounded-xl mb-2 border border-zinc-200" />}
                <div className="flex gap-2">
                  <button onClick={() => triggerUpload('site.bannerUrl')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <Upload size={14} /> {uploadingField === 'bannerUrl' ? '...' : 'Загрузить'}
                  </button>
                  <input value={s.bannerUrl} onChange={e => updateSite('bannerUrl', e.target.value)} placeholder="Или URL"
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">О ресторане</label>
                <textarea value={s.aboutText} onChange={e => updateSite('aboutText', e.target.value)} rows={4}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Телефон</label>
                <input value={s.phone} onChange={e => updateSite('phone', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Email</label>
                <input value={s.email} onChange={e => updateSite('email', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Адрес</label>
                <input value={s.address} onChange={e => updateSite('address', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Заголовок вкладки (title)</label>
                <input value={s.browserTitle} onChange={e => updateSite('browserTitle', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Мета-описание (SEO)</label>
                <textarea value={s.metaDescription} onChange={e => updateSite('metaDescription', e.target.value)} rows={2}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 resize-none" />
              </div>
            </div>

            <h3 className="font-bold text-zinc-900 dark:text-white pt-4 border-t border-zinc-200 dark:border-zinc-700">Социальные сети</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Instagram</label>
                <input value={s.social?.instagram || ''} onChange={e => updateSite('social.instagram', e.target.value)} placeholder="https://instagram.com/..."
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">VK</label>
                <input value={s.social?.vk || ''} onChange={e => updateSite('social.vk', e.target.value)} placeholder="https://vk.com/..."
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Telegram</label>
                <input value={s.social?.telegram || ''} onChange={e => updateSite('social.telegram', e.target.value)} placeholder="https://t.me/..."
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
            </div>
          </div>
        )}

        {/* TAB: Preview */}
        {activeTab === 'preview' && (
          <div className="space-y-5">
            <h3 className="font-bold text-zinc-900 dark:text-white">Предпросмотр</h3>
            <p className="text-sm text-zinc-500">Примерный вид приложения с текущими настройками</p>
            <div className="flex gap-4 flex-wrap justify-center">
              {/* Phone mockup */}
              <div className="w-[280px] border-4 border-zinc-800 dark:border-zinc-600 rounded-[2rem] overflow-hidden shadow-xl bg-white">
                {/* Status bar */}
                <div className="h-6 bg-zinc-800 flex items-center justify-center text-[10px] text-white font-medium">9:41</div>
                {/* Header */}
                <div style={{ backgroundColor: c.primaryColor }} className="px-4 py-3 flex items-center gap-2">
                  {c.logoUrl && <img src={c.logoUrl} className="w-7 h-7 rounded object-contain" />}
                  <span className="text-white font-bold text-sm truncate" style={{ fontFamily: c.fontFamily }}>
                    {c.restaurantName || 'Мой ресторан'}
                  </span>
                </div>
                {/* Content */}
                <div style={{ backgroundColor: c.backgroundColor }} className="p-3 space-y-2 min-h-[300px]">
                  {/* Hero card */}
                  <div style={{
                    backgroundColor: c.cardColor,
                    borderRadius: c.buttonRadius === 'none' ? '0px' : c.buttonRadius === 'small' ? '8px' : c.buttonRadius === 'large' ? '20px' : '12px',
                    boxShadow: c.shadow === 'none' ? 'none' : c.shadow === 'small' ? '0 1px 3px rgba(0,0,0,0.1)' : c.shadow === 'large' ? '0 10px 40px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.1)',
                  }} className="p-4">
                    <h4 style={{ color: c.textColor, fontFamily: c.fontFamily, fontSize: c.headingSize === 'small' ? '14px' : c.headingSize === 'large' ? '20px' : '16px' }}
                      className="font-bold">Популярные блюда</h4>
                    <div className="flex gap-2 mt-2">
                      {[1, 2].map(i => (
                        <div key={i} style={{ backgroundColor: c.backgroundColor }} className="flex-1 rounded-lg p-2">
                          <div className="h-16 bg-zinc-200 rounded-md mb-1" />
                          <p style={{ color: c.textColor, fontSize: '11px' }} className="font-medium">Блюдо {i}</p>
                          <p style={{ color: c.secondaryColor }} className="text-xs font-bold">350 ₽</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Button */}
                  <button style={{
                    backgroundColor: c.primaryColor,
                    color: '#FFFFFF',
                    borderRadius: c.buttonRadius === 'none' ? '0px' : c.buttonRadius === 'small' ? '8px' : c.buttonRadius === 'large' ? '16px' : '12px',
                    fontFamily: c.fontFamily,
                  }} className="w-full py-3 font-bold text-sm">
                    {c.restaurantName ? `Заказать в ${c.restaurantName}` : 'Заказать'}
                  </button>
                  {/* Card with border */}
                  <div style={{
                    backgroundColor: c.cardColor,
                    borderRadius: c.buttonRadius === 'none' ? '0px' : '12px',
                    border: c.cardStyle === 'border' ? `1px solid ${c.secondaryColor}` : 'none',
                    boxShadow: c.cardStyle === 'shadow' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  }} className="p-3">
                    <p style={{ color: c.textColor, fontFamily: c.fontFamily, fontSize: c.bodySize === 'small' ? '12px' : c.bodySize === 'large' ? '16px' : '14px' }}>
                      Пример текста с текущими настройками шрифта и цвета.
                    </p>
                    <span style={{ color: c.successColor, fontSize: '12px' }} className="font-medium">✓ Успешно</span>
                    <span style={{ color: c.errorColor, fontSize: '12px' }} className="font-medium ml-2">✗ Ошибка</span>
                  </div>
                  {/* Bottom nav */}
                  <div style={{ backgroundColor: c.cardColor, borderTop: `1px solid ${c.secondaryColor}20` }}
                    className="flex justify-around py-2 mt-2">
                    {['Главная', 'Поиск', 'Корзина', 'Профиль'].map(tab => (
                      <span key={tab} style={{ color: c.secondaryTextColor, fontSize: '10px' }} className="font-medium">{tab}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Info panel */}
              <div className="flex-1 min-w-[250px] max-w-sm bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-sm space-y-2">
                <h4 className="font-bold text-zinc-700 dark:text-zinc-300">Применённые настройки</h4>
                <div className="space-y-1 text-xs text-zinc-500">
                  <p><span className="font-medium text-zinc-700 dark:text-zinc-400">Шрифт:</span> {c.fontFamily}</p>
                  <p><span className="font-medium text-zinc-700 dark:text-zinc-400">Primary:</span> <span style={{ color: c.primaryColor }}>{c.primaryColor}</span></p>
                  <p><span className="font-medium text-zinc-700 dark:text-zinc-400">Secondary:</span> <span style={{ color: c.secondaryColor }}>{c.secondaryColor}</span></p>
                  <p><span className="font-medium text-zinc-700 dark:text-zinc-400">Фон:</span> <span style={{ color: c.backgroundColor }}>▊</span> {c.backgroundColor}</p>
                  <p><span className="font-medium text-zinc-700 dark:text-zinc-400">Текст:</span> <span style={{ color: c.textColor }}>{c.textColor}</span></p>
                  <p><span className="font-medium text-zinc-700 dark:text-zinc-400">Кнопки:</span> {RADIUS_OPTIONS.find(o => o.value === c.buttonRadius)?.label}</p>
                  <p><span className="font-medium text-zinc-700 dark:text-zinc-400">Карточки:</span> {CARD_OPTIONS.find(o => o.value === c.cardStyle)?.label}</p>
                  <p><span className="font-medium text-zinc-700 dark:text-zinc-400">Тени:</span> {SHADOW_OPTIONS.find(o => o.value === c.shadow)?.label}</p>
                </div>
                {c.logoUrl && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <p className="font-medium text-zinc-700 dark:text-zinc-400 text-xs mb-1">Логотип:</p>
                    <img src={c.logoUrl} className="h-10 object-contain rounded border border-zinc-200 dark:border-zinc-700" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
    </div>
  );
}