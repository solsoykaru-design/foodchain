import { useState, useEffect } from 'react';
import { Sparkles, Crown, Check, X, Loader, AlertCircle } from 'lucide-react';
import * as api from '../api';

interface Tariff {
  id: number;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  max_cards: number;
}

interface Subscription {
  id: number;
  status: string;
  end_date: string;
  tariff_name: string;
  max_cards: number;
}

export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [showTariffs, setShowTariffs] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cardsUsed, setCardsUsed] = useState(0);
  const [cardsLimit, setCardsLimit] = useState(3);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('foodchain_admin_user') || '{}');
      if (user.role === 'superadmin' || user.role === 'owner') {
        setIsOwner(true);
        setLoading(false);
        return;
      }

      const [subs, tfs, limitInfo] = await Promise.all([
        api.request('/api/subscriptions').catch(() => []),
        api.request('/api/tariffs?active=true').catch(() => []),
        api.request('/api/tech-cards/limit').catch(() => null)
      ]);

      const activeSub = Array.isArray(subs) ? subs.find((s: any) => s.status === 'active') : null;
      setSubscription(activeSub);
      
      const parsedTariffs = Array.isArray(tfs) ? tfs.map((t: any) => ({
        ...t,
        features: typeof t.features === 'string' ? JSON.parse(t.features) : t.features
      })) : [];
      setTariffs(parsedTariffs);

      if (limitInfo) {
        setCardsUsed(limitInfo.total || 0);
        setCardsLimit(limitInfo.limit || 3);
      } else if (activeSub) {
        setCardsLimit(activeSub.max_cards || 3);
      } else {
        setCardsLimit(3);
      }
    } catch (e) {
      console.error('Subscription check error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tariffId: number) => {
    setPaying(true);
    try {
      const res = await api.request('/api/subscriptions/create', {
        method: 'POST',
        body: JSON.stringify({ tariff_id: tariffId })
      });
      if (res.id) {
        const payment = await api.request('/api/payments/create', {
          method: 'POST',
          body: JSON.stringify({
            subscription_id: res.id,
            amount: tariffs.find(t => t.id === tariffId)?.price || 0,
            description: 'Подписка AI Техкарты'
          })
        });
        if (payment.payment_url) {
          window.open(payment.payment_url, '_blank');
        }
      }
    } catch (e: any) {
      alert(e.message || 'Ошибка оплаты');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  if (isOwner || subscription) {
    return (
      <>
        {!isOwner && subscription && cardsLimit > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-2 text-sm text-blue-800 dark:text-blue-200">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <span>Техкарт: {cardsUsed} / {cardsLimit === -1 ? '∞' : cardsLimit}</span>
              {cardsLimit !== -1 && cardsUsed >= cardsLimit && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <AlertCircle size={14} /> Лимит исчерпан
                </span>
              )}
            </div>
          </div>
        )}
        {children}
      </>
    );
  }

  if (showTariffs) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-600 via-orange-700 to-red-800 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Crown size={48} className="mx-auto text-amber-300 mb-4" />
            <h1 className="text-3xl font-bold text-white">Выберите тариф</h1>
            <p className="text-amber-100 mt-2">AI Техкарты для вашего ресторана</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {tariffs.map(tariff => (
              <div key={tariff.id} className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl ${tariff.price === 0 ? 'ring-2 ring-green-500' : ''}`}>
                {tariff.price === 0 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    БЕСПЛАТНО
                  </div>
                )}
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{tariff.name}</h3>
                <p className="text-sm text-zinc-500 mb-4">{tariff.description}</p>
                <div className="text-3xl font-bold text-amber-500 mb-4">
                  {tariff.price === 0 ? '0₽' : `${tariff.price.toLocaleString('ru-RU')}₽`}
                  {tariff.price > 0 && <span className="text-sm font-normal text-zinc-400">/{tariff.period === 'month' ? 'мес' : tariff.period}</span>}
                </div>
                <ul className="space-y-2 mb-6">
                  {tariff.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                      <Check size={16} className="text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(tariff.id)}
                  disabled={paying}
                  className={`w-full font-bold py-3 rounded-xl transition-colors ${
                    tariff.price === 0 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white'
                  }`}
                >
                  {paying ? 'Оплата...' : tariff.price === 0 ? 'Начать бесплатно' : 'Оформить'}
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowTariffs(false)}
            className="w-full mt-6 text-amber-100 hover:text-white py-3"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-600 via-orange-700 to-red-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl text-center">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Crown size={40} className="text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Подписка AI Техкарты</h2>
        <p className="text-zinc-500 mb-6">
          Для использования AI Техкарт необходима подписка. Владельцам доступно бесплатно.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => setShowTariffs(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Оформить подписку
          </button>
          <p className="text-xs text-zinc-400">
            Если вы владелец, обратитесь к администратору для активации
          </p>
        </div>
      </div>
    </div>
  );
}
