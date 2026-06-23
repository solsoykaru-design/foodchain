import { Link } from 'react-router-dom';
import {
  Zap,
  Package,
  BarChart3,
  Smartphone,
  ShoppingBag,
  Monitor,
  Users,
  LineChart,
  CreditCard,
  Star,
  Check,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
  Tablet,
  Bike,
  ChefHat,
  Globe,
  QrCode,
  Printer,
  Wallet,
  DollarSign,
  PieChart,
  Percent,
  FileText,
} from 'lucide-react';

const stats = [
  { value: '500+', label: 'Ресторанов' },
  { value: '50K+', label: 'Заказов/мес' },
  { value: '99.9%', label: 'Аптайм' },
  { value: '24/7', label: 'Поддержка' },
];

const benefits = [
  {
    icon: Zap,
    title: 'Автоматизация заказов',
    desc: 'Заказы с сайта, из приложения и Telegram попадают в одну очередь',
    color: 'from-orange-400 to-red-500',
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-500',
  },
  {
    icon: Package,
    title: 'Контроль склада',
    desc: 'Учёт остатков, автозакупки, техкарты и инвентаризация',
    color: 'from-emerald-400 to-teal-500',
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
  {
    icon: BarChart3,
    title: 'Аналитика в реальном времени',
    desc: 'Дашборды по продажам, марже и эффективности',
    color: 'from-violet-400 to-purple-500',
    bgColor: 'bg-violet-50',
    iconColor: 'text-violet-500',
  },
  {
    icon: Smartphone,
    title: 'Мобильность',
    desc: 'Работайте откуда угодно через приложения для всех ролей',
    color: 'from-sky-400 to-blue-500',
    bgColor: 'bg-sky-50',
    iconColor: 'text-sky-500',
  },
];

const features = [
  {
    icon: ShoppingBag,
    title: 'Приём заказов',
    desc: 'Интеграция с сайтом, Telegram и мобильными приложениями. Автоматическое распределение заказов.',
  },
  {
    icon: Monitor,
    title: 'Админ-панель',
    desc: 'Полный контроль над рестораном: меню, цены, акции, сотрудники и отчёты.',
  },
  {
    icon: Users,
    title: 'Курьерское приложение',
    desc: 'Управление курьерами в реальном времени, оптимизация маршрутов и контроль доставки.',
  },
  {
    icon: Smartphone,
    title: 'Гостевые приложения',
    desc: 'Белые брендированные приложения для iOS и Android с push-уведомлениями.',
  },
  {
    icon: LineChart,
    title: 'Аналитика',
    desc: 'Детальные дашборды по продажам, маржинальности и загрузке производства.',
  },
  {
    icon: CreditCard,
    title: 'Учёт и финансы',
    desc: 'Автоматизация учёта, интеграция с кассами и фискальными накопителями.',
  },
];

const testimonials = [
  {
    quote: 'После внедрения FoodChain количество заказов выросло на 40%. Система полностью автоматизировала приём заказов и расчёт себестоимости блюд.',
    name: 'Александр',
    restaurant: 'IL Патио',
    rating: 5,
  },
  {
    quote: 'Управлять четырьмя ресторанами стало проще. Все показатели в одном дашборде, а мобильное приложение для управляющего — просто спасение.',
    name: 'Елена',
    restaurant: 'Суши Мастер',
    rating: 5,
  },
  {
    quote: 'Автоматизация склада сократила списания продуктов на 25%. Система сама подсказывает, когда и что нужно заказать у поставщиков.',
    name: 'Дмитрий',
    restaurant: 'Burger House',
    rating: 5,
  },
];

const plans = [
  {
    name: 'Базовый',
    price: '9 900',
    popular: false,
    features: [
      'До 100 заказов/день',
      'Базовая аналитика',
      'Приём заказов',
      '2 сотрудника',
      'Интеграция с кассой',
    ],
  },
  {
    name: 'Профессиональный',
    price: '19 900',
    popular: true,
    features: [
      'До 500 заказов/день',
      'Полная аналитика',
      'Складской учёт',
      '10 сотрудников',
      'Мобильные приложения',
      'Приоритетная поддержка',
    ],
  },
  {
    name: 'Корпоративный',
    price: '39 900',
    popular: false,
    features: [
      'Безлимит заказов',
      'Персональная аналитика',
      'Полный складской учёт',
      'Неограниченно сотрудников',
      'Брендированные приложения',
      'Выделенный менеджер',
      'Своя CRM',
    ],
  },
];

const reasons = [
  {
    icon: ShieldCheck,
    title: 'Надёжность и безопасность',
    desc: '99.9% аптайм, резервное копирование, шифрование данных и соответствие 152-ФЗ.',
  },
  {
    icon: LineChart,
    title: 'Рост эффективности',
    desc: 'Рестораны на FoodChain в среднем увеличивают прибыль на 30% за первые 3 месяца.',
  },
  {
    icon: Users,
    title: 'Экосистема для всех',
    desc: 'Отдельные приложения для администраторов, поваров, курьеров и управляющих.',
  },
];

export function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-orange-500/10 blur-[120px]" />
          <div className="absolute top-60 -right-20 h-96 w-96 rounded-full bg-red-500/10 blur-[120px]" />
          <div className="absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-orange-400/5 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-28 sm:px-6 lg:px-8 lg:pt-28 lg:pb-36">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-zinc-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Запустите свой ресторан онлайн
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Управляйте рестораном{' '}
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                легко и эффективно
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400">
              Принимайте заказы онлайн, управляйте курьерами, складом, финансами и персоналом в
              одном окне.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105"
              >
                Начать бесплатно
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 px-8 py-3.5 text-base font-semibold text-zinc-300 transition-all duration-300 hover:border-zinc-500 hover:text-white"
              >
                Смотреть тарифы
                <ChevronRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-bold text-white sm:text-3xl">{stat.value}</div>
                  <div className="mt-1 text-sm text-zinc-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Что вы получаете
            </h2>
            <p className="mt-4 text-lg text-zinc-500">
              FoodChain — это не просто система учёта, а полноценная экосистема для управления
              рестораном.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="group rounded-2xl border border-zinc-100 bg-white p-8 transition-all duration-300 hover:shadow-xl hover:shadow-zinc-200/50 hover:-translate-y-1"
              >
                <div
                  className={`mb-5 inline-flex rounded-xl ${benefit.bgColor} p-3 transition-transform duration-300 group-hover:scale-110`}
                >
                  <benefit.icon className={`h-6 w-6 ${benefit.iconColor}`} />
                </div>
                <h3 className="mb-3 text-lg font-semibold text-zinc-900">{benefit.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-500">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-zinc-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Всё для управления рестораном
            </h2>
            <p className="mt-4 text-lg text-zinc-500">
              Единая платформа для всех процессов вашего ресторана.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-zinc-100 bg-white p-6 transition-all duration-300 hover:shadow-lg hover:shadow-zinc-200/50 hover:-translate-y-0.5"
              >
                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-orange-400 to-red-500 p-3 text-white shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-zinc-900">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apps Showcase */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Пять приложений — одна экосистема
            </h2>
            <p className="mt-4 text-lg text-zinc-500">
              Каждое приложение решает свою задачу, а вместе они закрывают все процессы ресторана.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[
              { icon: Monitor, name: 'Админ-панель', desc: 'Управление меню, складом, финансами и персоналом в браузере', color: 'from-blue-400 to-blue-600', bg: 'bg-blue-50', icn: 'text-blue-500' },
              { icon: ShoppingBag, name: 'Гостевое приложение', desc: 'Заказ, оплата, лояльность и push-уведомления для гостей', color: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50', icn: 'text-emerald-500' },
              { icon: Tablet, name: 'Приложение официанта', desc: 'План зала, приём заказов, оплата и печать чеков', color: 'from-purple-400 to-purple-600', bg: 'bg-purple-50', icn: 'text-purple-500' },
              { icon: Bike, name: 'Приложение курьера', desc: 'Маршруты, геолокация, статусы доставки и чат', color: 'from-orange-400 to-orange-600', bg: 'bg-orange-50', icn: 'text-orange-500' },
              { icon: ChefHat, name: 'Экран кухни', desc: 'Очередь заказов с таймерами и автосписанием продуктов', color: 'from-red-400 to-red-600', bg: 'bg-red-50', icn: 'text-red-500' },
            ].map((app) => (
              <Link
                key={app.name}
                to="/apps"
                className="group rounded-2xl border border-zinc-100 bg-white p-6 text-center transition-all duration-300 hover:shadow-xl hover:shadow-zinc-200/50 hover:-translate-y-1"
              >
                <div className={`mx-auto mb-4 inline-flex rounded-xl ${app.bg} p-3 transition-transform duration-300 group-hover:scale-110`}>
                  <app.icon className={`h-6 w-6 ${app.icn}`} />
                </div>
                <h3 className="mb-2 text-base font-semibold text-zinc-900">{app.name}</h3>
                <p className="text-sm leading-relaxed text-zinc-500">{app.desc}</p>
                <div className="mt-4 text-xs font-medium text-orange-500 opacity-0 transition-opacity group-hover:opacity-100">
                  Подробнее →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="bg-zinc-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Интеграции и фискализация
            </h2>
            <p className="mt-4 text-lg text-zinc-500">
              Всё необходимое для работы ресторана: онлайн-кассы, агрегаторы доставки, банки и 1С.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: CreditCard, title: 'Онлайн-оплата', desc: 'Т-Банк, СБП, Apple/Google Pay — приём платежей без комиссии за подключение', color: 'from-sky-400 to-blue-500' },
              { icon: Printer, title: 'Фискализация', desc: 'Атол, Штрих-М, Честный знак, ЕГАИС — все требования 54-ФЗ', color: 'from-rose-400 to-red-500' },
              { icon: ShoppingBag, title: 'Агрегаторы', desc: 'Яндекс Еда, Delivery Club, СберМаркет — синхронизация меню и заказов', color: 'from-emerald-400 to-teal-500' },
              { icon: Globe, title: '1С и карты', desc: 'Двусторонний обмен с 1С, Яндекс.Карты, Google Maps, 2GIS', color: 'from-violet-400 to-purple-500' },
            ].map((item) => (
              <div
                key={item.title}
                className="group rounded-2xl border border-zinc-100 bg-white p-6 transition-all duration-300 hover:shadow-lg hover:shadow-zinc-200/50 hover:-translate-y-0.5"
              >
                <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-r ${item.color} p-3 text-white shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-zinc-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-500">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/integrations"
              className="inline-flex items-center gap-1 text-sm font-medium text-orange-500 transition-colors hover:text-orange-600"
            >
              Все интеграции и возможности
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Finance */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                Финансы, отчёты и аналитика
              </h2>
              <p className="mt-4 text-lg text-zinc-500">
                Полный контроль над финансами ресторана: от выручки до маржинального анализа.
              </p>
              <div className="mt-12 space-y-10">
                {[
                  { icon: DollarSign, title: 'Доходы и расходы', desc: 'Выручка по дням, неделям, месяцам с графиками и прогнозированием' },
                  { icon: Percent, title: 'Фудкост и себестоимость', desc: 'Автоматический расчёт себестоимости каждого блюда на основе техкарт' },
                  { icon: PieChart, title: 'ABC-анализ', desc: 'Какие блюда приносят больше всего прибыли — оптимизация меню на основе данных' },
                  { icon: FileText, title: 'Готовые отчёты', desc: 'P&L, cash flow, отчёты по продажам, складу и персоналу с экспортом в Excel/PDF' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-5">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link
                  to="/finance"
                  className="inline-flex items-center gap-1 text-sm font-medium text-orange-500 transition-colors hover:text-orange-600"
                >
                  Все финансы и отчёты
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-full rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-8 sm:p-12">
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { value: '28.4%', label: 'Фудкост', color: 'text-rose-400' },
                    { value: '71.6%', label: 'Маржа', color: 'text-emerald-400' },
                    { value: '1 850 ₽', label: 'Средний чек', color: 'text-blue-400' },
                    { value: '+30%', label: 'Рост прибыли', color: 'text-orange-400' },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className={`text-2xl font-bold sm:text-3xl ${stat.color}`}>{stat.value}</div>
                      <div className="mt-1 text-sm text-zinc-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 border-t border-zinc-700 pt-6">
                  <p className="text-sm text-zinc-400">
                    Все цифры обновляются в реальном времени. Никакой ручной отчётности — система считает сама.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Отзывы наших клиентов
            </h2>
            <p className="mt-4 text-lg text-zinc-500">
              Узнайте, как FoodChain помогает ресторанам расти.
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="relative rounded-2xl border border-zinc-100 bg-white p-8 transition-all duration-300 hover:shadow-xl hover:shadow-zinc-200/50"
              >
                <svg
                  className="mb-4 h-8 w-8 text-orange-200"
                  fill="currentColor"
                  viewBox="0 0 32 32"
                >
                  <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8zm16 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8z" />
                </svg>
                <p className="mb-6 text-sm leading-relaxed text-zinc-600">"{t.quote}"</p>
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div className="border-t border-zinc-100 pt-4">
                  <div className="font-semibold text-zinc-900">{t.name}</div>
                  <div className="text-sm text-zinc-500">{t.restaurant}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-zinc-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Выберите ваш тариф
            </h2>
            <p className="mt-4 text-lg text-zinc-500">
              Прозрачные цены без скрытых платежей. Растём вместе с вами.
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border bg-white p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  plan.popular
                    ? 'border-orange-200 ring-2 ring-orange-400/20 shadow-lg shadow-orange-100'
                    : 'border-zinc-100'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-4 py-1 text-xs font-semibold text-white shadow-lg">
                    Популярный
                  </div>
                )}
                <h3 className="mb-2 text-xl font-bold text-zinc-900">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-zinc-900">{plan.price}</span>
                  <span className="ml-1 text-sm text-zinc-500">₽/мес</span>
                </div>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-zinc-600">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30'
                      : 'border border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  Начать
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1 text-sm font-medium text-orange-500 transition-colors hover:text-orange-600"
            >
              Смотреть все тарифы и сравнить
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                Почему выбирают FoodChain
              </h2>
              <p className="mt-4 text-lg text-zinc-500">
                Тысячи ресторанов по всей России уже доверили нам свой бизнес.
              </p>
              <div className="mt-12 space-y-10">
                {reasons.map((reason) => (
                  <div key={reason.title} className="flex gap-5">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                      <reason.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900">{reason.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-500">{reason.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-full rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-8 sm:p-12">
                <h3 className="text-2xl font-bold text-white sm:text-3xl">Готовы начать?</h3>
                <p className="mt-3 text-zinc-400">
                  Получите 14 дней бесплатного доступа ко всем функциям платформы. Без комиссии за
                  отмену.
                </p>
                <ul className="mt-8 space-y-3">
                  {[
                    '14 дней бесплатного теста',
                    'Без привязки карты',
                    'Персональная поддержка при внедрении',
                    'Перенос данных из других систем',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-zinc-300">
                      <Check className="h-4 w-4 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/30 sm:w-auto"
                >
                  Начать бесплатно
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
