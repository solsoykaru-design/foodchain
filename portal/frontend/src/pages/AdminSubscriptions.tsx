import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Search, Filter, Check, X, Clock, AlertCircle, Eye, XCircle } from 'lucide-react';

export function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewMonths, setRenewMonths] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (providerFilter) params.provider = providerFilter;
      const data = await api.adminGetSubscriptions(params);
      setSubscriptions(data);
    } catch (err) { setMessage('Ошибка загрузки'); }
    setLoading(false);
  };

  useEffect(() => { fetchSubs(); }, [statusFilter, providerFilter]);

  const handleStatusChange = async (subId: number, status: string) => {
    if (!confirm(`Изменить статус подписки #${subId} на "${status}"?`)) return;
    setActionLoading(true);
    try {
      await api.adminUpdateSubscriptionStatus(subId, { status });
      fetchSubs();
      setMessage(`Статус подписки #${subId} изменён на "${status}"`);
    } catch (err: any) { setMessage(err.message || 'Ошибка'); }
    setActionLoading(false);
  };

  const handleRenew = async () => {
    if (!selectedSub) return;
    setActionLoading(true);
    try {
      await api.adminRenewSubscription(selectedSub.id, renewMonths);
      setShowRenewModal(false);
      fetchSubs();
      setMessage(`Подписка #${selectedSub.id} продлена на ${renewMonths} мес.`);
    } catch (err: any) { setMessage(err.message || 'Ошибка'); }
    setActionLoading(false);
  };

  const viewPayments = async (sub: any) => {
    setSelectedSub(sub);
    try {
      const data = await api.adminGetTenantPayments(sub.tenant_id);
      setPayments(data);
    } catch { setPayments([]); }
  };

  const filtered = subscriptions.filter(s =>
    !search || s.tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.tenant_email?.toLowerCase().includes(search.toLowerCase()) ||
    s.tariff_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      pending: 'bg-amber-100 text-amber-700',
      paused: 'bg-orange-100 text-orange-700',
      expired: 'bg-red-100 text-red-700',
      canceled: 'bg-zinc-100 text-zinc-500',
    };
    const label: Record<string, string> = {
      active: 'Активна', pending: 'Ожидает', paused: 'Приостановлена',
      expired: 'Истекла', canceled: 'Отменена',
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-zinc-100'}`}>{label[status] || status}</span>;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Управление подписками</h1>

      {message && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-blue-50 text-blue-700 flex items-center gap-2">
          <AlertCircle size={16} /> {message}
          <button onClick={() => setMessage('')} className="ml-auto"><XCircle size={14} /></button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по арендатору или тарифу..."
            className="w-full border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-sm" />
        </div>
        <div className="flex gap-1">
          {['', 'active', 'pending', 'paused', 'expired', 'canceled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${statusFilter === s ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
              {s ? (s === 'active' ? 'Активные' : s === 'pending' ? 'Ожидают' : s === 'paused' ? 'Приостановлены' : s === 'expired' ? 'Истекли' : 'Отменены') : 'Все'}
            </button>
          ))}
        </div>
        <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)}
          className="border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-600 bg-white">
          <option value="">Все провайдеры</option>
          <option value="payme">Payme</option>
          <option value="yookassa">ЮKassa</option>
          <option value="cloudpayments">CloudPayments</option>
          <option value="tbank">Т-Банк</option>
        </select>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="text-left p-3 text-zinc-500 font-medium text-xs">Арендатор</th>
              <th className="text-left p-3 text-zinc-500 font-medium text-xs">Тариф</th>
              <th className="text-left p-3 text-zinc-500 font-medium text-xs">Статус</th>
              <th className="text-left p-3 text-zinc-500 font-medium text-xs">Провайдер</th>
              <th className="text-left p-3 text-zinc-500 font-medium text-xs">Окончание</th>
              <th className="text-left p-3 text-zinc-500 font-medium text-xs">Автопродление</th>
              <th className="text-left p-3 text-zinc-500 font-medium text-xs">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-zinc-400">Загрузка...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-zinc-400">Нет подписок</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="p-3">
                  <div className="font-medium text-zinc-900">{s.tenant_name}</div>
                  <div className="text-xs text-zinc-400">{s.tenant_email}</div>
                </td>
                <td className="p-3 font-medium">{s.tariff_name}</td>
                <td className="p-3">{statusBadge(s.status)}</td>
                <td className="p-3 text-xs">
                  <span className="font-medium text-zinc-600">
                    {s.provider === 'payme' ? 'Payme' : s.provider === 'yookassa' ? 'ЮKassa' : s.provider === 'cloudpayments' ? 'CloudPayments' : s.provider === 'tbank' ? 'Т-Банк' : '—'}
                  </span>
                </td>
                <td className="p-3 text-xs text-zinc-500">
                  {s.end_date ? new Date(s.end_date).toLocaleDateString('ru-RU') : '—'}
                </td>
                <td className="p-3">
                  {s.auto_renew ? <Check size={16} className="text-green-500" /> : <X size={16} className="text-zinc-300" />}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => viewPayments(s)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500" title="Платежи">
                      <Eye size={15} />
                    </button>
                    {s.status === 'active' && (
                      <button onClick={() => { setSelectedSub(s); setShowRenewModal(true); }}
                        className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                        Продлить
                      </button>
                    )}
                    {s.status === 'paused' && (
                      <button onClick={() => handleStatusChange(s.id, 'active')}
                        className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                        Активировать
                      </button>
                    )}
                    {s.status === 'active' && (
                      <button onClick={() => handleStatusChange(s.id, 'paused')}
                        className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">
                        Приостановить
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSub && payments.length > 0 && (
        <div className="mt-6 bg-white border border-zinc-200 rounded-2xl p-5">
          <h3 className="font-bold text-zinc-900 mb-3">Платежи: {selectedSub.tenant_name}</h3>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left p-2 text-zinc-500 font-medium text-xs">ID</th>
                <th className="text-left p-2 text-zinc-500 font-medium text-xs">Провайдер</th>
                <th className="text-left p-2 text-zinc-500 font-medium text-xs">Сумма</th>
                <th className="text-left p-2 text-zinc-500 font-medium text-xs">Статус</th>
                <th className="text-left p-2 text-zinc-500 font-medium text-xs">Дата</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="p-2 text-xs text-zinc-600 font-mono">{p.payme_id?.slice(0, 16) || `#${p.id}`}</td>
                  <td className="p-2 text-xs font-medium">
                    {p.provider === 'payme' ? 'Payme' : p.provider === 'yookassa' ? 'ЮKassa' : p.provider === 'cloudpayments' ? 'CloudPayments' : p.provider === 'tbank' ? 'Т-Банк' : '—'}
                  </td>
                  <td className="p-2 font-medium">{p.amount.toLocaleString('ru-RU')} {p.currency}</td>
                  <td className="p-2">{statusBadge(p.status)}</td>
                  <td className="p-2 text-xs text-zinc-400">{new Date(p.created_at).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRenewModal && selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRenewModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-zinc-900 mb-2">Продление подписки</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Арендатор: <strong>{selectedSub.tenant_name}</strong><br />
              Тариф: <strong>{selectedSub.tariff_name}</strong>
            </p>
            <div className="mb-4">
              <label className="text-xs font-medium text-zinc-500 block mb-1">Количество месяцев</label>
              <input type="number" min={1} max={36} value={renewMonths}
                onChange={e => setRenewMonths(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRenewModal(false)}
                className="flex-1 px-4 py-2 border border-zinc-200 rounded-xl text-sm font-medium hover:bg-zinc-50">
                Отмена
              </button>
              <button onClick={handleRenew} disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50">
                {actionLoading ? 'Продление...' : 'Продлить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
