import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Upload, FlaskConical, Plus } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import TechCardModal from './TechCardModal';

interface MenuItem {
  id: number; name: string; imageUrl: string; barcode?: string; article?: string;
  weight: number; netto: number; unit: string; categoryId: number; categoryName?: string;
  type: string; isAvailable: boolean; price: number; cost: number; markup: number;
  techCardId?: number;
}

interface Category { id: number; name: string; }

interface Props {
  item?: MenuItem;
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = {
  id: 0, name: '', imageUrl: '', barcode: '', article: '',
  weight: 0, netto: 0, unit: 'г', categoryId: 0,
  type: 'goods', isAvailable: true, price: 0, cost: 0, markup: 0,
};

export default function MenuItemCard({ item: initial, onClose, onSaved }: Props) {
  const isEdit = !!initial;
  const [form, setForm] = useState<MenuItem>(initial || { ...emptyForm } as MenuItem);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cats, setCats] = useState<Category[]>([]);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [showTechCard, setShowTechCard] = useState(false);

  useEffect(() => { api.getMenuCategories().then(setCats).catch(() => {}); }, []);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setImageBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name) { setError('Введите название'); return; }
    setSaving(true);
    setError('');
    try {
      let imageUrl = form.imageUrl;
      if (imageBase64) {
        try {
          const uploaded = await api.uploadImage(imageBase64, 'dishes');
          imageUrl = uploaded.url;
        } catch {}
      }
      const payload: any = {
        name: form.name,
        price: form.price,
        barcode: form.barcode,
        article: form.article,
        weight: form.weight || form.netto,
        netto: form.netto || form.weight,
        unit: form.unit || 'г',
        category_id: form.categoryId || null,
        type: form.type || 'goods',
        is_available: form.isAvailable ? 1 : 0,
        image_url: imageUrl,
        cost: form.cost || 0,
      };
      if (isEdit) {
        await api.updateDish(form.id, payload);
      } else {
        await api.createDish(payload);
      }
      onSaved();
    } catch (e: any) { setError(e.message || 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const fld = "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30";
  const lbl = "text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 block";

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-[580px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            {isEdit ? `Редактирование: ${form.name}` : 'Новый элемент меню'}
          </h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className={lbl}>Название *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Название блюда" className={fld} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Цена *</label>
              <input type="number" step="0.01" value={form.price || ''} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))} className={fld} />
            </div>
            <div>
              <label className={lbl}>Себестоимость</label>
              <input type="number" step="0.01" value={form.cost || ''} onChange={e => setForm(p => ({ ...p, cost: Number(e.target.value) }))} className={fld} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Артикул</label>
              <input value={form.article || ''} onChange={e => setForm(p => ({ ...p, article: e.target.value }))} placeholder="Внутренний артикул" className={fld} />
            </div>
            <div>
              <label className={lbl}>Штрихкод</label>
              <input value={form.barcode || ''} onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))} placeholder="14 символов" maxLength={14} className={fld} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Выход (Нетто)</label>
              <input type="number" step="0.001" value={form.netto || form.weight || ''} onChange={e => setForm(p => ({ ...p, netto: Number(e.target.value), weight: Number(e.target.value) }))} className={fld} />
            </div>
            <div>
              <label className={lbl}>Ед. изм.</label>
              <select value={form.unit || 'г'} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className={fld}>
                <option value="г">г</option>
                <option value="кг">кг</option>
                <option value="мл">мл</option>
                <option value="л">л</option>
                <option value="шт">шт</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Категория</label>
              <select value={form.categoryId || ''} onChange={e => setForm(p => ({ ...p, categoryId: Number(e.target.value) }))} className={fld}>
                <option value="">Без категории</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Тип</label>
              <select value={form.type || 'goods'} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className={fld}>
                <option value="goods">Товар</option>
                <option value="service">Услуга</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Техкарта</label>
              <div className="flex items-center gap-2 h-[38px]">
                {form.techCardId ? (
                  <button onClick={() => setShowTechCard(true)}
                    className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition">
                    <FlaskConical size={14} /> Техкарта #{form.techCardId}
                  </button>
                ) : (
                  <span className="text-sm text-zinc-400">Не назначена</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
              <input type="checkbox" checked={form.isAvailable} onChange={e => setForm(p => ({ ...p, isAvailable: e.target.checked }))}
                className="rounded border-zinc-300 dark:border-zinc-600 accent-blue-500" />
              Активно
            </label>
          </div>

          <div>
            <label className={lbl}>Изображение</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition border border-zinc-200/50 dark:border-zinc-700">
                <Upload size={14} /> Загрузить
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
              {(imageBase64 || form.imageUrl) && (
                <div className="relative">
                  <img src={imageBase64 || form.imageUrl} alt="preview" className="w-14 h-14 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2">
            <span>Наценка: <strong className="text-zinc-700 dark:text-zinc-300">{form.price > 0 ? (((form.price - (form.cost || 0)) / form.price) * 100).toFixed(1) : '0.0'}%</strong></span>
            <span>ID: <strong className="text-zinc-700 dark:text-zinc-300">{form.id || 'Новый'}</strong></span>
            <span>Тип: <strong className="text-zinc-700 dark:text-zinc-300">{form.type === 'service' ? 'Услуга' : 'Товар'}</strong></span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">Отмена</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition active:scale-[0.97]">
            {saving ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Создать'}
          </button>
        </div>
      </div>
      {showTechCard && form.id > 0 && (
        <TechCardModal
          dishId={form.id}
          dishName={form.name}
          dishPrice={form.price}
          onClose={() => setShowTechCard(false)}
        />
      )}
    </div>
  );
}
