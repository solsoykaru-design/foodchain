import { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, Clock, Users, Package, Calendar, RefreshCw } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const RULE_TYPES = [
  { key: 'happy_hour', label: 'Happy Hour', icon: Clock },
  { key: 'segment', label: 'По сегменту клиентов', icon: Users },
  { key: 'low_stock', label: 'По остаткам', icon: Package },
  { key: 'event', label: 'Событие / акция', icon: Calendar },
];

export default function DynamicPricingPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [preview, setPreview] = useState<{dishId: number; base: number; stock: number; result: number | null}>({ dishId: 0, base: 0, stock: 100, result: null });

  const emptyForm = { name: '', type: 'happy_hour', config: { percent: -10, start_time: '14:00', end_time: '16:00', days: [1, 2, 3, 4, 5], segment_ids: [], threshold: 10, percent_change: 20, increase: false, start_date: '', end_date: '', dish_ids: [] }, priority: 0, is_active: true };
  const [form, setForm] = useState<any>(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, seg, d] = await Promise.all([api.getPricingRules(), api.getClientGroups().catch(() => []), api.getDishes().catch(() => [])]);
      setRules(r || []);
      setSegments(seg || []);
      setDishes(d || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await api.updatePricingRule(editing.id, form);
        addToast('Правило обновлено', 'success');
      } else {
        await api.createPricingRule(form);
        addToast('Правило создано', 'success');
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      loadData();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deletePricingRule(id);
      addToast('Правило удалено', 'success');
      loadData();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleToggle = async (rule: any) => {
    try {
      await api.updatePricingRule(rule.id, { ...rule, is_active: !rule.is_active });
      loadData();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const openEdit = (rule: any) => {
    setEditing(rule);
    setForm({ ...rule, config: typeof rule.config === 'string' ? JSON.parse(rule.config) : rule.config });
    setShowModal(true);
  };

  const runPreview = async () => {
    try {
      const res = await api.previewPricing(preview.dishId, preview.base, preview.stock);
      setPreview(p => ({ ...p, result: res.price }));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const updateConfig = (key: string, value: any) => {
    setForm({ ...form, config: { ...form.config, [key]: value } });
  };

  const typeLabel = (type: string) => RULE_TYPES.find(t => t.key === type)?.label || type;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center"><Tag className="text-white" size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Динамическое ценообразование</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Happy Hour, цены по сегментам, остаткам и событиям</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"><Plus size={16} /> Добавить правило</button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
        <h3 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2"><RefreshCw size={18} /> Проверка цены</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <select value={preview.dishId} onChange={e => setPreview({ ...preview, dishId: Number(e.target.value) })} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm">
            <option value={0}>Выберите блюдо</option>
            {dishes.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="number" value={preview.base} onChange={e => setPreview({ ...preview, base: Number(e.target.value) })} placeholder="Базовая цена" className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm w-32" />
          <input type="number" value={preview.stock} onChange={e => setPreview({ ...preview, stock: Number(e.target.value) })} placeholder="Остаток" className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm w-32" />
          <button onClick={runPreview} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600">Рассчитать</button>
          {preview.result !== null && <span className="text-lg font-bold text-green-600 dark:text-green-400">{preview.result.toLocaleString()} ₽</span>}
        </div>
      </div>

      {loading ? <div className="text-center py-12 text-zinc-400">Загрузка...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.length === 0 && <div className="col-span-full text-center py-12 text-zinc-400">Нет правил ценообразования</div>}
          {rules.map(rule => {
            const cfg = typeof rule.config === 'string' ? JSON.parse(rule.config) : rule.config;
            return (
              <div key={rule.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">{rule.name}</h3>
                    <p className="text-xs text-zinc-500">{typeLabel(rule.type)} · приоритет {rule.priority}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggle(rule)} className={`p-1.5 rounded-lg ${rule.is_active ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-500'}`}>{rule.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button>
                    <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs">Изм.</button>
                    <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                  {rule.type === 'happy_hour' && <p>{cfg.percent}% · {cfg.start_time}–{cfg.end_time} · {cfg.days?.map((d: number) => DAYS[d]).join(', ')}</p>}
                  {rule.type === 'segment' && <p>{cfg.percent}% · сегменты: {cfg.segment_ids?.map((id: number) => segments.find((s: any) => s.id === id)?.name || id).join(', ')}</p>}
                  {rule.type === 'low_stock' && <p>{cfg.increase ? '↑' : '↓'} {cfg.percent}% при остатке ≤ {cfg.threshold}</p>}
                  {rule.type === 'event' && <p>{cfg.percent}% · {cfg.start_date} — {cfg.end_date}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">{editing ? 'Редактировать' : 'Новое правило'}</h3>
            <div className="space-y-4">
              <div><label className="text-sm font-medium">Название</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div>
              <div><label className="text-sm font-medium">Тип</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm">
                {RULE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select></div>
              <div><label className="text-sm font-medium">Приоритет</label><input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div>

              {form.type === 'happy_hour' && (
                <>
                  <div className="grid grid-cols-2 gap-2"><div><label className="text-xs">С</label><input type="time" value={form.config.start_time} onChange={e => updateConfig('start_time', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div><div><label className="text-xs">До</label><input type="time" value={form.config.end_time} onChange={e => updateConfig('end_time', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div></div>
                  <div><label className="text-xs">Дни недели</label><div className="flex gap-2 mt-1">{DAYS.map((d, i) => <button key={i} onClick={() => updateConfig('days', (form.config.days || []).includes(i) ? (form.config.days || []).filter((x: number) => x !== i) : [...(form.config.days || []), i])} className={`w-8 h-8 rounded-lg text-xs ${(form.config.days || []).includes(i) ? 'bg-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'}`}>{d}</button>)}</div></div>
                </>
              )}

              {form.type === 'segment' && (
                <div><label className="text-xs">Сегменты</label><div className="space-y-1 mt-1">{segments.map((s: any) => <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(form.config.segment_ids || []).includes(s.id)} onChange={() => updateConfig('segment_ids', (form.config.segment_ids || []).includes(s.id) ? (form.config.segment_ids || []).filter((x: number) => x !== s.id) : [...(form.config.segment_ids || []), s.id])} /> {s.name}</label>)}</div></div>
              )}

              {form.type === 'low_stock' && (
                <>
                  <div><label className="text-xs">Порог остатка</label><input type="number" value={form.config.threshold} onChange={e => updateConfig('threshold', Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div>
                  <div className="flex items-center gap-2"><input id="increase" type="checkbox" checked={form.config.increase} onChange={e => updateConfig('increase', e.target.checked)} /><label htmlFor="increase" className="text-sm">Повышать цену (иначе — снижать)</label></div>
                </>
              )}

              {form.type === 'event' && (
                <div className="grid grid-cols-2 gap-2"><div><label className="text-xs">С</label><input type="date" value={form.config.start_date} onChange={e => updateConfig('start_date', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div><div><label className="text-xs">До</label><input type="date" value={form.config.end_date} onChange={e => updateConfig('end_date', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div></div>
              )}

              <div><label className="text-sm font-medium">Изменение цены, %</label><input type="number" value={form.config.percent} onChange={e => updateConfig('percent', Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm" /></div>
              <div><label className="text-xs">Блюда (если пусто — все)</label><select multiple value={form.config.dish_ids || []} onChange={e => updateConfig('dish_ids', Array.from(e.target.selectedOptions).map(o => Number(o.value)))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm h-24">
                {dishes.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
              <div className="flex items-center gap-2"><input id="is_active" type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /><label htmlFor="is_active" className="text-sm">Активно</label></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleSave} className="flex-1 bg-blue-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-600">Сохранить</button>
              <button onClick={() => setShowModal(false)} className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-2.5 rounded-xl text-sm font-medium">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
