import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Monitor, ShoppingBag, Tablet, Bike, ChefHat, Smartphone,
  ArrowRight, Check, Globe, Clock, CreditCard, Users,
  Printer, BarChart3, Search, Play, Star, MapPin, MessageCircle, X,
} from 'lucide-react';

interface AppInfo {
  id: string;
  icon: React.ElementType;
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  tech: string;
  screenshots: string[];
  video?: string;
}

const apps: AppInfo[] = [
  {
    id: 'backoffice',
    icon: Monitor,
    name: 'Админ-панель',
    subtitle: 'Back Office',
    description: 'Полное управление рестораном: меню, склад, заказы, финансы, персонал и маркетинг в одном окне. Работает в браузере на любом устройстве с адаптивным интерфейсом.',
    features: [
      'Управление меню и техкартами',
      'Склад и инвентаризация',
      'Все статусы заказов в реальном времени',
      'Финансы и отчёты с графиками',
      'Персонал: смены, KPI, зарплата',
      'Маркетинг: акции, промокоды',
    ],
    tech: 'Веб-приложение (PWA), все современные браузеры',
    screenshots: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop',
    ],
  },
  {
    id: 'guest',
    icon: ShoppingBag,
    name: 'Гостевое приложение',
    subtitle: 'Guest App',
    description: 'Брендированное PWA-приложение для заказа еды. Гости видят меню, оформляют заказы, оплачивают онлайн и отслеживают доставку. Полностью под ваш бренд.',
    features: [
      'Заказ без регистрации',
      'Онлайн-оплата картой и СБП',
      'Программа лояльности и баллы',
      'Push-уведомления о статусе',
      'Чат с поддержкой ресторана',
      'История всех заказов',
    ],
    tech: 'PWA + Capacitor (iOS/Android)',
    screenshots: [
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=800&h=500&fit=crop',
    ],
  },
  {
    id: 'waiter',
    icon: Tablet,
    name: 'Приложение официанта',
    subtitle: 'Waiter App',
    description: 'Работа в зале с планшета: посадка гостей, приём заказов с модификаторами, отправка на кухню и приём оплаты. Интуитивный интерфейс для быстрой работы.',
    features: [
      'План зала и управление столами',
      'Приём заказов с модификаторами',
      'Отправка на кухню (KDS)',
      'Приём оплаты: нал/карта/QR',
      'Печать чеков и пречеков',
      'Открытие/закрытие смены',
    ],
    tech: 'PWA, оптимизировано для планшетов (iPad/Android)',
    screenshots: [
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=500&fit=crop',
    ],
  },
  {
    id: 'courier',
    icon: Bike,
    name: 'Приложение курьера',
    subtitle: 'Courier App',
    description: 'Приложение для доставки с геолокацией в реальном времени. Курьер получает заказы, строит оптимальный маршрут и общается с рестораном.',
    features: [
      'Приём назначенных заказов',
      'Статусы: Взять/В пути/Доставлен',
      'Карта с оптимальным маршрутом',
      'Геолокация в реальном времени',
      'Чат с администратором',
      'Статистика заработка за смену',
    ],
    tech: 'PWA, оптимизировано для смартфонов',
    screenshots: [
      'https://images.unsplash.com/photo-1605637367405-6bf1d0f38897?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=800&h=500&fit=crop',
    ],
  },
  {
    id: 'kitchen',
    icon: ChefHat,
    name: 'Экран кухни (KDS)',
    subtitle: 'Kitchen Display',
    description: 'Приложение для поваров: заказы от официантов и гостей попадают в общую очередь с таймерами. Отметка готовности автоматически списывает ингредиенты.',
    features: [
      'Очередь заказов с таймерами',
      'Отметка готовности блюд',
      'Автосписание ингредиентов',
      'Звуковые уведомления',
      'График загрузки кухни',
      'Цветовая маркировка времени',
    ],
    tech: 'PWA, можно вывести на отдельный экран/телевизор',
    screenshots: [
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1507048331197-7d4ac70811cf?w=800&h=500&fit=crop',
    ],
  },
  {
    id: 'manager',
    icon: BarChart3,
    name: 'Приложение управляющего',
    subtitle: 'Manager App',
    description: 'Мобильный дашборд для руководителя: выручка, загрузка зала, средний чек и ключевые метрики в реальном времени на смартфоне.',
    features: [
      'Выручка и прибыль онлайн',
      'Загрузка зала и средний чек',
      'Сравнение с прошлым периодом',
      'Уведомления об аномалиях',
      'Отчёты по каждому филиалу',
      'Мгновенный экспорт',
    ],
    tech: 'PWA для смартфонов и планшетов',
    screenshots: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop',
    ],
  },
  {
    id: 'selforder',
    icon: Smartphone,
    name: 'Киоск самообслуживания',
    subtitle: 'Self-Order Kiosk',
    description: 'Сенсорный киоск для самостоятельного заказа в зале. Гости выбирают блюда, оплачивают и забирают заказ без участия кассира. Сокращает очереди.',
    features: [
      'Яркое меню с фото блюд',
      'Оплата картой и наличными',
      'QR-код для получения заказа',
      'Поддержка нескольких языков',
      'Адаптация под бренд',
      'Статистика использования',
    ],
    tech: 'Веб-приложение для сенсорных киосков',
    screenshots: [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop',
    ],
  },
  {
    id: 'analytics',
    icon: Globe,
    name: 'Партнёрский портал',
    subtitle: 'Partner Portal',
    description: 'Портал для сетевых ресторанов и франчайзи: единая аналитика по всем точкам, управление меню сети, маркетинговые кампании и контроль качества.',
    features: [
      'Единая аналитика по сети',
      'Централизованное меню',
      'Сетевые маркетинговые кампании',
      'Контроль качества и аудит',
      'Обучение и онбординг',
      'Общий документооборот',
    ],
    tech: 'Веб-приложение, адаптивный дизайн',
    screenshots: [
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=500&fit=crop',
    ],
  },
];

const flowSteps = [
  { icon: ShoppingBag, label: 'Гость оформляет заказ', desc: 'в приложении или на сайте' },
  { icon: ChefHat, label: 'Кухня видит и готовит', desc: 'на экране KDS с таймером' },
  { icon: Tablet, label: 'Официант подаёт', desc: 'с планшета в зал' },
  { icon: Bike, label: 'Курьер доставляет', desc: 'с геолокацией онлайн' },
];

function ScreenshotModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 text-white/60 hover:text-white transition">
          <X className="h-8 w-8" />
        </button>
        <img src={src} alt="" className="w-full rounded-2xl shadow-2xl" />
      </div>
    </div>
  );
}

function AppSection({ app, index }: { app: AppInfo; index: number }) {
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const IconComponent = app.icon;

  return (
    <section className={`relative px-4 py-16 sm:py-24 ${index % 2 === 1 ? 'bg-white/[0.02] border-y border-white/5' : ''}`} id={app.id}>
      <div className="mx-auto max-w-6xl">
        <div className={`grid items-center gap-12 lg:grid-cols-2 ${index % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}>
          <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                <IconComponent className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                {app.subtitle}
              </span>
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">{app.name}</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">{app.description}</p>
            <div className="mt-8">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-cyan-400">
                <Check className="h-4 w-4" />
                Что даёт бизнесу
              </h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {app.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-slate-400">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                      <Check className="h-3 w-3" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-5 py-3">
              <Globe className="h-5 w-5 text-cyan-500" />
              <span className="text-sm text-slate-500">{app.tech}</span>
            </div>
          </div>
          <div className={index % 2 === 1 ? 'lg:col-start-1' : ''}>
            <div className="grid grid-cols-2 gap-3">
              {app.screenshots.map((src, i) => (
                <button key={i} onClick={() => setModalSrc(src)} className="group relative overflow-hidden rounded-xl">
                  <img src={src} alt="" className="w-full h-44 sm:h-56 object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Search className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {modalSrc && <ScreenshotModal src={modalSrc} onClose={() => setModalSrc(null)} />}
    </section>
  );
}

export function Apps() {
  const [hoveredFlow, setHoveredFlow] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-24 pt-20 sm:pb-32 sm:pt-28">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_top_right,_rgba(0,180,216,0.15),transparent_50%)]" />
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_bottom_left,_rgba(0,150,200,0.08),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.02),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
            8 приложений — один сервер
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Экосистема приложений{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
              FoodChain
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Восемь приложений, которые полностью покрывают все процессы ресторана
            — от заказа гостем до отчёта управляющего.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105"
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
          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {apps.map((app) => {
              const AppIcon = app.icon;
              return (
                <a
                  key={app.id}
                  href={`#${app.id}`}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-5 text-center backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] hover:border-white/10"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <AppIcon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-400 transition-colors duration-300 group-hover:text-white">{app.name}</span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* App Sections */}
      {apps.map((app, index) => (
        <AppSection key={app.id} app={app} index={index} />
      ))}

      {/* Cross-app Flow */}
      <section className="border-t border-white/5 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Как это работает вместе</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">Все приложения бесшовно обмениваются данными в реальном времени</p>
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
                    className={`relative flex flex-col items-center rounded-2xl border bg-white/[0.03] p-8 backdrop-blur-sm transition-all duration-500 ${
                      isHovered ? 'border-cyan-500/30 scale-105 shadow-xl shadow-cyan-500/10' : 'border-white/5'
                    }`}
                  >
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 transition-all duration-500 ${
                        isHovered ? 'scale-110 shadow-lg shadow-cyan-500/10' : ''
                      }`}
                    >
                      <StepIcon className="h-8 w-8 text-cyan-400" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-white">{step.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{step.desc}</p>
                  </div>
                  {i < flowSteps.length - 1 && (
                    <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 lg:block">
                      <ArrowRight className={`h-6 w-6 transition-all duration-300 ${isHovered || hoveredFlow === i + 1 ? 'text-cyan-500' : 'text-slate-700'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-white/5 bg-white/[0.03] px-8 py-6 backdrop-blur-sm">
            <p className="text-sm leading-relaxed text-slate-400">
              <span className="font-semibold text-white">Администратор</span>{' '}
              видит всё в единых отчётах: от поступления заказа до закрытия смены.
              Каждое действие в любом приложении мгновенно отражается в админ-панели.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-white/5 px-4 py-20 sm:py-28">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_center,_rgba(0,180,216,0.1),transparent_50%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Готовы запустить?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">Разверните всю экосистему FoodChain за один день. Бесплатный пробный период на 14 дней.</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105"
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
          <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500">
            <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-cyan-400" />Запуск за 1 день</span>
            <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-cyan-400" />Без привязки карты</span>
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-cyan-400" />Поддержка 24/7</span>
          </div>
        </div>
      </section>
    </div>
  );
}
