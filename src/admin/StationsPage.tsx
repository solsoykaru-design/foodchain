import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { Plus, Pencil, Trash2, X, GripVertical, ChefHat, Printer, Palette, Search, ArrowUp, ArrowDown, Flame, Snowflake, Coffee, Croissant, UtensilsCrossed } from 'lucide-react';
import { addToast } from '../ToastContext';

interface Station {
  id: number;
  name: string;
  description: string;
  printerId?: number | null;
  printerName?: string;
  sortOrder: number;
  color: string;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c', '#475569', '#0f172a',
];

const PRESET_ICONS: Record<string, React.ReactNode> = {
  'Холодная': <Snowflake size={18} />,
  'Горячая': <Flame size={18} />,
  'Бар': <Coffee size={18} />,
  'Выпечка': <Croissant size={18} />,
  'Мангал': <UtensilsCrossed size={18} />,
};

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Station | null>(null);
  const [form, setForm] = useState<Partial<Station>>({ name: '', description: '', color: '#f97316', printerId: null, sortOrder: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        api.getStations().catch(() => []),
        api.request('/api/pos/printers').catch(() => []),
      ]);
      setStations((s || []).sort((a: Station, b: Station) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id));
      setPrinters(p || []);
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', color: '#f97316', printerId: null, sortOrder: stations.length });
    setShowForm(true);
  };

  const openEdit = (s: Station) => {
    setEditing(s);
    setForm({ ...s });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { addToast('Введите название станции', 'warning'); return; }
    try {
      const payload = {
        name: form.name,
        description: form.description || '',
        printerId: form.printerId || null,
        printerName: printers.find(p => p.id === form.printerId)?.name || '',
        sortOrder: form.sortOrder || 0,
        color: form.color || '#f97316',
      };
      if (editing) {
        await api.updateStation(editing.id, payload);
      } else {
        await api.createStation(payload);
      }
      setShowForm(false);
      load();
      addToast(editing ? 'Станция обновлена' : 'Станция создана', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Удалить станцию "${name}"?`)) return;
    try {
      await api.deleteStation(id);
      load();
      addToast('Станция удалена', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= stations.length) return;
    const updated = [...stations];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    updated.forEach((s, i) => s.sortOrder = i);
    setStations(updated);
    try {
      await Promise.all(updated.map((s, i) => api.updateStation(s.id, { sortOrder: i })));
      addToast('Порядок сохранён', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const filtered = stations.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.description || '').toLowerCase().includes(search.toLowerCase()));

  const getIcon = (name: string) => {
    for (const key of Object.keys(PRESET_ICONS)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return PRESET_ICONS[key];
    }
    return <ChefHat size={18} />;
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <ChefHat className="text-orange-500" /> Станции кухни
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Настройте рабочие станции для автоматического разбиения заказов</p>
        </div>
        <button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition active:scale-[0.97]">
          <Plus size={18} /> Добавить станцию
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск станций..." className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-zinc-100 dark:bg-zinc-800 border border-transparent outline-none" />
          </div>
          <span className="text-xs text-zinc-500">{filtered.length} станций</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-zinc-500">Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ChefHat size={48} className="text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 font-medium">Нет станций</p>
            <p className="text-xs text-zinc-400 mt-1">Добавьте первую станцию, чтобы начать разбиение заказов</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((s, idx) => (
              <div key={s.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition group">
                <div className="text-zinc-300 dark:text-zinc-600 cursor-grab"><GripVertical size={18} /></div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: s.color || '#f97316' }}>
                  {getIcon(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-zinc-900 dark:text-white">{s.name}</h3>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">#{s.id}</span>
                  </div>
                  {s.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{s.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                    {s.printerName ? <span className="flex items-center gap-1 text-blue-500"><Printer size={12} /> {s.printerName}</span> : <span className="flex items-center gap-1"><Printer size={12} /> Без принтера</span>}
                    <span>Порядок: {s.sortOrder}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === filtered.length - 1} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30"><ArrowDown size={16} /></button>
                  <button onClick={() => openEdit(s)} className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(s.id, s.name)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{editing ? 'Редактировать станцию' : 'Новая станция'}</h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Название</label>
                <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Например, Горячая" className="w-full mt-1 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Описание</label>
                <input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Необязательно" className="w-full mt-1 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Принтер</label>
                <select value={form.printerId || ''} onChange={e => setForm({ ...form, printerId: e.target.value ? Number(e.target.value) : null })} className="w-full mt-1 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none">
                  <option value="">Без принтера</option>
                  {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-2 block">Цвет станции</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setForm({ ...form, color: c })} className={`w-8 h-8 rounded-full border-2 transition ${form.color === c ? 'border-zinc-900 dark:border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-sm transition">{editing ? 'Сохранить' : 'Создать'}</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">Отмена</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
