import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { Building2, Globe, DollarSign, Plus, Trash2, Edit3, CheckCircle } from 'lucide-react';

type Tab = 'networks' | 'global_menu' | 'royalty';

export default function FranchisingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('networks');

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'networks', label: 'Сети', icon: Building2 },
    { id: 'global_menu', label: 'Глобальное меню', icon: Globe },
    { id: 'royalty', label: 'Роялти', icon: DollarSign },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
          <Building2 size={22} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Франчайзинг</h1>
          <p className="text-sm text-zinc-500">Управление франчайзинговой сетью</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-700">
        {tabs.map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all active:scale-[0.97] ${
              tab === tabItem.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}>
            <tabItem.icon size={16} />
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === 'networks' && <NetworksTab />}
      {tab === 'global_menu' && <GlobalMenuTab />}
      {tab === 'royalty' && <RoyaltyTab />}
    </div>
  );
}

function NetworksTab() {
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', manager_id: '', royalty_percent: '' });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getFranchiseNetworks();
      setNetworks(data);
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', manager_id: '', royalty_percent: '' });
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditId(item.id);
    setForm({ name: item.name, manager_id: String(item.manager_id || ''), royalty_percent: String(item.royalty_percent || '') });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return addToast('Введите название сети', 'error');
    try {
      const payload: any = { name: form.name };
      if (form.manager_id) payload.manager_id = Number(form.manager_id);
      if (form.royalty_percent) payload.royalty_percent = Number(form.royalty_percent);
      if (editId) {
        await api.updateFranchiseNetwork(editId, payload);
      } else {
        await api.createFranchiseNetwork(payload);
      }
      setShowModal(false);
      load();
      addToast(editId ? 'Сеть обновлена' : 'Сеть создана', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить франчайзинговую сеть?')) return;
    try {
      await api.deleteFranchiseNetwork(id);
      load();
      addToast('Сеть удалена', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div>
      <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-[0.97] transition-all mb-5">
        <Plus size={18} /> Добавить сеть
      </button>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Загрузка...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Название</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Менеджер</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Роялти %</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Дата создания</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody>
              {networks.map((item: any) => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{item.manager_name || item.manager_id || '-'}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{item.royalty_percent ?? '-'}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><Edit3 size={15} /></button>
                      <button onClick={() => remove(item.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {networks.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-zinc-400">Нет франчайзинговых сетей</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editId ? 'Редактировать сеть' : 'Добавить сеть'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600"><Trash2 size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Название</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">ID менеджера</label>
                <input type="number" value={form.manager_id} onChange={e => setForm({...form, manager_id: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Роялти %</label>
                <input type="number" step="0.01" value={form.royalty_percent} onChange={e => setForm({...form, royalty_percent: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <button onClick={save}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-700 active:scale-[0.97] transition-all">
                {editId ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalMenuTab() {
  const [networks, setNetworks] = useState<any[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<number | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', price: '', tech_card_id: '' });

  useEffect(() => {
    api.getFranchiseNetworks().then(data => {
      setNetworks(data);
      if (data.length > 0) setSelectedNetworkId(data[0].id);
    }).catch(() => {});
  }, []);

  const loadItems = async () => {
    if (!selectedNetworkId) return;
    setLoading(true);
    try {
      const data = await api.getGlobalMenuItems(selectedNetworkId);
      setItems(data);
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedNetworkId) loadItems(); }, [selectedNetworkId]);

  const openAdd = () => {
    setForm({ name: '', category: '', price: '', tech_card_id: '' });
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!form.name.trim()) return addToast('Введите название блюда', 'error');
    try {
      await api.createGlobalMenuItem({ ...form, network_id: selectedNetworkId, price: Number(form.price), tech_card_id: form.tech_card_id ? Number(form.tech_card_id) : undefined });
      setShowModal(false);
      loadItems();
      addToast('Блюдо добавлено в глобальное меню', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const removeItem = async (id: number) => {
    if (!confirm('Удалить блюдо из глобального меню?')) return;
    try {
      await api.deleteGlobalMenuItem(id);
      loadItems();
      addToast('Блюдо удалено', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div>
      {networks.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">Сначала создайте франчайзинговую сеть</div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5">
            <label className="text-sm font-medium text-zinc-500">Сеть:</label>
            <select value={selectedNetworkId ?? ''} onChange={e => setSelectedNetworkId(Number(e.target.value))}
              className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
              {networks.map((n: any) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-[0.97] transition-all ml-auto">
              <Plus size={18} /> Добавить блюдо
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-400">Загрузка...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Название</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Категория</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Базовая цена</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">ID техкарты</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => (
                    <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{item.category || '-'}</td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{item.price ?? '-'}</td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{item.tech_card_id ?? '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => removeItem(item.id)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.97]"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-zinc-400">Нет блюд в глобальном меню</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Добавить блюдо в глобальное меню</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600"><Trash2 size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Название</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Категория</label>
                <input value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Базовая цена</label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">ID техкарты</label>
                <input type="number" value={form.tech_card_id} onChange={e => setForm({...form, tech_card_id: e.target.value})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <button onClick={saveItem}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-700 active:scale-[0.97] transition-all">
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoyaltyTab() {
  const [networks, setNetworks] = useState<any[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [period, setPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

  useEffect(() => {
    api.getFranchiseNetworks().then(data => {
      setNetworks(data);
      if (data.length > 0) setSelectedNetworkId(data[0].id);
    }).catch(() => {});
  }, []);

  const loadInvoices = async () => {
    if (!selectedNetworkId) return;
    setLoading(true);
    try {
      const data = await api.getRoyaltyInvoices(selectedNetworkId);
      setInvoices(data);
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedNetworkId) loadInvoices(); }, [selectedNetworkId]);

  const generateInvoices = async () => {
    if (!selectedNetworkId) return;
    try {
      const periodStr = `${period.year}-${String(period.month).padStart(2, '0')}`;
      await api.generateRoyaltyInvoices(selectedNetworkId, periodStr);
      setShowPeriodPicker(false);
      loadInvoices();
      addToast('Счета созданы', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const markPaid = async (invoiceId: number) => {
    try {
      await api.markRoyaltyPaid(invoiceId);
      loadInvoices();
      addToast('Счёт отмечен как оплаченный', 'success');
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div>
      {networks.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">Сначала создайте франчайзинговую сеть</div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5">
            <label className="text-sm font-medium text-zinc-500">Сеть:</label>
            <select value={selectedNetworkId ?? ''} onChange={e => setSelectedNetworkId(Number(e.target.value))}
              className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
              {networks.map((n: any) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <button onClick={() => setShowPeriodPicker(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-[0.97] transition-all ml-auto">
              <Plus size={18} /> Создать счета за период
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-400">Загрузка...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Франчайзи</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Период</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Сумма</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Статус</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Дата оплаты</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium">{inv.tenant_name || '-'}</td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{inv.period || '-'}</td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{inv.amount ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        }`}>
                          {inv.status === 'paid' ? <CheckCircle size={12} /> : null}
                          {inv.status === 'paid' ? 'Оплачен' : 'Ожидает'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        {inv.status !== 'paid' && (
                          <button onClick={() => markPaid(inv.id)} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-[0.97] transition-all">
                            <CheckCircle size={14} /> Оплачено
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-zinc-400">Нет счетов</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showPeriodPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPeriodPicker(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">Создать счета за период</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Месяц</label>
                <select value={period.month} onChange={e => setPeriod({...period, month: Number(e.target.value)})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Год</label>
                <input type="number" value={period.year} onChange={e => setPeriod({...period, year: Number(e.target.value)})}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <button onClick={generateInvoices}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-700 active:scale-[0.97] transition-all">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
