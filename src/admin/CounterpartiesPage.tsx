import { useEffect, useState } from 'react';
import { Handshake, Plus, Pencil, Trash2, Search } from 'lucide-react';
import * as api from '../api';
import AddContragentModal from './AddContragentModal';
import { addToast } from '../ToastContext';

interface Contragent {
  id: number;
  companyName: string;
  fullName: string;
  type: 'ip' | 'legal';
  inn?: string;
  phone?: string;
  email?: string;
}

export default function CounterpartiesPage() {
  const [list, setList] = useState<Contragent[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const data = await api.getContragents(q || undefined);
      setList(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить контрагента?')) return;
    setDeleting(id);
    try {
      await api.deleteContragent(id);
      setList(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      addToast(e.message || 'Ошибка удаления', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
            <Handshake size={22} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Контрагенты</h1>
            <p className="text-sm text-zinc-500">Поставщики и подрядчики</p>
          </div>
        </div>
        <button onClick={() => { setEditItem(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition active:scale-[0.97]">
          <Plus size={18} /> Добавить
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию, ИНН..."
          className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400" />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left">
              <th className="pb-3 font-semibold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Компания</th>
              <th className="pb-3 font-semibold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Тип</th>
              <th className="pb-3 font-semibold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">ИНН</th>
              <th className="pb-3 font-semibold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Телефон</th>
              <th className="pb-3 font-semibold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Email</th>
              <th className="pb-3 font-semibold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider w-24">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-zinc-400">Загрузка...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-zinc-400">Контрагенты не найдены</td></tr>
            ) : list.map(c => (
              <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                <td className="py-3.5 pr-4">
                  <p className="font-medium text-zinc-900 dark:text-white">{c.companyName}</p>
                  <p className="text-xs text-zinc-400">{c.fullName}</p>
                </td>
                <td className="py-3.5 pr-4">
                  <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-medium ${
                    c.type === 'ip' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {c.type === 'ip' ? 'ИП' : 'Юр. лицо'}
                  </span>
                </td>
                <td className="py-3.5 pr-4 text-zinc-700 dark:text-zinc-300">{c.inn || '—'}</td>
                <td className="py-3.5 pr-4 text-zinc-700 dark:text-zinc-300">{c.phone || '—'}</td>
                <td className="py-3.5 pr-4 text-zinc-700 dark:text-zinc-300">{c.email || '—'}</td>
                <td className="py-3.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditItem(c); setShowModal(true); }}
                      className="p-2 text-zinc-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                      className="p-2 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddContragentModal
          contragent={editItem}
          onClose={() => setShowModal(false)}
          onSaved={() => load(search)}
        />
      )}
    </div>
  );
}
