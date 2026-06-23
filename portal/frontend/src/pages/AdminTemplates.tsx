import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Check, Edit3 } from 'lucide-react';

export function AdminTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', categories: '', menu_items: '', roles: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.getTemplates()
      .then(t => setTemplates(t.map((x: any) => ({
        ...x,
        categories: Array.isArray(x.categories) ? x.categories : JSON.parse(x.categories || '[]'),
        menu_items: Array.isArray(x.menu_items) ? x.menu_items : JSON.parse(x.menu_items || '[]'),
        roles: Array.isArray(x.roles) ? x.roles : JSON.parse(x.roles || '[]'),
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const data = {
      ...form,
      categories: form.categories.split('\n').filter(Boolean),
      menu_items: form.menu_items.split('\n').filter(Boolean),
      roles: form.roles.split('\n').filter(Boolean),
    };
    try {
      if (editId) {
        await api.updateTemplate(editId, data);
      } else {
        await api.createTemplate(data);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', code: '', description: '', categories: '', menu_items: '', roles: '' });
      load();
    } catch (err: any) { setError(err.message); }
  };

  const startEdit = (t: any) => {
    setForm({
      name: t.name, code: t.code, description: t.description || '',
      categories: (t.categories || []).join('\n'),
      menu_items: (t.menu_items || []).join('\n'),
      roles: (t.roles || []).join('\n'),
    });
    setEditId(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить шаблон?')) return;
    await api.deleteTemplate(id);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Шаблоны ресторанов</h1>
        <button onClick={() => { setEditId(null); setForm({ name: '', code: '', description: '', categories: '', menu_items: '', roles: '' }); setShowForm(true); }}
          className="bg-zinc-900 text-white font-medium px-4 py-2 rounded-xl hover:bg-zinc-800 transition text-sm flex items-center gap-2">
          <Plus size={16} /> Создать шаблон
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editId ? 'Редактировать' : 'Создать'} шаблон</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl mb-3">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Название *"
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} required placeholder="Код (pizzeria, sushi, ...) *"
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Описание"
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" />
              <textarea value={form.categories} onChange={e => setForm(p => ({ ...p, categories: e.target.value }))} placeholder="Категории блюд (каждая с новой строки)" rows={3}
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              <textarea value={form.menu_items} onChange={e => setForm(p => ({ ...p, menu_items: e.target.value }))} placeholder="Примеры блюд (каждое с новой строки)" rows={3}
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              <textarea value={form.roles} onChange={e => setForm(p => ({ ...p, roles: e.target.value }))} placeholder="Роли сотрудников (каждая с новой строки)" rows={2}
                className="w-full px-4 py-2 border border-zinc-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition">
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse text-zinc-400 text-center py-12">Загрузка...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-zinc-900">{t.name}</h3>
                  <p className="text-xs text-zinc-500">{t.code} · {t.description || '—'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(t)} className="p-1.5 text-zinc-400 hover:text-orange-500 transition"><Edit3 size={15} /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 text-zinc-400 hover:text-red-500 transition"><X size={15} /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(t.categories || []).map((c: string) => <span key={c} className="text-[11px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{c}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
