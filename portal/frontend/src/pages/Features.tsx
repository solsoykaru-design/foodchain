import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Megaphone,
  CalendarCheck,
  Globe,
  Smartphone,
  ChevronDown,
} from 'lucide-react';

interface FeatureModule {
  icon: React.ElementType;
  title: string;
  description: string;
  details: string;
  features: string[];
  gradient: string;
}

const modules: FeatureModule[] = [
  {
    icon: Menu,
    title: 'Управление меню',
    description: 'Гибкое управление всем ассортиментом',
    details:
      'Создавайте и редактируйте меню любой сложности. Поддерживайте актуальность цен, сезонные предложения и технологические карты в пару кликов.',
    features: [
      'Категории и подкатегории блюд',
      'Модификаторы и дополнения',
      'Технологические карты (ТК)',
      'Сезонное и временное меню',
      'Автопубликация в приложения',
    ],
    gradient: 'from-orange-500 to-red-500',
  },
  {
    icon: ShoppingCart,
    title: 'Приём заказов',
    description: 'Все заказы в одном окне',
    details:
      'Принимайте заказы из любых каналов — мобильное приложение, сайт, агрегаторы и Telegram. Единый интерфейс для обработки и контроля.',
    features: [
      'Заказы из мобильного приложения',
      'Заказы с сайта и Telegram',
      'Интеграция с агрегаторами',
      'Автоподтверждение и отмена',
      'Статусы в реальном времени',
    ],
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Package,
    title: 'Управление складом',
    description: 'Полный контроль остатков',
    details:
      'Автоматизируйте учёт продуктов: приход, расход, списание и инвентаризация. Технологические карты автоматически рассчитывают потребность в ингредиентах.',
    features: [
      'Остатки в реальном времени',
      'Приход и списание товаров',
      'Авторасчёт по техкартам',
      'Инвентаризация с терминалом',
      'Уведомления о минимальных остатках',
    ],
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: Users,
    title: 'Персонал',
    description: 'Эффективное управление командой',
    details:
      'Управляйте сотрудниками, ролями, графиками и зарплатой. Встроенная система KPI помогает мотивировать персонал и повышать качество сервиса.',
    features: [
      'Профили сотрудников и роли',
      'График смен и учёт времени',
      'Расчёт зарплаты и чаевых',
      'KPI и рейтинг сотрудников',
      'Push-уведомления персоналу',
    ],
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: BarChart3,
    title: 'Финансы и отчёты',
    description: 'Прозрачная финансовая аналитика',
    details:
      'Детальные отчёты по выручке, расходам и прибыли. Анализируйте фудкост, маржинальность блюд и эффективность заведений в реальном времени.',
    features: [
      'Выручка и средний чек',
      'Фудкост и маржинальный анализ',
      'Отчёты по каждому заведению',
      'Графики и дашборды',
      'Экспорт в Excel и 1С',
    ],
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: Megaphone,
    title: 'Маркетинг',
    description: 'Инструменты для роста продаж',
    details:
      'Запускайте акции и промокоды за минуты. Настраивайте скидки, программы лояльности и push-уведомления для удержания гостей.',
    features: [
      'Акции и специальные предложения',
      'Промокоды и скидки',
      'Программа лояльности',
      'Push-уведомления гостям',
      'A/B тестирование маркетинга',
    ],
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    icon: CalendarCheck,
    title: 'Бронирование',
    description: 'Управление залом и столами',
    details:
      'Визуальная схема зала с бронированием столов. Гости бронируют онлайн, вы управляете рассадкой и видите загрузку в реальном времени.',
    features: [
      'Схема зала с расстановкой',
      'Онлайн-бронирование для гостей',
      'Подтверждение и напоминания',
      'История бронирований',
      'Статистика загрузки зала',
    ],
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    icon: Globe,
    title: 'Интеграции',
    description: 'Всё работает вместе',
    details:
      'Подключайте сервисы доставки, онлайн-оплату, 1С и Telegram. Единая экосистема без ручного переноса данных и ошибок.',
    features: [
      'Онлайн-оплата картой и наличными',
      'Агрегаторы доставки',
      'Интеграция с 1С',
      'Telegram-бот для заказов',
      'Open API для разработчиков',
    ],
    gradient: 'from-sky-500 to-indigo-500',
  },
  {
    icon: Smartphone,
    title: 'Мобильные приложения',
    description: 'Брендированные приложения для всех',
    details:
      'Гостевые приложения для заказа, приложение курьера, официанта и кухни. Полностью брендируются под ваш ресторан.',
    features: [
      'Гостевой — заказ и оплата',
      'Курьер — доставка и маршруты',
      'Официант — приём заказов',
      'Кухня — отображение заказов',
      'Брендирование под ваш стиль',
    ],
    gradient: 'from-red-500 to-orange-500',
  },
];

function AccordionSection({ module, isOpen, onToggle }: {
  module: FeatureModule;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const IconComponent = module.icon;

  return (
    <div className="group rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:shadow-lg hover:border-transparent">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-5 p-6 text-left sm:p-7"
      >
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${module.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-105`}
        >
          <IconComponent className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">
            {module.title}
          </h3>
          <p className="mt-0.5 text-sm text-gray-500">
            {module.description}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-gray-50 px-6 pb-7 pt-5 sm:px-7 sm:pb-7 sm:pt-5">
          <p className="text-gray-600 leading-relaxed">{module.details}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {module.features.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2.5 text-sm text-gray-700"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r ${module.gradient}`}
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function Features() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleSection = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-white px-4 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.08),transparent_50%)]" />
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_bottom_left,_rgba(239,68,68,0.06),transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
            FoodChain
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Возможности{' '}
            <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              FoodChain
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-500 sm:text-xl">
            Всё, что нужно для управления рестораном — от меню до финансов.
            Единая платформа для автоматизации бизнеса.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105"
            >
              Начать бесплатно
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-300"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative -mt-10 px-4 pb-16 sm:-mt-14 sm:pb-24">
        <div className="mx-auto max-w-5xl space-y-4">
          {modules.map((mod, idx) => (
            <AccordionSection
              key={mod.title}
              module={mod}
              isOpen={openIndex === idx}
              onToggle={() => toggleSection(idx)}
            />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Готовы автоматизировать?
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Попробуйте FoodChain бесплатно в течение 14 дней. Без привязки карты
            и скрытых платежей.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105"
            >
              Попробовать бесплатно
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
