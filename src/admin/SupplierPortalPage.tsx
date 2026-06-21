import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { addToast } from '../ToastContext';
import * as api from '../api';

export default function SupplierPortalPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [tab, setTab] = useState<'users' | 'products' | 'logs'>('users');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [form, setForm] = useState({ supplier_id: '', login: '', password: '', permissions: { prices: true, stock: true, orders: true, products: true } });

  const load = async () => {
    try {
      const [u, s, l] = await Promise.all([
        api.get('/api/admin/supplier-portal/users' + (filterSupplier ? `?supplier_id=${filterSupplier}` : '')),
        api.get('/api/suppliers'),
        api.get('/api/admin/supplier-portal/logs'),
      ]);
      setUsers(u); setSuppliers(s); setLogs(l);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  useEffect(() => { load(); }, [filterSupplier]);

  const openNew = () => { setEditingUser(null); setForm({ supplier_id: '', login: '', password: '', permissions: { prices: true, stock: true, orders: true, products: true } }); setShowModal(true); };
  const openEdit = (u: any) => { setEditingUser(u); setForm({ supplier_id: u.supplier_id, login: u.login, password: '', permissions: u.permissions || { prices: true, stock: true, orders: true, products: true } }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.supplier_id || !form.login) { addToast('Поставщик и логин обязательны', 'error'); return; }
    try {
      if (editingUser) {
        const body: any = { login: form.login, permissions: form.permissions };
        if (form.password) body.password = form.password;
        await api.put(`/api/admin/supplier-portal/users/${editingUser.id}`, body);
        addToast('Сохранено', 'success');
      } else {
        await api.post('/api/admin/supplier-portal/users', { supplier_id: Number(form.supplier_id), login: form.login, password: form.password, permissions: form.permissions });
        addToast('Пользователь создан', 'success');
      }
      setShowModal(false);
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить?')) return;
    try {
      await api.del(`/api/admin/supplier-portal/users/${id}`);
      addToast('Удалён', 'success');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Портал поставщика</h1>
        <div className="flex gap-2">
          <button onClick={() => { setTab('users'); }} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'users' ? 'bg-indigo-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>Пользователи</button>
          <button onClick={() => { setTab('products'); }} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'products' ? 'bg-indigo-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>Товары</button>
          <button onClick={() => { setTab('logs'); }} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'logs' ? 'bg-indigo-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>Логи</button>
        </div>
      </div>

      {tab === 'users' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm">
              <option value="">Все поставщики</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={openNew} className="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-600">+ Создать</button>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="text-left p-4">Логин</th><th className="text-left p-4">Поставщик</th><th className="text-left p-4">Статус</th><th className="text-left p-4">Права</th><th className="text-left p-4">Последний вход</th><th className="text-right p-4">Действия</th>
              </tr></thead>
              <tbody>{users.map(u => (
                <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="p-4 font-medium text-zinc-900 dark:text-white">{u.login}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{u.supplier_name}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{u.is_active ? 'Активен' : 'Заблокирован'}</span></td>
                  <td className="p-4 text-xs text-zinc-600 dark:text-zinc-400">{Object.entries(u.permissions || {}).filter(([,v]) => v).map(([k]) => ({ prices: 'Цены', stock: 'Остатки', orders: 'Заказы', products: 'Товары' }[k] || k)).join(', ')}</td>
                  <td className="p-4 text-zinc-500">{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => openEdit(u)} className="text-indigo-500 hover:text-indigo-700 text-xs font-semibold mr-3">Ред.</button>
                    <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Уд.</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'products' && <SupplierProductsSection suppliers={suppliers} />}
      {tab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left p-4">Время</th><th className="text-left p-4">Поставщик</th><th className="text-left p-4">Действие</th><th className="text-left p-4">Детали</th>
            </tr></thead>
            <tbody>{logs.map(l => (
              <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="p-4 text-zinc-500 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-4 font-medium text-zinc-900 dark:text-white">{l.supplier_name}</td>
                <td className="p-4"><span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs text-zinc-600 dark:text-zinc-400">{l.action}</span></td>
                <td className="p-4 text-zinc-500 text-xs">{l.details}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">{editingUser ? 'Редактировать' : 'Создать'} пользователя</h2>
            <div className="space-y-3">
              <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm">
                <option value="">Выберите поставщика</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} placeholder="Логин" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm" />
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editingUser ? 'Новый пароль (оставьте пустым)' : 'Пароль'} type="password" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm" />
              <div><label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">Права доступа</label>
                <div className="grid grid-cols-2 gap-2">{Object.entries(form.permissions).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={v as boolean} onChange={e => setForm(f => ({ ...f, permissions: { ...f.permissions, [k]: e.target.checked } }))} className="rounded" />
                    {{ prices: 'Цены', stock: 'Остатки', orders: 'Заказы', products: 'Товары' }[k] || k}
                  </label>
                ))}</div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Отмена</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierProductsSection({ suppliers }: { suppliers: any[] }) {
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ product_id: '', price: '' });

  useEffect(() => {
    if (!selectedSupplier) { setProducts([]); return; }
    api.get(`/api/admin/supplier-portal/products/${selectedSupplier}`).then(setProducts).catch(() => {});
    api.get('/api/inventory-items').then(r => setAllItems(r.items || [])).catch(() => {});
  }, [selectedSupplier]);

  const handleAdd = async () => {
    if (!addForm.product_id || !addForm.price) return;
    try {
      await api.post('/api/admin/supplier-portal/products', { supplier_id: Number(selectedSupplier), product_id: Number(addForm.product_id), price: Number(addForm.price) });
      setShowAdd(false); setAddForm({ product_id: '', price: '' });
      const p = await api.get(`/api/admin/supplier-portal/products/${selectedSupplier}`);
      setProducts(p);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleRemove = async (id: number) => {
    if (!confirm('Удалить товар из каталога поставщика?')) return;
    try {
      await api.del(`/api/admin/supplier-portal/products/${id}`);
      setProducts(products.filter(p => p.link_id !== id));
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm">
          <option value="">Выберите поставщика</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {selectedSupplier && <button onClick={() => setShowAdd(true)} className="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">+ Добавить товар</button>}
      </div>
      {selectedSupplier && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left p-4">Товар</th><th className="text-left p-4">Ед.</th><th className="text-left p-4">Цена</th><th className="text-left p-4">Остаток у поставщика</th><th className="text-right p-4"></th>
            </tr></thead>
            <tbody>{products.map(p => (
              <tr key={p.link_id || p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="p-4 font-medium text-zinc-900 dark:text-white">{p.name}</td>
                <td className="p-4 text-zinc-500">{p.unit}</td>
                <td className="p-4 text-zinc-700 dark:text-zinc-300">{p.price ? `${p.price} ₽` : '—'}</td>
                <td className="p-4 text-zinc-500">{p.supplier_quantity ?? '—'}</td>
                <td className="p-4 text-right"><button onClick={() => handleRemove(p.link_id)} className="text-red-500 hover:text-red-700 text-xs">Убрать</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Добавить товар</h2>
            <div className="space-y-3">
              <select value={addForm.product_id} onChange={e => setAddForm(f => ({ ...f, product_id: e.target.value }))} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm">
                <option value="">Выберите товар</option>
                {allItems.filter(i => !products.find(p => p.id === i.id)).map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </select>
              <input value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} placeholder="Цена" type="number" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Отмена</button>
              <button onClick={handleAdd} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600">Добавить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
