import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { useTranslation } from 'react-i18next';
import { Search, Users, Pencil, X, Phone, MapPin, ShoppingBag, BadgePercent } from 'lucide-react';

export default function ClientsPage() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editClient, setEditClient] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', note: '' });

  const load = async () => {
    setLoading(true);
    try { setClients(await api.getClients(search)); } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

  const openEdit = (c: any) => {
    setEditClient(c);
    setEditForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', note: c.note || '' });
  };

  const saveEdit = async () => {
    if (!editClient) return;
    try {
      await api.updateClient(editClient.id, editForm);
      setEditClient(null);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('sidebar_clients_list')}</h2>
          <p className="text-sm text-zinc-500 mt-1">{clients.length} {t('clients_count')}</p>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('clients_search_placeholder')}
            className="w-72 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">{t('clients_loading')}</div>
      ) : clients.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
          <Users size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
          <p className="text-zinc-500">{t('clients_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1">{t('clients_empty_hint')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('clients_name')}</th>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('clients_phone')}</th>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">{t('clients_last_address')}</th>
                  <th className="text-right p-3 text-zinc-500 font-medium text-xs">{t('clients_orders')}</th>
                  <th className="text-right p-3 text-zinc-500 font-medium text-xs">{t('clients_sum')}</th>
                  <th className="text-right p-3 text-zinc-500 font-medium text-xs">{t('clients_date')}</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c: any) => (
                  <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="p-3 font-medium text-zinc-900 dark:text-white">{c.name}</td>
                    <td className="p-3 text-zinc-500">{c.phone}</td>
                    <td className="p-3 text-zinc-400 max-w-[200px] truncate">{c.lastAddress || '—'}</td>
                    <td className="p-3 text-right text-zinc-900 dark:text-white">{c.ordersCount}</td>
                    <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">{c.totalSpent?.toLocaleString()}₽</td>
                    <td className="p-3 text-right text-xs text-zinc-400">{c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('ru') : '—'}</td>
                    <td className="p-3">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg active:scale-[0.97]"><Pencil size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editClient && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditClient(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('clients_edit_title')}</h3>
              <button onClick={() => setEditClient(null)} className="p-2 text-zinc-400 hover:text-zinc-600 active:scale-[0.97]"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">{t('clients_name')}</label>
                <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">{t('clients_phone')}</label>
                <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">{t('clients_email')}</label>
                <input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">{t('clients_note')}</label>
                <textarea value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})} rows={3}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <button onClick={saveEdit}
                className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-600 active:scale-[0.97] transition-all">
                {t('staff_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}