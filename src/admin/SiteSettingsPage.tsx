import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import {
  Save, RotateCcw, Upload, Eye, X, Check, AlertCircle,
  Settings, Palette, Image, LayoutGrid, ShoppingBag,
} from 'lucide-react';

const FONTS = ['Montserrat', 'Inter', 'Roboto', 'Open Sans', 'Playfair Display', 'Lato', 'Raleway', 'Nunito', 'Oswald', 'PT Sans'];
const STORE_TYPES = ['Ресторан', 'Кафе', 'Пекарня', 'Бар', 'Кофейня', 'Фастфуд', 'Столовая', 'Кулинария'];
const ALIGN_VERT = [
  { value: 'top', label: 'Сверху' },
  { value: 'middle', label: 'По центру' },
  { value: 'bottom', label: 'Снизу' },
];
const ALIGN_HORIZ = [
  { value: 'left', label: 'Слева' },
  { value: 'center', label: 'По центру' },
  { value: 'right', label: 'Справа' },
];
const IMAGE_POSITIONS = [
  { value: 'top', label: 'Сверху' },
  { value: 'bottom', label: 'Снизу' },
];

const DEFAULT_SETTINGS = {
  common: {
    seo: { title: '', browserTitle: '', metaDescription: '' },
    feed: '',
    additionalPages: '',
    customCode: '',
    domains: '',
    fontFamily: 'Montserrat',
    showStores: true,
    storeType: 'Ресторан',
    guestRegistration: 'allowed',
  },
  colors: {
    backgroundColor: '#FFFFFF',
    primaryFillColor: '#FF5722',
    primaryTextColor: '#1F2937',
    secondaryFillColor: '#FFF3E0',
    secondaryTextColor: '#6B7280',
  },
  images: { slides: [], logoHorizontal: '' },
  categories: {
    showPanelTop: true, showCenter: true, padding: '', gap: '',
    imagePosition: 'top', border: false,
    verticalAlign: 'bottom', horizontalAlign: 'center',
    fontFamily: 'Montserrat', textColor: '#1F2937', borderColor: '#E5E7EB',
  },
  productCards: {
    padding: '', imagePosition: 'top', border: false,
    verticalAlign: 'bottom', horizontalAlign: 'center',
    fontFamily: 'Montserrat', textColor: '#1F2937', borderColor: '#E5E7EB',
  },
};

export default function SiteSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('common');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFieldRef = useRef('');
  const [uploadingField, setUploadingField] = useState('');

  const s = settings || DEFAULT_SETTINGS;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getSiteSettings();
      setSettings(data.settings);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.saveSiteSettings(settings);
      setMessage('Настройки сайта сохранены');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!confirm('Сбросить все настройки сайта?')) return;
    setSaving(true);
    try {
      const data = await api.resetSiteSettings();
      setSettings(data.settings);
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
      const result = await api.uploadSiteImage(input.files[0]);
      if (field === 'slides' || field.startsWith('slides.')) {
        const idx = parseInt(field.split('.')[1] || String(Date.now()), 10);
        setSettings((prev: any) => {
          const slides = [...(prev.images?.slides || [])];
          slides[idx] = result.url;
          return { ...prev, images: { ...prev.images, slides } };
        });
      } else {
        setSettings((prev: any) => {
          const parts = field.split('.');
          if (parts.length === 2) {
            const [section, key] = parts;
            return { ...prev, [section]: { ...prev[section], [key]: result.url } };
          }
          return { ...prev, images: { ...prev.images, [field]: result.url } };
        });
      }
    } catch (e: any) { setError(e.message); }
    finally { setUploadingField(''); input.value = ''; }
  };

  const update = (section: string, key: string, value: any) => {
    setSettings((prev: any) => {
      if (key.includes('.')) {
        const parts = key.split('.');
        const inner = { ...prev[section] };
        let obj = inner;
        for (let i = 0; i < parts.length - 1; i++) {
          obj[parts[i]] = { ...obj[parts[i]] };
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
        return { ...prev, [section]: inner };
      }
      return { ...prev, [section]: { ...prev[section], [key]: value } };
    });
  };

  const removeSlide = (idx: number) => {
    setSettings((prev: any) => {
      const slides = [...(prev.images?.slides || [])];
      slides.splice(idx, 1);
      return { ...prev, images: { ...prev.images, slides } };
    });
  };

  const addSlide = () => {
    triggerUpload('slides.' + ((s.images?.slides || []).length));
  };

  const tabs = [
    { id: 'common', label: 'Общие настройки', icon: Settings },
    { id: 'colors', label: 'Цвета', icon: Palette },
    { id: 'images', label: 'Изображения', icon: Image },
    { id: 'categories', label: 'Категории', icon: LayoutGrid },
    { id: 'products', label: 'Карточки товаров', icon: ShoppingBag },
  ];

  const c = s.common || DEFAULT_SETTINGS.common;
  const col = s.colors || DEFAULT_SETTINGS.colors;
  const imgs = s.images || DEFAULT_SETTINGS.images;
  const cat = s.categories || DEFAULT_SETTINGS.categories;
  const pc = s.productCards || DEFAULT_SETTINGS.productCards;

  if (loading) {
    return <div className="text-center py-12 text-zinc-400">Загрузка...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Веб-сайт</h2>
          <p className="text-sm text-zinc-500 mt-1">Настройка внешнего вида и содержимого сайта-витрины</p>
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
            <h3 className="font-bold text-zinc-900 dark:text-white">SEO</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Заголовок страницы (title)</label>
                <input value={c.seo?.title || ''} onChange={e => update('common', 'seo.title', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Заголовок вкладки браузера (browser title)</label>
                <input value={c.seo?.browserTitle || ''} onChange={e => update('common', 'seo.browserTitle', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Мета-описание (meta description)</label>
                <textarea value={c.seo?.metaDescription || ''} onChange={e => update('common', 'seo.metaDescription', e.target.value)} rows={3}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 resize-none" />
              </div>
            </div>

            <h3 className="font-bold text-zinc-900 dark:text-white pt-4 border-t border-zinc-200 dark:border-zinc-700">Дополнительно</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Фид для агрегаторов</label>
                <input value={c.feed || ''} onChange={e => update('common', 'feed', e.target.value)} placeholder="URL фида"
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Дополнительные страницы (HTML)</label>
                <textarea value={c.additionalPages || ''} onChange={e => update('common', 'additionalPages', e.target.value)} rows={4}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 resize-none font-mono" placeholder="<section>...</section>" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Вставить свой код на сайт (HTML/JS)</label>
                <textarea value={c.customCode || ''} onChange={e => update('common', 'customCode', e.target.value)} rows={3}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 resize-none font-mono" placeholder="&lt;!-- счетчики, пиксели --&gt;" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-zinc-500 block mb-1">Дополнительные домены</label>
                <input value={c.domains || ''} onChange={e => update('common', 'domains', e.target.value)} placeholder="domain1.com, domain2.ru"
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800" />
              </div>
            </div>

            <h3 className="font-bold text-zinc-900 dark:text-white pt-4 border-t border-zinc-200 dark:border-zinc-700">Настройки отображения</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Шрифт на сайте</label>
                <select value={c.fontFamily} onChange={e => update('common', 'fontFamily', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800"
                  style={{ fontFamily: c.fontFamily }}>
                  {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Тип магазина</label>
                <select value={c.storeType} onChange={e => update('common', 'storeType', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {STORE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="showStores" checked={!!c.showStores} onChange={e => update('common', 'showStores', e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500" />
                <label htmlFor="showStores" className="text-sm text-zinc-700 dark:text-zinc-300">Показать список магазинов</label>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Препуск регистрации при оформлении заказа</label>
                <select value={c.guestRegistration} onChange={e => update('common', 'guestRegistration', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  <option value="allowed">Разрешён</option>
                  <option value="forbidden">Запрещён</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Colors */}
        {activeTab === 'colors' && (
          <div className="space-y-5">
            <h3 className="font-bold text-zinc-900 dark:text-white">Цветовая схема</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'backgroundColor', label: 'Цвет фона' },
                { key: 'primaryFillColor', label: 'Основной цвет заливки' },
                { key: 'primaryTextColor', label: 'Основной цвет текста' },
                { key: 'secondaryFillColor', label: 'Вторичный цвет заливки' },
                { key: 'secondaryTextColor', label: 'Вторичный цвет текста' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <input type="color" value={col[key] || '#000000'} onChange={e => update('colors', key, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer shrink-0" />
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500 block">{label}</label>
                    <input value={col[key] || ''} onChange={e => update('colors', key, e.target.value)}
                      className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>

            {/* Live color preview */}
            <div className="mt-4 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700" style={{ backgroundColor: col.backgroundColor }}>
              <div className="p-4 rounded-lg" style={{ backgroundColor: col.secondaryFillColor }}>
                <h4 style={{ color: col.primaryTextColor }} className="font-bold text-lg mb-2">Предпросмотр</h4>
                <p style={{ color: col.secondaryTextColor }} className="text-sm mb-3">Пример текста с текущей цветовой схемой.</p>
                <span style={{ backgroundColor: col.primaryFillColor, color: '#FFFFFF' }}
                  className="inline-block px-4 py-2 rounded-lg text-sm font-bold">Кнопка</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Images */}
        {activeTab === 'images' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Слайды</h3>
              <p className="text-xs text-zinc-500 mb-3">Формат: .jpg, .jpeg, .png. Рекомендуемый размер: 2048×1024 (16:9)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(imgs.slides || []).map((slide: string, idx: number) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 aspect-video bg-zinc-100 dark:bg-zinc-800">
                    <img src={slide} className="w-full h-full object-cover" />
                    <button onClick={() => removeSlide(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={addSlide}
                  className="aspect-video rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-blue-500 hover:border-blue-500 transition">
                  <Upload size={20} />
                  <span className="text-xs font-medium">Загрузить</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Горизонтальный логотип</h3>
              <p className="text-xs text-zinc-500 mb-3">Формат: .jpg, .jpeg, .png. Рекомендуемый размер: 1024×1024</p>
              <div className="flex items-center gap-3">
                {imgs.logoHorizontal && (
                  <div className="w-24 h-24 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0">
                    <img src={imgs.logoHorizontal} className="w-full h-full object-contain" />
                  </div>
                )}
                <button onClick={() => triggerUpload('logoHorizontal')}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <Upload size={14} /> {uploadingField === 'logoHorizontal' ? '...' : 'Загрузить'}
                </button>
                <input value={imgs.logoHorizontal || ''} onChange={e => update('images', 'logoHorizontal', e.target.value)} placeholder="Или URL"
                  className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
            </div>
          </div>
        )}

        {/* TAB: Categories */}
        {activeTab === 'categories' && (
          <div className="space-y-5">
            <h3 className="font-bold text-zinc-900 dark:text-white">Настройка отображения категорий</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="catShowPanelTop" checked={!!cat.showPanelTop} onChange={e => update('categories', 'showPanelTop', e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500" />
                <label htmlFor="catShowPanelTop" className="text-sm text-zinc-700 dark:text-zinc-300">Показать панель с категориями сверху</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="catShowCenter" checked={!!cat.showCenter} onChange={e => update('categories', 'showCenter', e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500" />
                <label htmlFor="catShowCenter" className="text-sm text-zinc-700 dark:text-zinc-300">Показать категории в центре</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="catBorder" checked={!!cat.border} onChange={e => update('categories', 'border', e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500" />
                <label htmlFor="catBorder" className="text-sm text-zinc-700 dark:text-zinc-300">Рамка</label>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Заполнение (padding, px)</label>
                <input type="number" value={cat.padding || ''} onChange={e => update('categories', 'padding', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Отступы (gap, px)</label>
                <input type="number" value={cat.gap || ''} onChange={e => update('categories', 'gap', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Расположение изображения</label>
                <select value={cat.imagePosition} onChange={e => update('categories', 'imagePosition', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {IMAGE_POSITIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Выравнивание названия по вертикали</label>
                <select value={cat.verticalAlign} onChange={e => update('categories', 'verticalAlign', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {ALIGN_VERT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Выравнивание названия по горизонтали</label>
                <select value={cat.horizontalAlign} onChange={e => update('categories', 'horizontalAlign', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {ALIGN_HORIZ.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Шрифт названий</label>
                <select value={cat.fontFamily} onChange={e => update('categories', 'fontFamily', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800"
                  style={{ fontFamily: cat.fontFamily }}>
                  {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Цвет текста</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={cat.textColor} onChange={e => update('categories', 'textColor', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer shrink-0" />
                  <input value={cat.textColor} onChange={e => update('categories', 'textColor', e.target.value)}
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-zinc-800" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Цвет рамки</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={cat.borderColor} onChange={e => update('categories', 'borderColor', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer shrink-0" />
                  <input value={cat.borderColor} onChange={e => update('categories', 'borderColor', e.target.value)}
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-zinc-800" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Products */}
        {activeTab === 'products' && (
          <div className="space-y-5">
            <h3 className="font-bold text-zinc-900 dark:text-white">Настройка карточек товаров</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Заполнение (padding, px)</label>
                <input type="number" value={pc.padding || ''} onChange={e => update('productCards', 'padding', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Расположение изображения</label>
                <select value={pc.imagePosition} onChange={e => update('productCards', 'imagePosition', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {IMAGE_POSITIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="prodBorder" checked={!!pc.border} onChange={e => update('productCards', 'border', e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500" />
                <label htmlFor="prodBorder" className="text-sm text-zinc-700 dark:text-zinc-300">Рамка</label>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Выравнивание названия по вертикали</label>
                <select value={pc.verticalAlign} onChange={e => update('productCards', 'verticalAlign', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {ALIGN_VERT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Выравнивание названия по горизонтали</label>
                <select value={pc.horizontalAlign} onChange={e => update('productCards', 'horizontalAlign', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800">
                  {ALIGN_HORIZ.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Шрифт названий</label>
                <select value={pc.fontFamily} onChange={e => update('productCards', 'fontFamily', e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800"
                  style={{ fontFamily: pc.fontFamily }}>
                  {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Цвет текста</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={pc.textColor} onChange={e => update('productCards', 'textColor', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer shrink-0" />
                  <input value={pc.textColor} onChange={e => update('productCards', 'textColor', e.target.value)}
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-zinc-800" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Цвет рамки</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={pc.borderColor} onChange={e => update('productCards', 'borderColor', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer shrink-0" />
                  <input value={pc.borderColor} onChange={e => update('productCards', 'borderColor', e.target.value)}
                    className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-zinc-800" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
    </div>
  );
}
