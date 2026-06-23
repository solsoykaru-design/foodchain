import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Monitor,
  ShoppingBag,
  Tablet,
  Bike,
  ChefHat,
  Smartphone,
  ArrowRight,
  Check,
  Globe,
  Clock,
  MapPin,
  CreditCard,
  Printer,
  Bell,
  Users,
  LineChart,
  Package,
  ShoppingCart,
  Megaphone,
} from 'lucide-react';

interface AppFeature {
  text: string;
}

interface AppInfo {
  id: string;
  icon: React.ElementType;
  name: string;
  subtitle: string;
  description: string;
  features: AppFeature[];
  tech: string;
  gradient: string;
  accent: string;
  bgLight: string;
  iconBg: string;
  mockupIcon: React.ElementType;
}

const apps: AppInfo[] = [
  {
    id: 'backoffice',
    icon: Monitor,
    name: 'Админ-панель',
    subtitle: 'Back Office',
    description:
      'Полное управление рестораном: меню, склад, заказы, финансы, персонал и маркетинг в одном окне. Работает в браузере на любом устройстве.',
    features: [
      { text: 'Управление меню и техкартами' },
      { text: 'Склад и инвентаризация' },
      { text: 'Все статусы заказов' },
      { text: 'Финансы и отчёты' },
      { text: 'Персонал и смены' },
      { text: 'Маркетинг и лояльность' },
    ],
    tech: 'Веб-приложение (PWA), все современные браузеры',
    gradient: 'from-blue-600 to-blue-400',
    accent: 'blue',
    bgLight: 'bg-blue-50',
    iconBg: 'bg-blue-500',
    mockupIcon: Monitor,
  },
  {
    id: 'guest',
    icon: ShoppingBag,
    name: 'Гостевое приложение',
    subtitle: 'Guest App',
    description:
      'Брендированное приложение для заказа еды. Гости видят меню, оформляют заказы, оплачивают онлайн и отслеживают доставку. Работает как сайт и как мобильное приложение.',
    features: [
      { text: 'Заказ без регистрации' },
      { text: 'Онлайн-оплата' },
      { text: 'Программа лояльности' },
      { text: 'Push-уведомления' },
      { text: 'Чат с поддержкой' },
      { text: 'История заказов' },
    ],
    tech: 'Веб (PWA) + Capacitor (iOS/Android)',
    gradient: 'from-emerald-500 to-green-400',
    accent: 'green',
    bgLight: 'bg-emerald-50',
    iconBg: 'bg-emerald-500',
    mockupIcon: Smartphone,
  },
  {
    id: 'waiter',
    icon: Tablet,
    name: 'Приложение официанта',
    subtitle: 'Waiter App',
    description:
      'Приложение для работы в зале. Посадка гостей, приём заказов, отправка на кухню, приём оплаты и печать чеков — всё с планшета или смартфона.',
    features: [
      { text: 'План зала и управление столами' },
      { text: 'Приём заказов с модификаторами' },
      { text: 'Отправка на кухню' },
      { text: 'Приём оплаты (наличные/карта/QR)' },
      { text: 'Печать чеков' },
      { text: 'Открытие/закрытие смены' },
    ],
    tech: 'Веб (PWA), оптимизировано для планшетов',
    gradient: 'from-violet-500 to-purple-400',
    accent: 'purple',
    bgLight: 'bg-violet-50',
    iconBg: 'bg-violet-500',
    mockupIcon: Tablet,
  },
  {
    id: 'courier',
    icon: Bike,
    name: 'Приложение курьера',
    subtitle: 'Courier App',
    description:
      'Приложение для доставки. Курьер получает заказы, строит маршрут, меняет статусы и общается с рестораном. Геолокация в реальном времени для контроля.',
    features: [
      { text: 'Приём назначенных заказов' },
      { text: 'Статусы: Взять/В пути/Доставлен' },
      { text: 'Карта с маршрутом' },
      { text: 'Геолокация онлайн' },
      { text: 'Чат с администратором' },
      { text: 'Статистика заработка' },
    ],
    tech: 'Веб (PWA), оптимизировано для смартфонов',
    gradient: 'from-orange-500 to-amber-400',
    accent: 'orange',
    bgLight: 'bg-orange-50',
    iconBg: 'bg-orange-500',
    mockupIcon: Bike,
  },
  {
    id: 'kitchen',
    icon: ChefHat,
    name: 'Экран кухни',
    subtitle: 'Kitchen Display',
    description:
      'Приложение для поваров. Заказы от официантов и гостей попадают в общую очередь с таймерами. Отметка готовности автоматически списывает ингредиенты.',
    features: [
      { text: 'Очередь заказов с таймерами' },
      { text: 'Отметка готовности блюд' },
      { text: 'Автосписание ингредиентов' },
      { text: 'Звуковые уведомления о новых заказах' },
      { text: 'График загрузки кухни' },
    ],
    tech: 'Веб (PWA), можно вывести на отдельный экран/телевизор',
    gradient: 'from-red-500 to-rose-400',
    accent: 'red',
    bgLight: 'bg-red-50',
    iconBg: 'bg-red-500',
    mockupIcon: ChefHat,
  },
];

const flowSteps = [
  {
    icon: ShoppingCart,
    label: 'Гость оформляет заказ',
    color: 'text-emerald-500',
    bg: 'bg-emerald-100',
  },
  {
    icon: ChefHat,
    label: 'Кухня видит и готовит',
    color: 'text-red-500',
    bg: 'bg-red-100',
  },
  {
    icon: Users,
    label: 'Официант подаёт',
    color: 'text-violet-500',
    bg: 'bg-violet-100',
  },
  {
    icon: Bike,
    label: 'Курьер доставляет',
    color: 'text-orange-500',
    bg: 'bg-orange-100',
  },
];

function ScreenshotPlaceholder({ app }: { app: AppInfo }) {
  const MockIcon = app.mockupIcon;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl transition-all duration-500 hover:shadow-3xl hover:scale-[1.02]">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      <div className="relative flex aspect-[4/3] items-center justify-center p-8 sm:p-12">
        <div className="text-center">
          <div
            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${app.gradient} shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3`}
          >
            <MockIcon className="h-10 w-10 text-white" />
          </div>
          <p className="mt-5 text-sm font-medium text-gray-400">
            {app.name}
          </p>
          <p className="mt-1 text-xs text-gray-600">{app.subtitle}</p>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1">
        <div className={`h-full w-full bg-gradient-to-r ${app.gradient}`} />
      </div>
    </div>
  );
}

function AppCard({ app, index }: { app: AppInfo; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = app.icon;

  return (
    <section
      className={`relative px-4 py-16 sm:py-24 ${index % 2 === 1 ? app.bgLight : 'bg-white'}`}
    >
      <div className="mx-auto max-w-6xl">
        <div
          className={`grid items-center gap-12 lg:grid-cols-2 ${index % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}
        >
          <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${app.gradient} text-white shadow-lg transition-transform duration-300 hover:scale-110`}
              >
                <IconComponent className="h-6 w-6" />
              </div>
              <span
                className={`rounded-full bg-gradient-to-r ${app.gradient} px-3 py-0.5 text-xs font-semibold text-white`}
              >
                {app.subtitle}
              </span>
            </div>

            <h2 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {app.name}
            </h2>

            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              {app.description}
            </p>

            <div className="mt-8">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-900">
                <LineChart className="h-4 w-4" />
                Что даёт бизнесу
              </h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {app.features.map((feature) => (
                  <li
                    key={feature.text}
                    className="flex items-start gap-3 text-sm text-gray-600"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r ${app.gradient} text-white`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    {feature.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
              <Globe className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-500">{app.tech}</span>
            </div>
          </div>

          <div className={index % 2 === 1 ? 'lg:col-start-1' : ''}>
            <ScreenshotPlaceholder app={app} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Apps() {
  const [hoveredFlow, setHoveredFlow] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 pb-24 pt-20 sm:pb-32 sm:pt-28">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.1),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03),transparent_70%)]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
            5 приложений — один сервер
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Экосистема приложений{' '}
            <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-orange-400 bg-clip-text text-transparent">
              FoodChain
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-gray-300 sm:text-xl">
            Пять приложений, которые полностью покрывают все процессы ресторана
            — от заказа гостем до отчёта управляющего.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-gray-900 shadow-lg shadow-white/10 transition-all duration-300 hover:shadow-xl hover:shadow-white/20 hover:scale-105"
            >
              Начать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20"
            >
              Связаться с нами
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {apps.map((app) => {
              const AppIcon = app.icon;
              return (
                <a
                  key={app.id}
                  href={`#${app.id}`}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-5 text-center backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] hover:border-white/10"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${app.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                  >
                    <AppIcon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-400 transition-colors duration-300 group-hover:text-white">
                    {app.name}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* App Sections */}
      {apps.map((app, index) => (
        <div key={app.id} id={app.id}>
          <AppCard app={app} index={index} />
        </div>
      ))}

      {/* Cross-app Flow */}
      <section className="bg-gray-50 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Как это работает вместе
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Все приложения бесшовно обмениваются данными в реальном времени
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {flowSteps.map((step, i) => {
              const StepIcon = step.icon;
              const isHovered = hoveredFlow === i;

              return (
                <div
                  key={step.label}
                  className="group relative"
                  onMouseEnter={() => setHoveredFlow(i)}
                  onMouseLeave={() => setHoveredFlow(null)}
                >
                  <div
                    className={`relative flex flex-col items-center rounded-2xl border bg-white p-8 shadow-sm transition-all duration-500 ${
                      isHovered
                        ? 'shadow-xl scale-105 border-transparent'
                        : 'border-gray-100'
                    }`}
                  >
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl ${step.bg} transition-all duration-500 ${
                        isHovered ? 'scale-110 shadow-lg' : ''
                      }`}
                    >
                      <StepIcon className={`h-8 w-8 ${step.color}`} />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-gray-900">
                      {step.label}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {i === 0 && 'в приложении'}
                      {i === 1 && 'на экране'}
                      {i === 2 && 'с планшета'}
                      {i === 3 && 'на карте'}
                    </p>
                  </div>

                  {i < flowSteps.length - 1 && (
                    <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 lg:block">
                      <ArrowRight
                        className={`h-6 w-6 transition-all duration-300 ${
                          isHovered || hoveredFlow === i + 1
                            ? 'text-gray-400'
                            : 'text-gray-200'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-gray-200 bg-white px-8 py-6 shadow-sm">
            <p className="text-sm leading-relaxed text-gray-600">
              <span className="font-semibold text-gray-900">Администратор</span>{' '}
              видит всё в единых отчётах: от поступления заказа до закрытия
              смены. Каждое действие в любом приложении мгновенно отражается в
              админ-панели.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 py-20 sm:py-28">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.12),transparent_50%)]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Готовы запустить?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-300">
            Разверните всю экосистему FoodChain за один день. Бесплатный
            пробный период на 14 дней.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-gray-900 shadow-lg shadow-white/10 transition-all duration-300 hover:shadow-xl hover:shadow-white/20 hover:scale-105"
            >
              Попробовать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20"
            >
              Запросить демо
            </Link>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Запуск за 1 день
            </span>
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Без привязки карты
            </span>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Поддержка 24/7
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
