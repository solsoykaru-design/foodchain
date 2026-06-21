import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Globe, Plus, X, Check } from 'lucide-react';

export default function LanguagesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '' });

  useEffect(() => {
    api.request('/api/languages').then(setItems).catch(() => setItems([
      { id: 1, name: 'Русский', code: 'ru', isActive: true },
      { id: 2, name: 'Английский', code: 'en', isActive: true },
    ]));
  }, []);

  const saveAll = async () => {
    try {
      await api.request('/api/languages-page-data', { method: 'PUT', body: JSON.stringify({ items }) });
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const addItem = async () => {
    if (!form.name.trim() || !form.code.trim()) return addToast('Заполните все поля', 'error');
    try {
      const r = await api.request('/api/languages', { method: 'POST', body: JSON.stringify({ name: form.name, code: form.code }) });
      setItems(prev => [...prev, { id: r.id, name: form.name, code: form.code, isActive: true }]);
      setForm({ name: '', code: '' });
      setShowForm(false);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const toggleActive = async (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    try {
      await api.request(`/api/languages/${id}`, { method: 'PUT', body: JSON.stringify({ isActive: !item.isActive }) });
      setItems(prev => prev.map(item => item.id === id ? { ...item, isActive: !item.isActive } : item));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить язык?')) return;
    try {
      await api.request(`/api/languages/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center">
          <Globe size={22} className="text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Языки</h1>
          <p className="text-sm text-zinc-500">Управление языками интерфейса</p>
        </div>
      </div>

      {showForm && (
        <div className="border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-5 space-y-3 bg-blue-50/50 dark:bg-blue-900/10">
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Название языка"
            className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Код (ru, en, uz...)"
            className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          <div className="flex gap-2">
            <button onClick={addItem} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-[0.97] transition-all">Добавить</button>
            <button onClick={() => setShowForm(false)} className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-4 py-2 rounded-xl text-sm font-bold active:scale-[0.97] transition-all">Отмена</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Название</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Код</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Активен</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <button onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 active:scale-[0.97] transition-all">
                  <Plus size={14} /> Добавить
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 uppercase">{item.code}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${
                      item.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}>
                    {item.isActive ? <Check size={12} /> : <X size={12} />}
                    {item.isActive ? 'Да' : 'Нет'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(item.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><X size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-zinc-400">Нет языков</div>
      )}

      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-right text-sm text-zinc-500">
        Всего языков: {items.length}
      </div>
    </div>
  );
}
