import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, HelpCircle, ChevronDown, ChevronUp, Zap, ArrowRight, Star, Clock, Shield, Users } from 'lucide-react';

interface Plan {
  name: string;
  subtitle: string;
  monthly: string;
  yearly: string;
  popular?: boolean;
  features: { text: string; included: boolean | string }[];
  highlight?: boolean;
}

const plans: Plan[] = [
  {
    name: 'Базовый',
    subtitle: 'Для небольших заведений',
    monthly: '9 900 ₽',
    yearly: '7 900 ₽',
    features: [
      { text: 'До 500 заказов в месяц', included: true },
      { text: 'До 5 сотрудников', included: true },
      { text: '1 точка (филиал)', included: true },
      { text: 'Базовые отчёты', included: true },
      { text: 'Управление меню', included: true },
      { text: 'Складской учёт', included: false },
      { text: 'Интеграция с агрегаторами', included: false },
      { text: 'Мобильное приложение', included: false },
      { text: 'Экран кухни (KDS)', included: false },
      { text: 'Техподдержка по email', included: true },
      { text: 'AI-прогнозы', included: false },
    ],
  },
  {
    name: 'Профессиональный',
    subtitle: 'Для растущего бизнеса',
    monthly: '19 900 ₽',
    yearly: '15 900 ₽',
    popular: true,
    features: [
      { text: 'До 2 000 заказов в месяц', included: true },
      { text: 'До 20 сотрудников', included: true },
      { text: 'До 3 точек', included: true },
      { text: 'Расширенная аналитика', included: true },
      { text: 'Управление меню', included: true },
      { text: 'Складской учёт', included: true },
      { text: 'Интеграция с агрегаторами', included: true },
      { text: 'Брендированное приложение', included: 'PWA' },
      { text: 'Экран кухни (KDS)', included: true },
      { text: 'Приоритетная поддержка', included: true },
      { text: 'Маркетинг и акции', included: true },
    ],
  },
  {
    name: 'Корпоративный',
    subtitle: 'Для сетей и франшиз',
    monthly: '39 900 ₽',
    yearly: '29 900 ₽',
    features: [
      { text: 'Безлимит заказов', included: true },
      { text: 'Безлимит сотрудников', included: true },
      { text: 'Безлимит точек', included: true },
      { text: 'Полная аналитика + дашборды', included: true },
      { text: 'Управление меню', included: true },
      { text: 'Складской учёт', included: true },
      { text: 'Все интеграции', included: true },
      { text: 'Полный White Label', included: true },
      { text: 'Экран кухни (KDS)', included: true },
      { text: 'Персональный менеджер 24/7', included: true },
      { text: 'AI-прогнозы и автоматизация', included: true },
    ],
  },
];

const comparisonRows = [
  { feature: 'Заказы в месяц', basic: 'до 500', pro: 'до 2 000', corp: 'безлимит' },
  { feature: 'Сотрудники', basic: 'до 5', pro: 'до 20', corp: 'безлимит' },
  { feature: 'Филиалы', basic: '1', pro: 'до 3', corp: 'безлимит' },
  { feature: 'Управление меню', basic: true, pro: true, corp: true },
  { feature: 'Складской учёт', basic: false, pro: true, corp: true },
  { feature: 'Базовая аналитика', basic: true, pro: true, corp: true },
  { feature: 'Расширенная аналитика', basic: false, pro: true, corp: true },
  { feature: 'Интеграция с агрегаторами', basic: false, pro: true, corp: true },
  { feature: 'Брендированное приложение', basic: false, pro: 'PWA', corp: 'iOS/Android' },
  { feature: 'Экран кухни (KDS)', basic: false, pro: true, corp: true },
  { feature: 'Приложение курьера', basic: false, pro: true, corp: true },
  { feature: 'Маркетинг и акции', basic: false, pro: true, corp: true },
  { feature: 'AI-прогнозы', basic: false, pro: false, corp: true },
  { feature: 'Персональный менеджер', basic: false, pro: false, corp: true },
  { feature: 'Техподдержка', basic: 'email', pro: 'приоритетная', corp: '24/7 личный' },
];

const faqs = [
  {
    question: 'Могу ли я сменить тариф в любой момент?',
    answer: 'Да, вы можете перейти на другой тариф в любое время. Изменения вступят в силу с начала следующего расчётного периода. Все ваши данные останутся сохранены.',
  },
  {
    question: 'Есть ли скидка при оплате за год?',
    answer: 'Да, при оплате за год мы предоставляем скидку до 25%. Все тарифы при годовой оплате дешевле, чем при помесячной. Вы также можете начать с бесплатного 14-дневного пробного периода.',
  },
  {
    question: 'Что входит в бесплатный пробный период?',
    answer: 'В пробный период вам доступны все функции тарифа «Профессиональный» без ограничений. Через 14 дней вы сможете выбрать подходящий тариф или продолжить на бесплатном тарифе с базовым функционалом.',
  },
  {
    question: 'Как происходит интеграция с агрегаторами?',
    answer: 'Мы поддерживаем интеграцию с Яндекс.Еда, Delivery Club, Купер и другими популярными агрегаторами. Настройка занимает до 1 рабочего дня. На тарифе «Корпоративный» доступны все интеграции без ограничений.',
  },
  {
    question: 'Можно ли добавить больше филиалов, чем в тарифе?',
    answer: 'Да, вы можете приобрести дополнительный филиал за 4 900 ₽/мес. Также возможен переход на более высокий тариф с расширенными лимитами.',
  },
  {
    question: 'Предоставляете ли вы обучение персонала?',
    answer: 'Да, для тарифов «Профессиональный» и «Корпоративный» мы проводим онлайн-обучение для вашего персонала. В тарифе «Корпоративный» также доступен выезд специалиста для настройки.',
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-cyan-500/20">
            Ценообразование
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Выберите ваш тариф
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            Начните с 14-дневного бесплатного пробного периода. Без привязки карты.
            Отмените в любой момент.
          </p>
        </div>

        {/* Toggle */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <span className={`text-sm font-medium ${!yearly ? 'text-white' : 'text-slate-500'}`}>Ежемесячно</span>
          <button
            onClick={() => setYearly(!yearly)}
            className={`relative h-7 w-12 rounded-full transition-colors ${yearly ? 'bg-cyan-500' : 'bg-white/20'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${yearly ? 'translate-x-5' : ''}`} />
          </button>
          <span className={`text-sm font-medium ${yearly ? 'text-white' : 'text-slate-500'}`}>
            Ежегодно
            <span className="ml-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">-20%</span>
          </span>
        </div>

        {/* Pricing cards */}
        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={
                'relative flex flex-col rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-1 ' +
                (plan.popular
                  ? 'border-cyan-500/40 bg-gradient-to-b from-[#0f2035] to-[#0a1628] shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/20 scale-105'
                  : 'border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]')
              }
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-lg">
                  <Star className="h-3 w-3" />
                  Популярное
                </div>
              )}
              {plan.popular && (
                <div className="absolute -top-3 right-4 hidden sm:block">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 blur-xl opacity-30 animate-pulse" />
                </div>
              )}
              <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{plan.subtitle}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">
                  {yearly ? plan.yearly : plan.monthly}
                </span>
                <span className="text-sm text-slate-500">/мес</span>
              </div>
              {yearly && (
                <p className="mt-1 text-xs text-slate-500">
                  <span className="text-emerald-400">{plan.monthly}</span>/мес при помесячной оплате
                </p>
              )}
              <ul className="mt-8 flex-1 space-y-3.5">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-3 text-sm text-slate-400">
                    {feature.included === true ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    ) : feature.included === false ? (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                    ) : (
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-cyan-400" />
                      </span>
                    )}
                    <span className={feature.included === false ? 'text-slate-600' : ''}>
                      {feature.text}
                      {typeof feature.included === 'string' && (
                        <span className="ml-1.5 text-cyan-400 text-xs">({feature.included})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={
                  'mt-8 block w-full rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all duration-200 ' +
                  (plan.popular
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.02]'
                    : 'border border-white/10 bg-white/5 text-white/80 hover:bg-white/10')
                }
              >
                Начать бесплатно
              </Link>
            </div>
          ))}
        </div>

        {/* Guarantees */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500">
          <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-cyan-400" />14 дней бесплатно</span>
          <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-400" />Без привязки карты</span>
          <span className="flex items-center gap-2"><Users className="h-4 w-4 text-cyan-400" />Отмена в любой момент</span>
        </div>

        {/* Comparison Table */}
        <div className="mx-auto mt-24 max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Детальное сравнение
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-400">
            Все функции и лимиты по каждому тарифу
          </p>
          <div className="mt-12 overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02]">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-5 text-left text-sm font-semibold text-slate-400">Функция</th>
                  <th className="px-6 py-5 text-center text-sm font-semibold text-slate-400">Базовый</th>
                  <th className="px-6 py-5 text-center text-sm font-semibold text-cyan-400 bg-cyan-500/5">Профессиональный</th>
                  <th className="px-6 py-5 text-center text-sm font-semibold text-slate-400">Корпоративный</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-white/5 transition hover:bg-white/[0.02] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                    <td className="px-6 py-4 text-sm text-white">{row.feature}</td>
                    <td className="px-6 py-4 text-center">
                      {typeof row.basic === 'boolean' ? (
                        row.basic ? <Check className="mx-auto h-4 w-4 text-emerald-400" /> : <X className="mx-auto h-4 w-4 text-slate-600" />
                      ) : (
                        <span className="text-sm text-slate-400">{row.basic}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center bg-cyan-500/5">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? <Check className="mx-auto h-4 w-4 text-emerald-400" /> : <X className="mx-auto h-4 w-4 text-slate-600" />
                      ) : (
                        <span className="text-sm text-slate-300">{row.pro}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {typeof row.corp === 'boolean' ? (
                        row.corp ? <Check className="mx-auto h-4 w-4 text-emerald-400" /> : <X className="mx-auto h-4 w-4 text-slate-600" />
                      ) : (
                        <span className="text-sm text-slate-300">{row.corp}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-24 max-w-3xl">
          <div className="flex items-center justify-center gap-3">
            <HelpCircle className="h-6 w-6 text-cyan-400" />
            <h2 className="text-2xl font-bold tracking-tight text-white">Часто задаваемые вопросы</h2>
          </div>
          <div className="mt-10 space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`rounded-xl border transition-all ${
                  openFaq === i ? 'border-cyan-500/30 bg-white/[0.03]' : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="text-sm font-medium text-white">{faq.question}</span>
                  {openFaq === i ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-cyan-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="border-t border-white/5 px-6 pb-5 pt-3">
                    <p className="text-sm leading-relaxed text-slate-400">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-24 max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-400 mb-6">
            <Zap className="h-3.5 w-3.5" />
            Бесплатно 14 дней
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Начните бесплатно уже сегодня</h2>
          <p className="mt-3 text-sm text-slate-400">
            Присоединяйтесь к тысячам ресторанов, которые уже управляют своим бизнесом с FoodChain.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105"
            >
              Попробовать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
