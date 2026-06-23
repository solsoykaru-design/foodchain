import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu, ShoppingCart, Package, Users, BarChart3, Megaphone,
  CalendarCheck, Globe, Smartphone, ChefHat, Bike, CreditCard,
  Printer, Bell, Shield, RefreshCw, FileText, MessageCircle,
  ChevronDown, Search, Filter, Play, Star, ArrowRight,
  Check, X, Clock, MapPin, Gift, TrendingUp, Layers, Zap,
} from 'lucide-react';

type Category = 'all' | 'orders' | 'management' | 'finance' | 'marketing' | 'staff';

interface Stat {
  icon: React.ElementType;
  value: string;
  label: string;
}

interface FeatureModule {
  icon: React.ElementType;
  title: string;
  description: string;
  details: string;
  features: string[];
  category: Category;
  screenshots: string[];
  video?: string;
}

interface ScreenshotModalProps {
  src: string;
  onClose: () => void;
}

const stats: Stat[] = [
  { icon: Zap, value: '50K+', label: 'Заказов/мес' },
  { icon: Users, value: '500+', label: 'Ресторанов' },
  { icon: Layers, value: '18', label: 'Модулей' },
  { icon: Clock, value: '99.9%', label: 'Uptime' },
];

const modules: FeatureModule[] = [
  {
    icon: ShoppingCart,
    title: 'Приём заказов',
    description: 'Единое окно для всех каналов',
    details: 'Принимайте заказы из мобильного приложения, веб-сайта, Telegram и агрегаторов в одном интерфейсе. Автоматическое подтверждение, статусы в реальном времени и мгновенная отправка на кухню.',
    features: [
      'Заказы из приложения, сайта и Telegram',
      'Интеграция с Яндекс.Еда, Delivery Club',
      'Автоподтверждение и отмена',
      'Статусы в реальном времени',
      'История всех заказов',
      'Детализация по каждому блюду',
    ],
    category: 'orders',
    screenshots: [
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Menu,
    title: 'Управление меню',
    description: 'Гибкий конструктор ассортимента',
    details: 'Создавайте меню любой сложности с категориями, модификаторами и технологическими картами. Мгновенная публикация во все приложения и сезонные предложения.',
    features: [
      'Категории и подкатегории',
      'Модификаторы и дополнения',
      'Технологические карты (ТК)',
      'Сезонное меню по расписанию',
      'Автопубликация в приложения',
      'Импорт из Excel',
    ],
    category: 'management',
    screenshots: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Package,
    title: 'Склад и инвентаризация',
    description: 'Полный контроль остатков',
    details: 'Автоматизируйте учёт продуктов: приход, расход, списание и инвентаризация. Технологические карты автоматически рассчитывают потребность в ингредиентах.',
    features: [
      'Остатки в реальном времени',
      'Приход и списание товаров',
      'Авторасчёт по техкартам',
      'Инвентаризация с терминалом',
      'Уведомления о мин. остатках',
      'Поставщики и закупки',
    ],
    category: 'management',
    screenshots: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Users,
    title: 'Персонал и смены',
    description: 'Управление командой',
    details: 'Управляйте сотрудниками, ролями, графиками и зарплатой. Встроенная система KPI помогает мотивировать персонал и повышать качество сервиса.',
    features: [
      'Профили сотрудников и роли',
      'График смен и учёт времени',
      'Расчёт зарплаты и чаевых',
      'KPI и рейтинг сотрудников',
      'Push-уведомления персоналу',
      'Заявки на отгулы',
    ],
    category: 'staff',
    screenshots: [
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: BarChart3,
    title: 'Финансы и аналитика',
    description: 'Прозрачные отчёты',
    details: 'Детальные отчёты по выручке, расходам и прибыли. Анализируйте фудкост, маржинальность блюд и эффективность заведений в реальном времени.',
    features: [
      'Выручка и средний чек',
      'Фудкост и маржинальный анализ',
      'Отчёты по каждому заведению',
      'Интерактивные дашборды',
      'Экспорт в Excel и 1С',
      'Сравнение периодов',
    ],
    category: 'finance',
    screenshots: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Megaphone,
    title: 'Маркетинг и акции',
    description: 'Рост продаж',
    details: 'Запускайте акции и промокоды за минуты. Настраивайте скидки, программы лояльности и push-уведомления для удержания гостей.',
    features: [
      'Акции и спецпредложения',
      'Промокоды и скидки',
      'Программа лояльности',
      'Push-уведомления гостям',
      'A/B тестирование',
      'Автоматические триггеры',
    ],
    category: 'marketing',
    screenshots: [
      'https://images.unsplash.com/photo-1557838923-2985c318be48?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: CalendarCheck,
    title: 'Бронирование столов',
    description: 'Управление залом',
    details: 'Визуальная схема зала с бронированием столов. Гости бронируют онлайн, вы управляете рассадкой и видите загрузку в реальном времени.',
    features: [
      'Схема зала с расстановкой',
      'Онлайн-бронирование для гостей',
      'Подтверждение и напоминания',
      'История бронирований',
      'Статистика загрузки зала',
      'Интеграция с Яндекс.Карты',
    ],
    category: 'orders',
    screenshots: [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Smartphone,
    title: 'Гостевое приложение',
    description: 'Брендированное приложение',
    details: 'Полностью брендированное приложение для заказа еды с меню, оплатой, программой лояльности и push-уведомлениями. Работает как PWA и на iOS/Android.',
    features: [
      'Заказ без регистрации',
      'Онлайн-оплата картой',
      'Программа лояльности',
      'Push-уведомления',
      'Чат с поддержкой',
      'История заказов',
    ],
    category: 'orders',
    screenshots: [
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: ChefHat,
    title: 'Экран кухни (KDS)',
    description: 'Управление приготовлением',
    details: 'Заказы от официантов и гостей попадают в общую очередь с таймерами. Отметка готовности автоматически списывает ингредиенты со склада.',
    features: [
      'Очередь заказов с таймерами',
      'Отметка готовности блюд',
      'Автосписание ингредиентов',
      'Звуковые уведомления',
      'График загрузки кухни',
      'Цветовая маркировка времени',
    ],
    category: 'orders',
    screenshots: [
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1507048331197-7d4ac70811cf?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Bike,
    title: 'Доставка и курьеры',
    description: 'Управление доставкой',
    details: 'Приложение для курьеров с маршрутами, геолокацией в реальном времени и статусами заказов. Оптимальное распределение заказов между курьерами.',
    features: [
      'Назначение заказов курьерам',
      'Карта с маршрутом',
      'Геолокация онлайн',
      'Статусы: Взять/В пути/Доставлен',
      'Чат с администратором',
      'Статистика заработка',
    ],
    category: 'orders',
    screenshots: [
      'https://images.unsplash.com/photo-1605637367405-6bf1d0f38897?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: CreditCard,
    title: 'Онлайн-оплата',
    description: 'Приём платежей',
    details: 'Принимайте оплату картами, QR-кодами и наличными. Интеграция с ведущими платёжными провайдерами. Мгновенные возвраты и детальная отчётность.',
    features: [
      'Оплата картой онлайн',
      'QR-коды (СБП)',
      'Наличные в заведении',
      'Мгновенные возвраты',
      'Чеки и отчётность',
      'Интеграция с 54-ФЗ',
    ],
    category: 'finance',
    screenshots: [
      'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Globe,
    title: 'Интеграции и API',
    description: 'Всё работает вместе',
    details: 'Подключайте сервисы доставки, онлайн-оплату, 1С и Telegram. Открытый API для кастомных интеграций. Единая экосистема без ручного переноса данных.',
    features: [
      'Агрегаторы доставки',
      'Интеграция с 1С',
      'Telegram-бот для заказов',
      'Платёжные провайдеры',
      'Open API для разработчиков',
      'Webhook-уведомления',
    ],
    category: 'management',
    screenshots: [
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Shield,
    title: 'Безопасность и роли',
    description: 'Защита данных',
    details: 'Гибкая система ролей и прав доступа для каждого сотрудника. Все действия логируются. Соответствие требованиям 152-ФЗ о персональных данных.',
    features: [
      'Роли: админ, менеджер, повар, курьер',
      'Доступ по отделам',
      'Журнал аудита',
      'Двухфакторная аутентификация',
      'Шифрование данных',
      'Резервное копирование',
    ],
    category: 'staff',
    screenshots: [
      'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Printer,
    title: 'Печать чеков и этикеток',
    description: 'Поддержка любого оборудования',
    details: 'Подключайте фискальные регистраторы, принтеры чеков и этикеток. Автоматическая печать при открытии заказа и закрытии смены.',
    features: [
      'Фискальные регистраторы',
      'Принтеры чеков (Epson, Atol)',
      'Принтеры этикеток',
      'Автопечать на кухне',
      'Настройка шаблонов',
      'Поддержка 54-ФЗ',
    ],
    category: 'management',
    screenshots: [
      'https://images.unsplash.com/photo-1615221653529-1b0fa6459a5b?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: Bell,
    title: 'Уведомления и оповещения',
    description: 'Всегда в курсе событий',
    details: 'Настраивайте уведомления о новых заказах, минимальных остатках, отзывах гостей и других событиях. Push, email, SMS и Telegram.',
    features: [
      'Push-уведомления в приложения',
      'Email-рассылки',
      'SMS-оповещения',
      'Telegram-уведомления',
      'Настраиваемые триггеры',
      'Массовые рассылки',
    ],
    category: 'marketing',
    screenshots: [
      'https://images.unsplash.com/photo-1517292987719-0369a794ec0f?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1557200139-903d80c340cd?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: MessageCircle,
    title: 'Отзывы и рейтинги',
    description: 'Обратная связь от гостей',
    details: 'Собирайте отзывы гостей после каждого заказа. Отвечайте на отзывы, управляйте рейтингом заведения и анализируйте удовлетворённость.',
    features: [
      'Сбор отзывов после заказа',
      'Рейтинг блюд и заведения',
      'Ответы на отзывы',
      'Анализ настроений (NPS)',
      'Интеграция с 2ГИС, Яндекс',
      'Уведомления о новых отзывах',
    ],
    category: 'marketing',
    screenshots: [
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Прогнозы и AI',
    description: 'Умная аналитика',
    details: 'Искусственный интеллект прогнозирует спрос на блюда, оптимальные закупки продуктов и загрузку зала. Планируйте ресурсы на основе данных.',
    features: [
      'Прогноз спроса на блюда',
      'Оптимальные закупки',
      'Прогноз загрузки зала',
      'Рекомендации по меню',
      'Выявление аномалий',
      'Автоматические отчёты',
    ],
    category: 'finance',
    screenshots: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=500&fit=crop',
    ],
  },
  {
    icon: FileText,
    title: 'Документы и отчёты',
    description: 'Полная документация',
    details: 'Автоматическое формирование закрывающих документов, отчётов перед налоговой и внутренней отчётности. Интеграция с ЭДО.',
    features: [
      'Закрывающие документы',
      'Отчёты перед налоговой',
      'Внутренняя отчётность',
      'Интеграция с ЭДО',
      'Электронная подпись',
      'Архив документов',
    ],
    category: 'finance',
    screenshots: [
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=500&fit=crop',
    ],
  },
];

const comparisonRows = [
  { feature: 'Управление меню', basic: true, pro: true, corp: true },
  { feature: 'Приём заказов', basic: 'до 500/мес', pro: 'до 2 000/мес', corp: 'безлимит' },
  { feature: 'Складской учёт', basic: false, pro: true, corp: true },
  { feature: 'Персонал', basic: 'до 5 сотр.', pro: 'до 20 сотр.', corp: 'безлимит' },
  { feature: 'Филиалы', basic: '1 точка', pro: 'до 3 точек', corp: 'безлимит' },
  { feature: 'Базовая аналитика', basic: true, pro: true, corp: true },
  { feature: 'Расширенная аналитика', basic: false, pro: true, corp: true },
  { feature: 'Маркетинг и акции', basic: false, pro: true, corp: true },
  { feature: 'Интеграция с агрегаторами', basic: false, pro: true, corp: true },
  { feature: 'Мобильные приложения', basic: false, pro: 'брендирование', corp: 'полный WHL' },
  { feature: 'Экран кухни (KDS)', basic: false, pro: true, corp: true },
  { feature: 'Приложение курьера', basic: false, pro: true, corp: true },
  { feature: 'AI-прогнозы', basic: false, pro: false, corp: true },
  { feature: 'Персональный менеджер', basic: false, pro: false, corp: true },
  { feature: 'Техподдержка', basic: 'email', pro: 'приоритетная', corp: '24/7 личный' },
  { feature: 'ЭДО и документы', basic: false, pro: false, corp: true },
];

const categories: { value: Category; label: string }[] = [
  { value: 'all', label: 'Все модули' },
  { value: 'orders', label: 'Заказы' },
  { value: 'management', label: 'Управление' },
  { value: 'finance', label: 'Финансы' },
  { value: 'marketing', label: 'Маркетинг' },
  { value: 'staff', label: 'Персонал' },
];

const testimonials = [
  { text: 'FoodChain помог нам увеличить средний чек на 23% за счёт умных рекомендаций и программы лояльности.', name: 'Алексей К.', role: 'Владелец сети кофеен, г. Москва' },
  { text: 'Складской учёт и автоматическое списание продуктов сэкономили нам 40 часов работы в месяц.', name: 'Елена М.', role: 'Управляющая рестораном, г. Санкт-Петербург' },
  { text: 'Перешли на FoodChain 6 месяцев назад. Количество ошибок в заказах снизилось до нуля.', name: 'Дмитрий С.', role: 'Шеф-повар, г. Казань' },
];

function ScreenshotModal({ src, onClose }: ScreenshotModalProps) {
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

function FeatureCard({ mod, index, isOpen, onToggle }: { mod: FeatureModule; index: number; isOpen: boolean; onToggle: () => void }) {
  const IconComponent = mod.icon;
  const [modalSrc, setModalSrc] = useState<string | null>(null);

  return (
    <div
      className={`group rounded-2xl border transition-all duration-500 ${
        isOpen
          ? 'border-cyan-500/30 bg-gradient-to-br from-[#0f2035] to-[#0a1628] shadow-xl shadow-cyan-500/5'
          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
      }`}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-5 p-6 text-left sm:p-7">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 transition-transform duration-300 group-hover:scale-105">
          <IconComponent className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white">{mod.title}</h3>
          <p className="mt-0.5 text-sm text-slate-400">{mod.description}</p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="border-t border-white/5 px-6 pb-7 pt-5 sm:px-7 sm:pb-7 sm:pt-5 space-y-6">
          <p className="text-slate-300 leading-relaxed">{mod.details}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ul className="space-y-2.5">
              {mod.features.slice(0, 3).map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm text-slate-400">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                    <Check className="h-3 w-3" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <ul className="space-y-2.5">
              {mod.features.slice(3).map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm text-slate-400">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                    <Check className="h-3 w-3" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mod.screenshots.map((src, i) => (
              <button key={i} onClick={() => setModalSrc(src)} className="group/thumb relative overflow-hidden rounded-xl">
                <img src={src} alt="" className="w-full h-36 sm:h-44 object-cover transition-transform duration-500 group-hover/thumb:scale-110" />
                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition-colors flex items-center justify-center">
                  <Search className="h-6 w-6 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
          {mod.video && (
            <a href={mod.video} target="_blank" className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition">
              <Play className="h-4 w-4" />
              Смотреть видео-обзор
            </a>
          )}
        </div>
      </div>
      {modalSrc && <ScreenshotModal src={modalSrc} onClose={() => setModalSrc(null)} />}
    </div>
  );
}

export function Features() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [category, setCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);
  const observerRef = useRef<HTMLDivElement>(null);

  const filtered = modules.filter((mod) => {
    const matchCat = category === 'all' || mod.category === category;
    const matchSearch = !searchQuery || mod.title.toLowerCase().includes(searchQuery.toLowerCase()) || mod.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const visibleModules = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + 4, filtered.length));
        }
      },
      { threshold: 0.1 }
    );
    if (observerRef.current) obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [hasMore, filtered.length]);

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-20 sm:pb-28 sm:pt-28">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_top_right,_rgba(0,180,216,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_bottom_left,_rgba(0,150,200,0.06),transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <span className="inline-block rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-cyan-500/20">
            18 модулей — одна платформа
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Возможности{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              FoodChain
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Всё, что нужно для управления рестораном — от меню до финансов.
            Единая платформа для автоматизации бизнеса любого масштаба.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105"
            >
              Начать бесплатно
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 pb-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/[0.03] px-6 py-6 text-center backdrop-blur-sm">
                  <StatIcon className="mx-auto h-6 w-6 text-cyan-400" />
                  <div className="mt-2 text-2xl font-bold text-white sm:text-3xl">{stat.value}</div>
                  <div className="mt-1 text-xs text-slate-500">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="sticky top-20 z-30 border-b border-white/5 bg-[#0a1628]/95 backdrop-blur-xl px-4 py-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Поиск модулей..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(6); }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => { setCategory(cat.value); setVisibleCount(6); }}
                  className={`shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition ${
                    category === cat.value
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-white/[0.05] text-slate-400 border border-white/5 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 pb-16 pt-8 sm:pb-24">
        <div className="mx-auto max-w-5xl space-y-3">
          {visibleModules.map((mod, idx) => (
            <FeatureCard
              key={mod.title}
              mod={mod}
              index={idx}
              isOpen={openIndex === idx}
              onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
            />
          ))}
          {visibleModules.length === 0 && (
            <div className="text-center py-20">
              <Search className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">Ничего не найдено</p>
            </div>
          )}
          <div ref={observerRef} className="h-4" />
        </div>
      </section>

      {/* Comparison Table */}
      <section className="border-t border-white/5 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Сравнение тарифов
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-400">
            Все модули доступны в каждом тарифе с разными лимитами
          </p>
          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-4 text-left text-sm font-semibold text-slate-400">Функция</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-slate-400">Базовый</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-cyan-400 bg-cyan-500/5 rounded-t-xl">Профессиональный</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-slate-400">Корпоративный</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                    <td className="px-4 py-4 text-sm text-white">{row.feature}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-sm ${typeof row.basic === 'string' ? 'text-slate-400' : ''}`}>
                        {row.basic === true ? <Check className="h-4 w-4 text-emerald-400" /> : row.basic === false ? <X className="h-4 w-4 text-slate-600" /> : row.basic}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center bg-cyan-500/5">
                      <span className={`inline-flex items-center gap-1.5 text-sm ${typeof row.pro === 'string' ? 'text-slate-300' : ''}`}>
                        {row.pro === true ? <Check className="h-4 w-4 text-emerald-400" /> : row.pro === false ? <X className="h-4 w-4 text-slate-600" /> : row.pro}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-sm ${typeof row.corp === 'string' ? 'text-slate-300' : ''}`}>
                        {row.corp === true ? <Check className="h-4 w-4 text-emerald-400" /> : row.corp === false ? <X className="h-4 w-4 text-slate-600" /> : row.corp}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-white/5 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Отзывы клиентов
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-400">
            Реальные результаты от реальных пользователей
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-sm">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-cyan-400 text-cyan-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{t.text}</p>
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-400 mb-6">
            <Zap className="h-3.5 w-3.5" />
            Бесплатно 14 дней
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Готовы автоматизировать бизнес?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Попробуйте FoodChain бесплатно в течение 14 дней. Без привязки карты
            и скрытых платежей. Все модули доступны в пробный период.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105"
            >
              Попробовать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20"
            >
              Запросить демо
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
