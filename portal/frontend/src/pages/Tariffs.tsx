import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Check } from 'lucide-react';

export function Tariffs() {
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTariffs()
      .then(setTariffs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-zinc-900">Тарифы и цены</h1>
        <p className="text-zinc-500 mt-3 max-w-xl mx-auto">Выберите тариф, который подходит вашему бизнесу. Все тарифы включают 14-дневный бесплатный период.</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-400 animate-pulse">Загрузка тарифов...</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tariffs.map((tariff) => (
            <div key={tariff.id} className={`bg-white border-2 rounded-2xl p-6 flex flex-col ${tariff.code === 'pro' ? 'border-orange-400 shadow-lg shadow-orange-200/30' : 'border-zinc-200'}`}>
              {tariff.code === 'pro' && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full self-center mb-3">
                  Популярный
                </div>
              )}
              <h3 className="text-xl font-bold text-zinc-900">{tariff.name}</h3>
              <div className="mt-3 mb-5">
                <span className="text-4xl font-extrabold text-zinc-900">{tariff.price_monthly.toLocaleString('ru-RU')}</span>
                <span className="text-zinc-400 text-sm ml-1">₽/мес</span>
              </div>
              <ul className="space-y-3 flex-1">
                {(typeof tariff.features === 'string' ? JSON.parse(tariff.features) : tariff.features)?.map((feat: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-green-500 shrink-0 mt-0.5" />
                    <span className="text-zinc-600">{feat}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className={`mt-6 block text-center font-bold py-3 rounded-xl transition ${
                tariff.code === 'pro'
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}>
                Выбрать {tariff.name}
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-12 p-8 bg-zinc-50 rounded-2xl border border-zinc-200">
        <h3 className="font-bold text-lg text-zinc-900 mb-2">Нужен индивидуальный тариф?</h3>
        <p className="text-zinc-500 text-sm mb-4">Для сетей ресторанов и крупных проектов у нас есть специальные условия.</p>
        <a href="mailto:sales@foodchain.ru" className="text-orange-600 font-medium hover:underline text-sm">Свяжитесь с отделом продаж →</a>
      </div>
    </div>
  );
}
