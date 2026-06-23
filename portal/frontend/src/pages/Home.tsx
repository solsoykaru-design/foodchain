import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronDown, Menu, X, Star,
  Smartphone, Monitor, ShoppingCart, Package, BarChart3,
  Users, Megaphone, MessageCircle, Globe, Bike, ChefHat,
  CreditCard, QrCode, Shield, Zap, Settings, PhoneCall,
  MapPin, Truck, Clock, PieChart, Activity, Warehouse,
  Building2, Coffee, UtensilsCrossed, Pizza, Store, ClipboardList,
  UserCheck, FileText, TrendingUp, Headphones, DollarSign, Gift,
} from 'lucide-react';

const venueTypes = ['Рестораны', 'Кафе', 'Доставка', 'Бары', 'Пекарни', 'Фудтраки'];

const benefitIcons = [
  { icon: Settings, label: 'Гибкая стоимость под ваш бизнес' },
  { icon: Monitor, label: 'Вся функциональность в одном бэк-офисе' },
  { icon: Zap, label: 'Бесплатное внедрение' },
  { icon: PhoneCall, label: 'Бесплатная техподдержка' },
  { icon: Truck, label: 'Интеграция с Яндекс.Едой, Delivery Club и другими' },
];

const features = [
  { icon: ShoppingCart, title: 'Управление заказами', desc: 'Принимайте заказы из зала, с доставки и самовывоза в одном окне.' },
  { icon: Package, title: 'Склад и техкарты', desc: 'Полный контроль остатков, автозаказ продуктов, калькуляция блюд.' },
  { icon: BarChart3, title: 'Финансы и отчёты', desc: 'Выручка, прибыль, средний чек, фудкост — вся аналитика в реальном времени.' },
  { icon: Users, title: 'Управление персоналом', desc: 'График смен, учёт рабочего времени, чаевые, KPI, мотивация.' },
  { icon: Megaphone, title: 'Маркетинг и акции', desc: 'Акции, скидки, программы лояльности, push-уведомления.' },
  { icon: MessageCircle, title: 'Встроенные чаты', desc: 'Гость ↔ официант, гость ↔ курьер, курьер ↔ официант.' },
  { icon: Bike, title: 'Управление доставкой', desc: 'Автоматическое назначение курьера, оптимальный маршрут по карте.' },
  { icon: BarChart3, title: 'Аналитика и прогноз', desc: 'ML-модель прогнозирует продажи и закупки на основе данных.' },
  { icon: Globe, title: 'Интеграции и API', desc: 'Эквайринг, фискализация, Telegram, соцсети, 1С, агрегаторы.' },
  { icon: Shield, title: 'Безопасность и 2FA', desc: 'Двухфакторная аутентификация, аудит всех действий.' },
  { icon: MessageCircle, title: 'Чаты в реальном времени', desc: 'Общение гостя с официантом и курьером без звонков.' },
  { icon: Gift, title: 'Геймификация', desc: 'Колесо удачи, викторины, челленджи для вовлечения гостей.' },
  { icon: DollarSign, title: 'Мультивалютность', desc: 'Поддержка нескольких валют для международных сетей.' },
  { icon: Headphones, title: 'Оператор колл-центра', desc: 'Интерфейс для приёма заказов по телефону.' },
  { icon: QrCode, title: 'QR-самозаказ', desc: 'Гость сканирует QR и делает заказ сам со смартфона.' },
  { icon: Shield, title: 'Честный знак', desc: 'Учёт маркированных товаров из коробки.' },
  { icon: Globe, title: 'PWA-приложение', desc: 'Сайт работает как приложение на телефоне без установки.' },
];

const appList = [
  { icon: Smartphone, title: 'Приложение официанта', desc: 'Схема зала, приём заказов, отправка на кухню и оплата с планшета.' },
  { icon: Truck, title: 'Приложение курьера', desc: 'Маршруты, геолокация, статусы доставки на любом смартфоне.' },
  { icon: Monitor, title: 'Киоск самообслуживания', desc: 'Сенсорный терминал для самостоятельного заказа в зале.' },
  { icon: ChefHat, title: 'Экран кухни (KDS)', desc: 'Очередь заказов с таймерами, автосписание ингредиентов.' },
  { icon: BarChart3, title: 'Бэк-офис', desc: 'Дашборд, управление меню, склад, финансы и персонал.' },
  { icon: Globe, title: 'Онлайн-заказы', desc: 'Готовый сайт ресторана с меню, корзиной и онлайн-оплатой.' },
];

const industrySections = [
  {
    icon: UtensilsCrossed, title: 'Рестораны и кафе',
    painPoints: [{ icon: Shield, title: 'Как контролировать сотрудников' }, { icon: Star, title: 'Как контролировать качество блюд' }],
    features: ['Оплата любыми способами', 'Безлимитные техкарты', 'Меню по часам', 'RFM-анализ', 'Складской учет', 'Интеграция с агрегаторами'],
    img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop',
  },
  {
    icon: Pizza, title: 'Фастфуд',
    painPoints: [{ icon: Users, title: 'Высокая текучка персонала' }, { icon: Clock, title: 'Обслуживание в часы пик' }],
    features: ['Киоски самообслуживания', 'Единое управление заказами', 'Зоны доставки на карте', 'Заказ в один клик', 'Приложение для курьера', 'Статусы для покупателей'],
    img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop',
  },
  {
    icon: Truck, title: 'Доставка еды',
    painPoints: [{ icon: MapPin, title: 'Логистика доставки' }, { icon: PieChart, title: 'Управление агрегаторами' }],
    features: ['Сайт для онлайн-заказов', 'Электронная очередь', 'Заказ через QR-коды', 'Удобный интерфейс кассы', 'Баннеры на экранах', 'Автоматические скидки'],
    img: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&h=400&fit=crop',
  },
  {
    icon: Coffee, title: 'Пекарни и кофейни',
    painPoints: [{ icon: Warehouse, title: 'Складской учет' }, { icon: TrendingUp, title: 'Удержание клиентов' }],
    features: ['Несколько покупателей одновременно', 'Автоскидки после 20:00', 'Весовой товар', 'Учёт ингредиентов', 'Полная инвентаризация', 'Модификаторы и топпинги'],
    img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop',
  },
  {
    icon: Building2, title: 'Столовые и корпоративное питание',
    painPoints: [{ icon: ClipboardList, title: 'Управление производством' }, { icon: UserCheck, title: 'База постоянных клиентов' }],
    features: ['Меню по дням недели', 'Планирование производства', 'Продажа на вес', 'Быстрый интерфейс кассы', 'Постоянные посетители', 'Система баллов'],
    img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop',
  },
  {
    icon: Store, title: 'Франшизы и сети',
    painPoints: [{ icon: FileText, title: 'Требования франчайзера' }, { icon: Activity, title: 'Контроль нескольких точек' }],
    features: ['Масштабирование', 'Финансовое управление сетью', 'Стандарты качества', 'Централизованные поставки', 'Маркетинг для филиалов', 'Контроль запасов'],
    img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop',
  },
];

const comparisonData = [
  { feature: 'Встроенные чаты', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Офлайн-режим', fc: true, iiko: false, yuma: 'Частично', poster: false, rk: false },
  { feature: 'Геймификация', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'AI-прогнозы', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'QR-самозаказ', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Разделение счёта', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Приложение курьера', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Мобильное приложение гостя', fc: true, iiko: true, yuma: false, poster: false, rk: false },
  { feature: 'Облачная версия', fc: true, iiko: true, yuma: true, poster: true, rk: true },
  { feature: 'Современный интерфейс', fc: true, iiko: true, yuma: true, poster: true, rk: false },
  { feature: '100% функций без доплат', fc: true, iiko: false, yuma: false, poster: false, rk: false },
];

const testimonials = [
  { text: 'Перешли с iiko — разница колоссальная. Встроенные чаты — уровень, которого нет ни у кого. Гости в восторге.', name: 'Алексей Кузнецов', role: 'Владелец «La Maison»', rating: 5, img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
  { text: 'FoodChain решил все проблемы: зал, доставка, склад в одной системе. Поддержка отвечает за 2 минуты.', name: 'Мария Соколова', role: 'CEO «СушиМастер»', rating: 5, img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face' },
  { text: 'Офлайн-режим спасает при сбоях — ни одного простоя за полгода. AI-прогноз сократил списание на 30%.', name: 'Дмитрий Волков', role: 'Управляющий «Biergarten»', rating: 5, img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face' },
];

const plans = [
  { name: 'Стартовый', price: '9 900 ₽', sub: 'Для небольших заведений', features: ['До 500 заказов/мес', 'До 5 сотрудников', '1 филиал', 'Управление меню', 'Базовые отчёты', 'Email-поддержка'] },
  { name: 'Бизнес', price: '19 900 ₽', sub: 'Для растущего бизнеса', popular: true, features: ['До 2 000 заказов/мес', 'До 20 сотрудников', 'До 3 филиалов', 'Все модули', 'Интеграции', 'Приоритетная поддержка'] },
  { name: 'Корпоративный', price: '39 900 ₽', sub: 'Для сетей ресторанов', features: ['Безлимит заказов', 'Безлимит сотрудников', 'Безлимит филиалов', 'AI-прогнозы', 'White Label', 'Персональный менеджер 24/7'] },
];

const faqs = [
  { q: 'Что входит в тариф?', a: 'Каждый тариф включает полный доступ ко всем модулям. Разница только в лимитах.' },
  { q: 'Нужен ли сервер для установки?', a: 'Нет. FoodChain — облачная платформа. Нужен только браузер и интернет.' },
  { q: 'Можно ли перенести данные из другой системы?', a: 'Да. Поддерживаем импорт из iiko, R-Keeper, Poster, YUMA и Excel. Поможем бесплатно.' },
  { q: 'Есть ли техподдержка?', a: 'На всех тарифах — email. На «Бизнес» — приоритетная. На «Корпоративном» — персональный менеджер 24/7.' },
  { q: 'Как работает демо-период?', a: '14 дней полного доступа на тарифе «Бизнес». Без карты. Без обязательств.' },
  { q: 'Можно ли подключить эквайринг?', a: 'Да. Интегрированы с ведущими платёжными провайдерами и фискальными регистраторами.' },
];

const clientLogos = [
  { name: 'CoffeeLab', bg: 'bg-amber-50 text-amber-700' },
  { name: 'Терраса', bg: 'bg-green-50 text-green-700' },
  { name: 'Grab&Go', bg: 'bg-blue-50 text-blue-700' },
  { name: 'Pizza House', bg: 'bg-red-50 text-red-700' },
  { name: 'Бистро №1', bg: 'bg-purple-50 text-purple-700' },
  { name: 'Суши Мастер', bg: 'bg-pink-50 text-pink-700' },
  { name: 'Кофейня豆', bg: 'bg-amber-50 text-amber-700' },
  { name: 'Burger Club', bg: 'bg-orange-50 text-orange-700' },
];

function TerminalMock() {
  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-[280px]">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">Новый заказ</span>
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Стол 3</span>
        </div>
        <div className="space-y-2">
          {['Маргарита x1', 'Цезарь x1', 'Капучино x2'].map(item => (
            <div key={item} className="flex justify-between text-xs">
              <span className="text-gray-600">{item}</span>
              <span className="font-medium text-gray-800">450₽</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-2 flex justify-between">
          <span className="text-sm font-bold text-gray-800">Итого: 1 280₽</span>
          <span className="text-xs text-green-600 font-medium">Оплата</span>
        </div>
      </div>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="bg-white rounded-[2rem] shadow-2xl border-4 border-gray-800 overflow-hidden w-[160px]">
      <div className="bg-gray-800 px-4 pt-3 pb-1">
        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto" />
      </div>
      <div className="p-3 space-y-2">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-3 text-white">
          <p className="text-[8px] opacity-80">FoodChain</p>
          <p className="text-xs font-bold">Добро пожаловать!</p>
        </div>
        <div className="space-y-1.5">
          {['Меню', 'Заказы', 'Доставка'].map(item => (
            <div key={item} className="bg-gray-50 rounded-lg p-2 text-[9px] font-medium text-gray-700">{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cell({ val }: { val: boolean | string }) {
  if (val === true) return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100"><Check className="h-3.5 w-3.5 text-green-600" /></span>;
  if (val === false) return <span className="text-gray-300 text-sm">—</span>;
  return <span className="text-gray-500 text-xs">{val}</span>;
}

export function Home() {
  const [venueIdx, setVenueIdx] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  useEffect(() => { const t = setInterval(() => setVenueIdx(p => (p + 1) % venueTypes.length), 2500); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setTestimonialIdx(p => (p + 1) % testimonials.length), 5000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('opacity-100', 'translate-y-0'); e.target.classList.remove('opacity-0', 'translate-y-8'); } }); },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-['Inter',sans-serif] overflow-x-hidden">

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-sm">F</span></div>
              <span className="font-bold text-xl text-gray-900">Food<span className="text-green-600">Chain</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {['Возможности', 'Приложения', 'Цены', 'О нас', 'Блог', 'Контакты'].map((label, i) => (
                <Link key={label} to={['/features', '/apps', '/pricing', '/about', '/blog', '/contact'][i]} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition">{label}</Link>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">Вход</Link>
              <Link to="/register" className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition shadow-sm shadow-green-600/20">Попробовать бесплатно</Link>
            </div>
            <button className="md:hidden p-2 text-gray-600" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1">
            {['Возможности', 'Приложения', 'Цены', 'О нас', 'Блог', 'Контакты'].map((label, i) => (
              <Link key={label} to={['/features', '/apps', '/pricing', '/about', '/blog', '/contact'][i]} className="block px-4 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50" onClick={() => setMobileOpen(false)}>{label}</Link>
            ))}
            <hr className="my-2 border-gray-100" />
            <Link to="/login" className="block px-4 py-2.5 text-sm text-gray-600" onClick={() => setMobileOpen(false)}>Вход</Link>
            <Link to="/register" className="block px-4 py-2.5 text-sm font-bold text-green-600" onClick={() => setMobileOpen(false)}>Попробовать бесплатно</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="reveal opacity-0 translate-y-8 transition-all duration-700">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                Вся сила EPOS<br />
                для{' '}
                <span className="text-green-600 inline-block min-w-[200px]">{venueTypes[venueIdx]}</span>
              </h1>
              <p className="mt-6 text-lg text-gray-600 max-w-xl leading-relaxed">
                Работайте быстрее, продавайте умнее и возвращайте клиентов — всё из одной связанной системы.
              </p>
              <div className="mt-8">
                <Link to="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg text-sm font-bold shadow-lg shadow-green-600/20 hover:shadow-green-600/40 transition-all hover:-translate-y-0.5">
                  Запросить демо <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {benefitIcons.map((b, i) => {
                  const BI = b.icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600"><BI className="h-5 w-5" /></div>
                      <p className="text-sm text-gray-700 leading-snug">{b.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-center lg:justify-end reveal opacity-0 translate-y-8 transition-all duration-700 delay-200">
              <div className="relative">
                <TerminalMock />
                <div className="absolute -bottom-8 -left-16"><PhoneMock /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ЛОГОТИПЫ КЛИЕНТОВ */}
      <section className="py-12 border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-sm text-gray-400 mb-8">Уже используют FoodChain</p>
          <div className="flex overflow-hidden">
            <div className="flex gap-8 animate-scroll">
              {[...clientLogos, ...clientLogos].map((logo, i) => (
                <div key={i} className={`shrink-0 px-6 py-3 rounded-xl ${logo.bg} text-sm font-semibold`}>{logo.name}</div>
              ))}
            </div>
          </div>
          <div className="text-center mt-8">
            <Link to="/register" className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-semibold">Присоединяйтесь <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </section>

      {/* ПОЧЕМУ МЫ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Всё о системе FoodChain</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">Более 5 лет мы работаем с заведениями общественного питания, чтобы закрыть 100% их задач.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Settings, title: 'Вся функциональность в бэк-офисе', desc: 'Учёт склада, настройка меню, управление персоналом, финансы, контроль затрат и маркетинг — всё в одном месте.' },
              { icon: ClipboardList, title: 'Продвинутое управление меню', desc: 'Обрабатывайте все заказы из зала, доставки и самовывоза. Принимайте заказы с доставки напрямую. Отправляйте на кухню мгновенно.' },
              { icon: Globe, title: 'Сайт под ваш бренд', desc: 'Запустите собственную службу доставки. Используйте QR-коды для заказа. Гибкая настройка для сетей и франшиз.' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group rounded-2xl border border-gray-100 p-8 hover:border-green-200 hover:shadow-lg transition-all">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all"><Icon className="h-7 w-7" /></div>
                  <h3 className="mt-6 text-xl font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ПРИЛОЖЕНИЯ */}
      <section className="py-20 bg-gray-50" id="apps">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Все приложения для вашего бизнеса</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">6 приложений, которые полностью покрывают все процессы ресторана</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {appList.map((app, i) => {
              const Icon = app.icon;
              return (
                <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group rounded-2xl border border-gray-100 bg-white p-6 hover:border-green-200 hover:shadow-lg transition-all text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-600 group-hover:bg-green-50 group-hover:text-green-600 transition-all mx-auto"><Icon className="h-6 w-6" /></div>
                  <h3 className="mt-4 text-lg font-bold text-gray-900">{app.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{app.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ОТРАСЛИ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">FoodChain знает ваш бизнес</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">Мы понимаем особенности каждого типа заведения</p>
          </div>
          <div className="space-y-20">
            {industrySections.map((section, i) => {
              const SectionIcon = section.icon;
              return (
                <div key={i} className={`grid items-center gap-10 lg:grid-cols-2 reveal opacity-0 translate-y-8 transition-all duration-700 ${i % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}>
                  <div className={i % 2 === 1 ? 'lg:col-start-2' : ''}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600"><SectionIcon className="h-6 w-6" /></div>
                      <h3 className="text-2xl font-bold text-gray-900">{section.title}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      {section.painPoints.map((pp, j) => {
                        const PPIcon = pp.icon;
                        return (
                          <div key={j} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <div className="flex items-center gap-2"><PPIcon className="h-4 w-4 text-green-600" /><span className="text-xs font-medium text-gray-700">{pp.title}</span></div>
                          </div>
                        );
                      })}
                    </div>
                    <ul className="space-y-2.5">
                      {section.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-gray-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={`flex justify-center ${i % 2 === 1 ? 'lg:col-start-1' : ''}`}>
                    <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-100"><img src={section.img} alt={section.title} className="w-full h-[300px] object-cover" /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 17 ФИЧ */}
      <section className="py-20 bg-gray-50" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">17 функций, которых нет у конкурентов</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-3xl mx-auto">FoodChain — единственная система, которая даёт эти преимущества из коробки.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group flex gap-4 rounded-xl border border-gray-100 bg-white p-5 hover:border-green-200 hover:shadow-md transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600"><f.icon className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* СРАВНЕНИЕ */}
      <section className="py-20 bg-white" id="compare">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Сравните сами</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-3xl mx-auto">Мы обгоняем конкурентов по функциональности и цене</p>
          </div>
          <div className="overflow-x-auto reveal opacity-0 translate-y-8 transition-all duration-700">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Функция</th>
                  <th className="px-4 py-4 text-center text-xs font-bold text-green-700 uppercase tracking-wider bg-green-50 rounded-t-xl">FoodChain</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">iiko</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">YUMA</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Poster</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">R-Keeper</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-4 py-4 text-sm text-gray-900">{row.feature}</td>
                    {(['fc', 'iiko', 'yuma', 'poster', 'rk'] as const).map(key => (
                      <td key={key} className={`px-4 py-4 text-center ${key === 'fc' ? 'bg-green-50/50' : ''}`}><Cell val={row[key]} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ОТЗЫВЫ */}
      <section className="py-20 bg-gray-50" id="reviews">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Что говорят наши клиенты</h2>
            <p className="mt-4 text-lg text-gray-500">Реальные результаты от реальных пользователей</p>
          </div>
          <div className="relative reveal opacity-0 translate-y-8 transition-all duration-700">
            {testimonials.map((t, i) => (
              <div key={i} className={`transition-all duration-500 ${i === testimonialIdx ? 'block' : 'hidden'}`}>
                <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12 text-center shadow-sm">
                  <div className="flex justify-center gap-1 mb-6">{Array.from({ length: t.rating }, (_, j) => <Star key={j} className="h-5 w-5 fill-amber-400 text-amber-400" />)}</div>
                  <p className="text-lg sm:text-xl text-gray-700 leading-relaxed italic">«{t.text}»</p>
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <img src={t.img} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-green-100" />
                    <div className="text-left"><p className="text-sm font-semibold text-gray-900">{t.name}</p><p className="text-xs text-gray-500">{t.role}</p></div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button key={i} onClick={() => setTestimonialIdx(i)} className={`h-1.5 rounded-full transition-all ${i === testimonialIdx ? 'w-8 bg-green-600' : 'w-1.5 bg-gray-300'}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ТАРИФЫ */}
      <section className="py-20 bg-white" id="pricing">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Выберите ваш тариф</h2>
            <p className="mt-4 text-lg text-gray-500">Все тарифы включают 14-дневный бесплатный период</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <div key={i} className={`reveal opacity-0 translate-y-8 transition-all duration-700 relative flex flex-col rounded-2xl border p-8 ${plan.popular ? 'border-green-500 bg-gradient-to-b from-green-50 to-white shadow-xl shadow-green-500/10 ring-1 ring-green-500/20 scale-105' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-600 px-4 py-1 text-xs font-bold text-white shadow-lg">Самый популярный</span>}
                <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.sub}</p>
                <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-bold text-gray-900">{plan.price}</span><span className="text-sm text-gray-500">/мес</span></div>
                <ul className="mt-8 flex-1 space-y-3.5">
                  {plan.features.map((f, j) => (<li key={j} className="flex items-start gap-3 text-sm text-gray-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />{f}</li>))}
                </ul>
                <Link to="/register" className={`mt-8 block w-full rounded-lg px-6 py-3 text-center text-sm font-semibold transition-all ${plan.popular ? 'bg-green-600 text-white shadow-lg hover:bg-green-700' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>Выбрать тариф</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Часто задаваемые вопросы</h2>
          </div>
          <div className="space-y-3 reveal opacity-0 translate-y-8 transition-all duration-700">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className={`rounded-xl border transition-all ${isOpen ? 'border-green-200 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <button onClick={() => setOpenFaq(isOpen ? null : i)} className="flex w-full items-center justify-between px-6 py-5 text-left">
                    <span className="text-sm font-medium text-gray-900">{faq.q}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-green-600' : 'text-gray-400'}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-48' : 'max-h-0'}`}>
                    <div className="border-t border-gray-100 px-6 pb-5 pt-3"><p className="text-sm leading-relaxed text-gray-600">{faq.a}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 text-center reveal opacity-0 translate-y-8 transition-all duration-700">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Начните бесплатно уже сегодня</h2>
          <p className="mt-4 text-lg text-gray-500">14 дней полного доступа. Без привязки карты. Без обязательств.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/register" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg text-sm font-bold text-white shadow-lg shadow-green-600/20 hover:shadow-green-600/40 transition-all hover:-translate-y-0.5">Начать бесплатно <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/contact" className="inline-flex items-center gap-2 border border-gray-200 bg-white px-8 py-4 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Связаться с нами</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 py-16">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-sm">F</span></div>
                <span className="font-bold text-white text-lg">Food<span className="text-green-400">Chain</span></span>
              </Link>
              <p className="text-sm leading-relaxed text-gray-500 max-w-xs">Единая EPOS-система для общественного питания.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Продукт</h4>
              <div className="space-y-3 text-sm">
                <Link to="/features" className="block text-gray-500 hover:text-green-400 transition">Возможности</Link>
                <Link to="/pricing" className="block text-gray-500 hover:text-green-400 transition">Цены</Link>
                <Link to="/apps" className="block text-gray-500 hover:text-green-400 transition">Приложения</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Компания</h4>
              <div className="space-y-3 text-sm">
                <Link to="/about" className="block text-gray-500 hover:text-green-400 transition">О нас</Link>
                <Link to="/contact" className="block text-gray-500 hover:text-green-400 transition">Контакты</Link>
                <Link to="/blog" className="block text-gray-500 hover:text-green-400 transition">Блог</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Контакты</h4>
              <div className="space-y-3 text-sm">
                <a href="mailto:support@foodchain.ru" className="block text-gray-500 hover:text-green-400 transition">support@foodchain.ru</a>
                <a href="tel:+78001234567" className="block text-gray-500 hover:text-green-400 transition">8 (800) 123-45-67</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Ресурсы</h4>
              <div className="space-y-3 text-sm">
                <a href="#" className="block text-gray-500 hover:text-green-400 transition">База знаний</a>
                <a href="#" className="block text-gray-500 hover:text-green-400 transition">API</a>
                <a href="#" className="block text-gray-500 hover:text-green-400 transition">Статус системы</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">© 2026 FoodChain / MIRUZ. Все права защищены.</p>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <a href="#" className="hover:text-green-400 transition">Политика конфиденциальности</a>
              <a href="#" className="hover:text-green-400 transition">Условия использования</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
