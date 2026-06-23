import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle, CreditCard, XCircle, Loader, Globe, Banknote } from 'lucide-react';

const PROVIDER_ICONS: Record<string, string> = {
  payme: 'Payme',
  yookassa: 'ЮKassa',
  cloudpayments: 'CloudPayments',
  tbank: 'Т-Банк',
};

export function Subscription() {
  const [tenant, setTenant] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('payme');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedTariff, setSelectedTariff] = useState<any>(null);
  const [paymentUrl, setPaymentUrl] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.getMyTenant(),
      api.getSubscriptionStatus().catch(() => ({ active: false, hasSubscription: false })),
      api.getTariffs(),
      api.getSubscriptionPayments().catch(() => []),
      api.getPaymentProviders().catch(() => []),
    ])
      .then(([t, sub, ts, p, provs]) => {
        setTenant(t); setSubscription(sub); setTariffs(ts); setPayments(p); setProviders(provs);
        if (provs.length > 0) setSelectedProvider(provs[0].code);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text); setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleSelectTariff = async (tariff: any) => {
    if (subscription?.hasSubscription && subscription?.active) {
      if (!confirm('У вас уже есть активная подписка. Сменить тариф?')) return;
      setActionLoading(true);
      try {
        await api.changeSubscriptionTariff(tariff.id);
        setTenant((prev: any) => ({ ...prev, tariff_name: tariff.name }));
        showMsg('Тариф изменён');
      } catch (err: any) { showMsg(err.message || 'Ошибка смены тарифа', 'error'); }
      setActionLoading(false);
      return;
    }
    setSelectedTariff(tariff);
    setShowPayModal(true);
  };

  const handleCreateSubscription = async () => {
    if (!selectedTariff) return;
    setActionLoading(true);
    try {
      const result = await api.createSubscription({
        tariffId: selectedTariff.id,
        provider: selectedProvider,
      });
      if (result.paymentUrl) {
        window.open(result.paymentUrl, '_blank');
        setPaymentUrl(result.paymentUrl);
        showMsg('Перенаправляем на страницу оплаты...');
      }
      setTimeout(async () => {
        try {
          const updated = await api.confirmSubscription(result.subscriptionId);
          setSubscription({ active: true, hasSubscription: true, subscription: updated });
          setTenant((prev: any) => ({ ...prev, status: 'active', tariff_name: selectedTariff.name }));
          showMsg('Подписка активирована!');
          setShowPayModal(false);
        } catch {
          showMsg('Подписка создана. После оплаты статус обновится автоматически.', 'success');
          setShowPayModal(false);
        }
        setActionLoading(false);
      }, 3000);
    } catch (err: any) {
      showMsg(err.message || 'Ошибка создания подписки', 'error');
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setActionLoading(true);
    try {
      await api.cancelSubscription('Отменено пользователем');
      setSubscription({ active: false, hasSubscription: false, subscription: null });
      showMsg('Подписка отменена');
      setShowCancelModal(false);
    } catch (err: any) { showMsg(err.message || 'Ошибка', 'error'); }
    setActionLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-zinc-400">Загрузка...</div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6 transition">
        <ArrowLeft size={15} /> Назад
      </button>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Подписка и тариф</h1>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {messageType === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {message}
        </div>
      )}

      {subscription?.hasSubscription ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-zinc-900">Моя подписка</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              subscription.active ? 'bg-green-100 text-green-700' :
              subscription.subscription?.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
              {subscription.active ? 'Активна' : subscription.subscription?.status === 'paused' ? 'Приостановлена' : 'Неактивна'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-zinc-500 text-xs">Тариф</span>
              <div className="font-bold text-zinc-900">{subscription.subscription?.tariff_name || tenant?.tariff_name}</div>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Стоимость</span>
              <div className="font-bold text-zinc-900">{subscription.subscription?.price_monthly?.toLocaleString('ru-RU')} ₽/мес</div>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Дата окончания</span>
              <div className="font-bold text-zinc-900">
                {subscription.subscription?.end_date ? new Date(subscription.subscription.end_date).toLocaleDateString('ru-RU') : '—'}
              </div>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Провайдер</span>
              <div className="font-bold text-zinc-900">{PROVIDER_ICONS[subscription.subscription?.provider] || subscription.subscription?.provider}</div>
            </div>
          </div>
          <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-100">
            <button onClick={() => setShowCancelModal(true)} disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50">
              Отменить подписку
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle size={18} />
            <span className="font-semibold">У вас нет активной подписки</span>
          </div>
          <p className="text-sm text-amber-600 mt-1">Выберите тариф ниже, чтобы начать пользоваться системой.</p>
        </div>
      )}

      <h2 className="font-bold text-lg text-zinc-900 mb-4">Доступные тарифы</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {tariffs.map(t => {
          const isCurrent = subscription?.subscription?.tariff_id === t.id;
          return (
            <div key={t.id} className={`bg-white border-2 rounded-2xl p-5 ${isCurrent ? 'border-orange-400' : 'border-zinc-200'} ${t.code === 'pro' && !isCurrent ? 'shadow-md' : ''}`}>
              <h3 className="font-bold text-zinc-900">{t.name}</h3>
              <div className="text-2xl font-extrabold text-zinc-900 mt-2">
                {t.price_monthly.toLocaleString('ru-RU')}
                <span className="text-sm font-normal text-zinc-400"> ₽/мес</span>
              </div>
              <ul className="mt-3 space-y-1.5 mb-4">
                {(typeof t.features === 'string' ? JSON.parse(t.features) : t.features)?.map((f: string, i: number) => (
                  <li key={i} className="text-xs text-zinc-600 flex items-start gap-1.5">
                    <Check size={12} className="text-green-500 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="text-center text-sm font-medium text-orange-600 bg-orange-50 py-2 rounded-xl">Текущий тариф</div>
              ) : (
                <button onClick={() => handleSelectTariff(t)} disabled={actionLoading}
                  className="w-full text-sm font-bold py-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition disabled:opacity-50">
                  {actionLoading ? 'Обработка...' : subscription?.hasSubscription ? 'Сменить' : 'Выбрать'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {payments.length > 0 && (
        <div className="mt-10">
          <h2 className="font-bold text-lg text-zinc-900 mb-4">История платежей</h2>
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">ID</th>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">Провайдер</th>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">Сумма</th>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">Статус</th>
                  <th className="text-left p-3 text-zinc-500 font-medium text-xs">Дата</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-t border-zinc-100">
                    <td className="p-3 text-zinc-600 text-xs">{p.payme_id?.slice(0, 16) || `#${p.id}`}</td>
                    <td className="p-3 text-xs font-medium">{PROVIDER_ICONS[p.provider] || p.provider || '—'}</td>
                    <td className="p-3 font-bold">{p.amount.toLocaleString('ru-RU')} {p.currency}</td>
                    <td className="p-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        p.status === 'success' ? 'bg-green-100 text-green-700' :
                        p.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {p.status === 'success' ? 'Успешно' : p.status === 'failed' ? 'Ошибка' : 'Ожидает'}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-400 text-xs">{new Date(p.created_at).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPayModal && selectedTariff && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-zinc-900">Оплата подписки</h3>
              <button onClick={() => setShowPayModal(false)} className="text-zinc-400 hover:text-zinc-600"><XCircle size={20} /></button>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 mb-4">
              <div className="text-sm text-zinc-500">Тариф: <span className="font-bold text-zinc-900">{selectedTariff.name}</span></div>
              <div className="text-sm text-zinc-500 mt-1">Сумма: <span className="font-bold text-zinc-900">{selectedTariff.price_monthly.toLocaleString('ru-RU')} ₽</span></div>
            </div>

            {providers.length > 1 && (
              <div className="mb-4">
                <label className="text-xs font-medium text-zinc-500 mb-2 block">Платёжная система</label>
                <div className="grid grid-cols-2 gap-2">
                  {providers.map(p => (
                    <button key={p.code} onClick={() => setSelectedProvider(p.code)}
                      className={`p-3 rounded-xl border-2 text-left transition ${
                        selectedProvider === p.code ? 'border-orange-400 bg-orange-50' : 'border-zinc-200 hover:border-zinc-300'
                      }`}>
                      <div className="font-bold text-sm text-zinc-900">{PROVIDER_ICONS[p.code] || p.name}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {p.methods?.join(', ') || 'Карты, СБП'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleCreateSubscription} disabled={actionLoading}
              className="w-full bg-orange-500 text-white font-bold py-2.5 rounded-xl hover:bg-orange-600 transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
              {actionLoading ? <Loader size={16} className="animate-spin" /> : <Banknote size={16} />}
              {actionLoading ? 'Обработка...' : `Оплатить ${selectedTariff.price_monthly.toLocaleString('ru-RU')} ₽`}
            </button>
            {paymentUrl && (
              <p className="text-xs text-zinc-400 mt-3 text-center">
                <a href={paymentUrl} target="_blank" className="text-orange-500 underline">Перейти к оплате</a>, если страница не открылась
              </p>
            )}
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-zinc-900 mb-2">Отменить подписку?</h3>
            <p className="text-sm text-zinc-500 mb-4">После отмены автопродление будет отключено. Доступ сохранится до конца оплаченного периода.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(false)} className="flex-1 px-4 py-2 border border-zinc-200 rounded-xl text-sm font-medium hover:bg-zinc-50">Оставить</button>
              <button onClick={handleCancelSubscription} disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {actionLoading ? 'Отмена...' : 'Отменить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
