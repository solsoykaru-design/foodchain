import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface Plan {
  name: string;
  price: string;
  popular?: boolean;
  features: string[];
}

const plans: Plan[] = [
  {
    name: 'Базовый',
    price: '9 900 ₽',
    features: [
      'До 500 заказов в месяц',
      'До 5 сотрудников',
      '1 точка (филиал)',
      'Базовые отчёты',
      'Техподдержка по email',
    ],
  },
  {
    name: 'Профессиональный',
    price: '19 900 ₽',
    popular: true,
    features: [
      'До 2 000 заказов в месяц',
      'До 20 сотрудников',
      'До 3 точек',
      'Расширенная аналитика',
      'Интеграция с агрегаторами',
      'Приоритетная поддержка',
    ],
  },
  {
    name: 'Корпоративный',
    price: '39 900 ₽',
    features: [
      'Безлимит заказов',
      'Безлимит сотрудников',
      'Безлимит точек',
      'Полная аналитика + дашборды',
      'Все интеграции',
      'Персональный менеджер',
    ],
  },
];

const faqs = [
  {
    question: 'Могу ли я сменить тариф в любой момент?',
    answer:
      'Да, вы можете перейти на другой тариф в любое время. Изменения вступят в силу с начала следующего расчётного периода. Все ваши данные останутся сохранены.',
  },
  {
    question: 'Есть ли скидка при оплате за год?',
    answer:
      'Да, при оплате за год мы предоставляем скидку 20%. Вы также можете начать с бесплатного 14-дневного пробного периода, чтобы оценить все возможности.',
  },
  {
    question: 'Что входит в бесплатный пробный период?',
    answer:
      'В пробный период вам доступны все функции тарифа «Профессиональный» без ограничений. Через 14 дней вы сможете выбрать подходящий тариф или продолжить на бесплатном тарифе с базовым функционалом.',
  },
  {
    question: 'Как происходит интеграция с агрегаторами?',
    answer:
      'Мы поддерживаем интеграцию с Яндекс.Еда, Delivery Club, и другими популярными агрегаторами. Настройка занимает до 1 рабочего дня. На тарифе «Корпоративный» доступны все интеграции без ограничений.',
  },
];

export function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Выберите ваш тариф
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-500">
            Начните с 14-дневного бесплатного пробного периода. Без привязки карты.
            Отмените в любой момент.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={
                'relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ' +
                (plan.popular
                  ? 'border-amber-400 shadow-amber-100/50 ring-2 ring-amber-400/40'
                  : 'border-zinc-200')
              }
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-400 to-rose-500 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-md">
                  Популярное
                </span>
              )}

              <h3 className="text-xl font-semibold text-zinc-900">{plan.name}</h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-zinc-900">
                  {plan.price}
                </span>
                <span className="text-sm text-zinc-500">/мес</span>
              </div>

              <ul className="mt-8 flex-1 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-zinc-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={
                  'mt-8 block w-full rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all duration-200 ' +
                  (plan.popular
                    ? 'bg-gradient-to-r from-orange-400 to-rose-500 text-white shadow-md hover:shadow-lg hover:from-orange-500 hover:to-rose-600'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800')
                }
              >
                Начать бесплатно
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-24 max-w-3xl">
          <div className="flex items-center justify-center gap-3">
            <HelpCircle className="h-6 w-6 text-zinc-400" />
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
              Часто задаваемые вопросы
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="text-sm font-medium text-zinc-900">{faq.question}</span>
                  {openFaq === i ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-zinc-400" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="border-t border-zinc-100 px-6 pb-5 pt-3">
                    <p className="text-sm leading-relaxed text-zinc-500">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-24 max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Начните бесплатно уже сегодня
          </h2>
          <p className="mt-3 text-sm text-zinc-500">
            Присоединяйтесь к тысячам ресторанов, которые уже управляют своим бизнесом с FoodChain.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              to="/register"
              className="rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg"
            >
              Попробовать бесплатно
            </Link>
            <Link
              to="/contact"
              className="rounded-xl border border-zinc-300 bg-white px-8 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:shadow-md"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
