import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronRight, Star, X, Menu, Phone,
  MessageCircle, Bike, User, ChefHat, Globe, Monitor,
  ShoppingCart, Package, BarChart3, Users, Megaphone, Smartphone, MessageSquare, Link2,
  Zap, Shield, Diamond, Gift, QrCode, Split, Cloud, Cpu,
  QrCodeIcon, BookOpen, Headphones, Award, LogIn, Layers,
  Lock, ClipboardList, Wifi, Coffee,
} from 'lucide-react';

const HERO_SLIDES = [
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1920&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&q=80',
  'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=1920&q=80',
  'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1920&q=80',
  'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=1920&q=80',
];

const WHY_CARDS = [
  { icon: Globe, title: 'Единая экосистема', desc: 'Одно приложение для всего: зал, кухня, доставка, склад, финансы. Никаких зоопарков из 5 разных систем.' },
  { icon: Diamond, title: '100% функций без доплат', desc: 'Всё включено в подписку. Никаких скрытых платежей, никаких «купите ещё модуль». Честная цена с первого дня.' },
  { icon: Zap, title: '17 уникальных фич', desc: 'Чаты, геймификация, офлайн-режим, 2FA, прогнозирование спроса и другие возможности, которых нет у конкурентов.' },
  { icon: Gift, title: 'Бесплатный демо-доступ', desc: '14 дней полного доступа ко всем функциям. Без привязки карты, без обязательств. Просто попробуйте.' },
];

const FEATURES_17 = [
  { icon: MessageCircle, name: 'Встроенные чаты', desc: 'Гость ↔ официант, гость ↔ курьер, курьер ↔ официант. Реальное время без звонков и SMS. Ни у кого из конкурентов этого нет.' },
  { icon: Award, name: 'Геймификация', desc: 'Колесо удачи, викторины, челленджи для вовлечения гостей и мотивации персонала. Повышает лояльность и средний чек.' },
  { icon: Globe, name: 'Мультивалютность', desc: 'Поддержка нескольких валют для международных сетей ресторанов. Цены, отчёты и финансы в любой валюте.' },
  { icon: Cpu, name: 'SDK для разработчиков', desc: 'Открытый SDK для создания собственных плагинов и расширений. Кастомизируйте систему под свой бизнес.' },
  { icon: Headphones, name: 'Оператор колл-центра', desc: 'Интерфейс для приёма заказов по телефону. Работает вместе с IP-телефонией — все звонки внутри системы.' },
  { icon: Wifi, name: 'Полный офлайн-режим', desc: 'Работа без интернета с автосинхронизацией при восстановлении связи. Ни минуты простоя — даже при сбоях сети.' },
  { icon: Cloud, name: 'Прогнозирование спроса (AI)', desc: 'ML-модель прогнозирует продажи и закупки на основе исторических данных. Меньше списаний, больше прибыли.' },
  { icon: Layers, name: 'Sous Chef (умная очередь)', desc: 'Приоритизация заказов на кухне. Система сама определяет, какие блюда готовить в первую очередь.' },
  { icon: Split, name: 'Разделение счёта (split bill)', desc: 'Деление чека между гостями за 2 клика. Каждый платит только за своё — никаких споров и лишних расчётов.' },
  { icon: QrCode, name: 'QR-самозаказ', desc: 'Гость сканирует QR-код на столе и делает заказ сам со своего телефона. Сокращает время обслуживания.' },
  { icon: Monitor, name: 'Экран раздачи (FOH display)', desc: 'Отображение готовых блюд для выдачи. Официанты видят, какие заказы готовы, и забирают их без очереди.' },
  { icon: BookOpen, name: 'Честный знак (маркировка)', desc: 'Учёт маркированных товаров: вода, молочная продукция, табак. Встроенная интеграция с системой «Честный знак».' },
  { icon: Phone, name: 'IP-телефония', desc: 'Интеграция с АТС для приёма звонков через систему. Все разговоры записываются и сохраняются в истории.' },
  { icon: Coffee, name: 'Extensions (магазин приложений)', desc: 'Подключайте сторонние расширения и интеграции через встроенный магазин. Расширяйте функционал в один клик.' },
  { icon: Lock, name: '2FA (двухфакторная)', desc: 'Защита аккаунтов администраторов. Дополнительный уровень безопасности для вашего бизнеса и данных гостей.' },
  { icon: ClipboardList, name: 'Аудит действий (Audit log)', desc: 'Логирование всех действий пользователей. Полная прозрачность — вы всегда знаете, кто и что делал в системе.' },
  { icon: Smartphone, name: 'PWA (Progressive Web App)', desc: 'Сайт работает как полноценное приложение на телефоне. Не требует установки из магазина — просто добавьте на экран.' },
];

const CHAT_CARDS = [
  { arrow: [User, ChefHat], icon: MessageCircle, title: 'Гость ↔ Официант', desc: 'Гость может написать официанту из приложения — уточнить заказ, сообщить о проблеме, попросить счёт. Официант отвечает мгновенно. Никаких очередей и криков через зал.', badge: 'Повышает лояльность на 40%' },
  { arrow: [Bike, ChefHat], icon: Package, title: 'Курьер ↔ Официант', desc: 'Курьер уточняет адрес, время или особые пожелания. Официант видит всё в своём приложении и мгновенно реагирует. Доставка становится быстрее и без ошибок.', badge: 'Ускоряет доставку на 25%' },
  { arrow: [User, Bike], icon: MessageSquare, title: 'Гость ↔ Курьер', desc: 'Гость видит, где находится курьер, и может написать ему: «Поднимитесь на 5-й этаж». Курьер отвечает — доставка становится быстрее и удобнее для всех.', badge: 'Снижает количество звонков на 60%' },
];

const MODULES = [
  { icon: ShoppingCart, name: 'Управление заказами', desc: 'Принимайте заказы из зала, доставки и самовывоза в одном окне. Автоматическое распределение на кухню.' },
  { icon: Package, name: 'Склад и техкарты', desc: 'Полный контроль остатков, автозаказ продуктов, калькуляция блюд и техкарты с расчётом себестоимости.' },
  { icon: BarChart3, name: 'Финансы и отчёты', desc: 'Выручка, прибыль, средний чек, фудкост — вся аналитика в реальном времени с экспортом.' },
  { icon: Users, name: 'Персонал', desc: 'Управление сменами, учёт времени, чаевые, KPI и мотивация сотрудников.' },
  { icon: Megaphone, name: 'Маркетинг', desc: 'Акции, скидки, программы лояльности, push-уведомления и e-mail рассылки.' },
  { icon: Smartphone, name: 'Мобильные приложения', desc: 'Отдельные приложения для гостя, официанта, курьера и кухни.' },
  { icon: MessageCircle, name: 'Чаты и уведомления', desc: 'Встроенные чаты между гостем, официантом и курьером.' },
  { icon: Link2, name: 'Интеграции', desc: 'Эквайринг, фискализация, Telegram, соцсети, сайт, Google Maps.' },
];

const COMPARISON_ROWS = [
  { fn: 'Единая база данных и архитектура', fc: true, iiko: true, yuma: true, poster: true, rkeeper: '✗ модульная' },
  { fn: 'Встроенные чаты гость-официант-курьер', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'Офлайн-режим работы', fc: true, iiko: 'Ограничен', yuma: false, poster: 'Ограничен', rkeeper: 'Ограничен' },
  { fn: 'Геймификация персонала', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'Стоимость входа', fc: 'Подписка от 9 900 ₽', iiko: 'от 35 000 ₽/мес', yuma: 'от 25 000 ₽/мес', poster: 'от 15 000 ₽/мес', rkeeper: 'от 107 000 ₽' },
  { fn: 'Современный интерфейс', fc: true, iiko: 'Средний', yuma: true, poster: true, rkeeper: 'Устаревший' },
  { fn: 'Облачная версия', fc: true, iiko: true, yuma: true, poster: true, rkeeper: true },
  { fn: '100% функций без доплат', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'AI-прогнозирование спроса', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: '2FA и аудит безопасности', fc: true, iiko: 'Ограничен', yuma: false, poster: false, rkeeper: false },
];

const APPS = [
  { id: 'guest', tag: 'Гость', icon: User, title: 'Гость', desc: 'Меню, заказ, оплата, чат с официантом и курьером, история заказов, программа лояльности.', color: '#00b4d8' },
  { id: 'courier', tag: 'Курьер', icon: Bike, title: 'Курьер', desc: 'Приём заказов, навигатор, чаты, статусы доставки, история выплат и рейтинг.', color: '#22c55e' },
  { id: 'waiter', tag: 'Официант', icon: ChefHat, title: 'Официант', desc: 'Приём заказов, отправка на кухню, чаты, оплата, чаевые и закрытие счета.', color: '#f0b429' },
  { id: 'kitchen', tag: 'Кухня', icon: Monitor, title: 'Кухня (KDS)', desc: 'Экран заказов, таймеры, сплит по зонам, статусы готовности и приоритеты.', color: '#ef4444' },
  { id: 'website', tag: 'Сайт', icon: Globe, title: 'Веб-сайт', desc: 'Готовый адаптивный сайт с меню, корзиной и онлайн-оплатой за 5 минут.', color: '#8b5cf6' },
  { id: 'kiosk', tag: 'Киоск', icon: Monitor, title: 'Киоск (SST)', desc: 'Терминал самообслуживания — сокращает очереди и увеличивает средний чек на 20%.', color: '#ec4899' },
];

const TESTIMONIALS = [
  { text: 'Перешли на FoodChain с iiko — разница колоссальная. Интерфейс современный, всё интуитивно понятно. А встроенные чаты — это просто бомба. Гости в восторге, персоналу удобно.', name: 'Алексей Кузнецов', role: 'Владелец сети ресторанов «La Maison», Казань', color: '#00b4d8', rating: 5 },
  { text: 'Раньше пользовались Poster — не хватало функционала для доставки. FoodChain решил все проблемы: и зал, и доставка, и склад в одной системе. Плюс техподдержка отвечает за 2 минуты.', name: 'Мария Соколова', role: 'CEO «СушиМастер», Екатеринбург', color: '#f0b429', rating: 5 },
  { text: 'Офлайн-режим спасает, когда интернет падает — ни одного простоя за полгода. Геймификация реально мотивирует персонал. AI-прогноз закупок сократил списание продуктов на 30%.', name: 'Дмитрий Волков', role: 'Управляющий «Biergarten», Москва', color: '#22c55e', rating: 5 },
  { text: 'Внедрили FoodChain во всех 12 ресторанах сети. Централизованное управление, единая аналитика, 2FA для безопасности — лучшее решение на рынке. Рекомендую.', name: 'Екатерина Романова', role: 'CEO сети ресторанов «Mangal House», Санкт-Петербург', color: '#8b5cf6', rating: 5 },
];

const PLANS = [
  {
    name: 'Базовый', price: '9 900', oldPrice: '14 900', desc: 'Для небольших заведений',
    features: ['Управление заказами', 'Склад и техкарты', 'Финансы и отчёты', 'Приложение официанта', 'До 3 кассовых мест', 'Техподдержка в чате', '14 дней бесплатно'],
    popular: false,
  },
  {
    name: 'Бизнес', price: '19 900', oldPrice: '29 900', desc: 'Для средних ресторанов и доставки',
    features: ['Всё из тарифа «Базовый»', 'Встроенные чаты', 'Приложения гостя и курьера', 'Маркетинг и лояльность', 'Интеграции и эквайринг', 'До 10 кассовых мест', 'Поддержка 24/7', 'AI-прогнозирование спроса'],
    popular: true,
  },
  {
    name: 'Корпоративный', price: '39 900', oldPrice: '59 900', desc: 'Для сетей ресторанов',
    features: ['Всё из тарифа «Бизнес»', 'Безлимит кассовых мест', 'Централизованное управление', 'Выделенный сервер / SLA', 'Геймификация и 2FA', 'Персональный менеджер', 'Индивидуальная доработка', 'Приоритетная поддержка'],
    popular: false,
  },
];

const FAQS = [
  { q: 'Что входит в тариф?', a: 'Каждый тариф включает полный набор функций, указанных в карточке. В «Базовый» — заказы, склад, финансы. В «Бизнес» — дополнительно чаты, мобильные приложения, маркетинг, AI-прогнозирование. В «Корпоративный» — все функции без ограничений. Никаких скрытых модулей — всё, что вы видите, уже включено.' },
  { q: 'Нужен ли сервер для установки?', a: 'Нет. FoodChain — полностью облачное решение. Вам нужен только ноутбук или планшет с доступом в интернет. Мы берём на себя хостинг, безопасность и резервное копирование. Для корпоративных клиентов возможна установка на выделенный сервер.' },
  { q: 'Можно ли перенести данные из другой системы (iiko, R‑Keeper)?', a: 'Да. Мы предоставляем бесплатный перенос данных из iiko, R‑Keeper, Poster, YUMA и 1С. Переносим меню, склад, базу клиентов и историю заказов. Миграция занимает 1–3 дня, все данные будут в целости.' },
  { q: 'Есть ли техподдержка?', a: 'Да. На тарифе «Базовый» — чат с ответом до 5 минут в рабочее время. На «Бизнесе» — круглосуточная поддержка 24/7. На «Корпоративном» — персональный менеджер и выделенная линия поддержки.' },
  { q: 'Как работает демо-период?', a: '14 дней полного доступа ко всем функциям системы. Без привязки карты и без обязательств. Если система вам подходит — выбираете тариф и продолжаете работу. Если нет — доступ просто отключается. Никаких штрафов.' },
  { q: 'Можно ли подключить эквайринг и фискализацию?', a: 'Да. Поддерживаем Сбербанк, Тинькофф, ЮKassa, CloudPayments. Автоматическая фискализация по 54‑ФЗ через облачную кассу. Всё работает из коробки — никаких дополнительных настроек.' },
];

const APP_DETAILS: Record<string, { title: string; desc: string; features: string[] }> = {
  guest: { title: 'Приложение «Гость»', desc: 'Полноценное мобильное приложение для ваших гостей с белым этикетом (брендируется под ваш ресторан).', features: ['Меню с фото и описаниями', 'Корзина и онлайн-оплата', 'Чат с официантом и курьером', 'История заказов', 'Программа лояльности', 'Избранное и отзывы'] },
  courier: { title: 'Приложение «Курьер»', desc: 'Профессиональное приложение для курьеров с навигатором и автоматическим назначением заказов.', features: ['Приём новых заказов', 'Оптимальный маршрут', 'Чат с гостем и официантом', 'Статусы доставки', 'История выплат', 'Рейтинг курьера'] },
  waiter: { title: 'Приложение «Официант»', desc: 'Принимайте заказы гостей прямо за столиком через планшет — без бумажных блокнотов.', features: ['План зала и расстановка', 'Приём заказов', 'Отправка на кухню', 'Чат с гостем и курьером', 'Приём оплаты', 'Чаевые и KPI'] },
  kitchen: { title: 'Экран «Кухня» (KDS)', desc: 'Кухонный дисплей, показывающий все входящие заказы в реальном времени.', features: ['Все заказы в реальном времени', 'Сплит по зонам кухни', 'Таймеры готовности', 'Цветовая индикация', 'Приоритеты заказов', 'Статусы готовности'] },
  website: { title: 'Веб-сайт ресторана', desc: 'Готовый адаптивный сайт для вашего ресторана. Настраивается за 5 минут.', features: ['Меню с фото', 'Корзина и оплата', 'Интеграция с доставкой', 'Свой домен', 'SEO-оптимизация', 'Аналитика заказов'] },
  kiosk: { title: 'Киоск самообслуживания (SST)', desc: 'Терминал самообслуживания для залов. Гость сам выбирает блюда и оплачивает.', features: ['Сенсорный интерфейс', 'Визуальное меню', 'Онлайн-оплата', 'QR-код заказа', 'Кросс-продажи', '+20% к среднему чеку'] },
};

function Cell({ val }: { val: boolean | string }) {
  if (val === true) return <span className="text-emerald-400 font-bold text-lg drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">✓</span>;
  if (val === false) return <span className="text-red-400/50 text-lg">✗</span>;
  if (typeof val === 'string' && (val.startsWith('✗') || val.startsWith('от'))) return <span className="text-red-400/70 text-sm">{val}</span>;
  return <span className="text-amber-400/80 text-sm">{val}</span>;
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add('opacity-100', 'translate-y-0');
        el.classList.remove('opacity-0', 'translate-y-8');
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`opacity-0 translate-y-8 transition-all duration-700 ease-out ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-cyan-500/5 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-blue-500/5 blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-1/3 left-1/2 w-64 h-64 rounded-full bg-cyan-400/5 blur-[80px] animate-pulse" style={{ animationDuration: '12s' }} />
    </div>
  );
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-400 text-xs font-semibold uppercase tracking-[0.15em] mb-5 backdrop-blur-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      {children}
    </span>
  );
}

function GridPattern() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
  );
}

export function Home() {
  const [slide, setSlide] = useState(0);
  const [expFeat, setExpFeat] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const stars = Array.from({ length: 5 }, (_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]" />);

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200 font-['Inter',sans-serif] overflow-x-hidden selection:bg-cyan-500/30 selection:text-white">
      {/* ===== HEADER ===== */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#0b1120]/90 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.3)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 group-hover:scale-105 transition-all duration-300">
                <span className="text-white font-black text-lg">F</span>
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">Food<span className="text-cyan-400">Chain</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {['#features', '#pricing', '#about', '#contacts'].map((href, i) => (
                <a key={href} href={href} className="relative px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 group">
                  {['Возможности', 'Цены', 'О нас', 'Контакты'][i]}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-cyan-400 rounded-full group-hover:w-1/2 transition-all duration-300" />
                </a>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Вход</Link>
              <Link to="/register" className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity" />
                <span className="relative bg-[#0b1120] group-hover:bg-cyan-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl border border-cyan-400/30 transition-all duration-300 inline-flex items-center gap-2">
                  Попробовать бесплатно
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
            <button className="md:hidden p-2 text-white hover:text-cyan-400 transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-[#0b1120]/98 backdrop-blur-2xl border-t border-white/5 px-4 py-4 space-y-1">
            {['Возможности', 'Цены', 'О нас', 'Контакты'].map((label, i) => (
              <a key={label} href={['#features', '#pricing', '#about', '#contacts'][i]} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-cyan-400 transition-all">{label}</a>
            ))}
            <hr className="my-2 border-white/10" />
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 rounded-xl">Вход</Link>
            <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-bold text-cyan-400 hover:bg-cyan-400/10 rounded-xl text-center border border-cyan-400/20">Попробовать бесплатно</Link>
          </div>
        )}
      </header>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center overflow-hidden" id="hero">
        <div className="absolute inset-0">
          {HERO_SLIDES.map((src, i) => (
            <div key={i} className={`absolute inset-0 transition-all duration-1000 ${i === slide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1120]/95 via-[#0b1120]/75 to-[#0b1120]/40" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:80px_80px]" />
        </div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-cyan-400/20" style={{
              left: `${Math.random() * 100}%`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              animation: `float-particle ${15 + Math.random() * 25}s linear infinite`,
              animationDelay: `${Math.random() * 20}s`,
              opacity: 0.2 + Math.random() * 0.3,
            }} />
          ))}
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 w-full">
          <div className="max-w-3xl">
            <Reveal>
              <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-cyan-400/25 bg-cyan-400/5 text-cyan-400 text-sm font-semibold mb-8 backdrop-blur-md shadow-[0_0_30px_rgba(0,180,216,0.05)]">
                <span className="relative flex w-2.5 h-2.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-cyan-400 animate-ping opacity-75" />
                  <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-cyan-400" />
                </span>
                Платформа №1 для управления рестораном
              </div>
            </Reveal>
            <Reveal delay={150}>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.04] tracking-tight mb-6">
                Управляйте рестораном<br />
                <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,180,216,0.15)]">нового поколения</span>
              </h1>
            </Reveal>
            <Reveal delay={300}>
              <p className="text-lg sm:text-xl text-slate-400 max-w-xl leading-relaxed mb-10">
                FoodChain — единая SaaS-платформа для зала, кухни, доставки, склада и финансов. 
                100% функций без скрытых платежей.
              </p>
            </Reveal>
            <Reveal delay={450}>
              <div className="flex flex-wrap gap-4 mb-14">
                <Link to="/register" className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="relative flex items-center gap-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-300 text-base shadow-[0_0_40px_rgba(0,180,216,0.15)] group-hover:shadow-[0_0_60px_rgba(0,180,216,0.25)]">
                    Начать 14-дневный бесплатный период
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
                <a href="#compare" className="inline-flex items-center gap-2.5 border border-white/15 hover:border-cyan-400/40 text-white px-8 py-4 rounded-2xl transition-all duration-300 hover:bg-white/5 text-base font-semibold group backdrop-blur-sm">
                  Сравнить с конкурентами
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </Reveal>
            <Reveal delay={600}>
              <div className="flex flex-wrap gap-10">
                {[
                  { num: '100%', label: 'функций включено', color: 'from-cyan-400 to-blue-500' },
                  { num: '17', label: 'уникальных фич', color: 'from-amber-400 to-yellow-500' },
                  { num: '0%', label: 'скрытых платежей', color: 'from-cyan-400 to-blue-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`text-3xl font-black bg-gradient-to-r ${item.color} bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(0,180,216,0.1)]`}>{item.num}</span>
                    <span className="text-sm text-slate-500 max-w-[80px] leading-tight">{item.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== WHY US ===== */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="about">
        <FloatingOrbs />
        <GridPattern />
        <Reveal>
          <div className="text-center mb-16">
            <SectionBadge>Почему FoodChain</SectionBadge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">Мы создали <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">лучшую систему</span> для ресторанов</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg">Всё, что нужно для управления заведением — в одной платформе. Без лишних интеграций.</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHY_CARDS.map((card, i) => (
            <Reveal key={card.title} delay={100 * i}>
              <div className="group relative bg-gradient-to-b from-[#1a2744]/80 to-[#0f1a2e]/80 rounded-2xl p-8 border border-white/5 hover:border-cyan-400/20 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-500/5 backdrop-blur-xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-400/5 rounded-full blur-3xl group-hover:bg-cyan-400/10 transition-all duration-500" />
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 flex items-center justify-center mb-5 text-cyan-400 group-hover:from-cyan-400 group-hover:to-blue-500 group-hover:text-white transition-all duration-500 shadow-lg group-hover:shadow-cyan-500/30`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3 relative z-10">{card.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed relative z-10">{card.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== 17 FEATURES ===== */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0b1120] via-[#0f1a2e] to-[#0b1120]" id="features">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <SectionBadge>17 уникальных функций</SectionBadge>
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">17 функций, которых нет<br />в <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">iiko, YUMA, Poster и R‑Keeper</span></h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">Только в FoodChain собраны все эти возможности. Конкуренты предлагают лишь половину.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FEATURES_17.map((feat, i) => (
              <Reveal key={feat.name} delay={40 * i}>
                <div className="group bg-[#0f1a2e]/50 backdrop-blur-sm rounded-xl p-5 border border-white/5 hover:border-cyan-400/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-500/5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400/15 to-blue-500/15 flex items-center justify-center text-cyan-400 group-hover:from-cyan-400 group-hover:to-blue-500 group-hover:text-white transition-all duration-300 shrink-0">
                      <feat.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-400/10 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        {feat.name}
                      </div>
                      <p className="text-slate-500 text-xs leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={600}>
            <p className="text-center text-slate-500 text-sm mt-10 max-w-2xl mx-auto">
              Эти 17 функций — ваш ключ к эффективности, безопасности и лояльности гостей. 
              <span className="text-white font-semibold"> Их нет у конкурентов.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== CHATS ===== */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <FloatingOrbs />
        <GridPattern />
        <Reveal>
          <div className="text-center mb-16">
            <SectionBadge>Уникальные чаты</SectionBadge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">Единственная система, где <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">все говорят друг с другом</span></h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">В FoodChain встроены чаты между гостем, официантом и курьером — в реальном времени, без звонков. Этого нет в iiko, YUMA, Poster и R‑Keeper.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {CHAT_CARDS.map((card, i) => {
            const Icon1 = card.arrow[0];
            const Icon2 = card.arrow[1];
            return (
              <Reveal key={card.title} delay={100 * i}>
                <div className="group relative bg-gradient-to-b from-[#1a2744]/80 to-[#0f1a2e]/80 backdrop-blur-xl rounded-2xl p-8 border border-white/5 hover:border-cyan-400/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/5">
                  <div className="absolute top-0 left-0 w-40 h-40 bg-cyan-400/5 rounded-full blur-3xl group-hover:bg-cyan-400/10 transition-all duration-500" />
                  <div className="flex items-center gap-2.5 mb-6 relative z-10">
                    <div className="flex -space-x-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 flex items-center justify-center text-cyan-400 border border-cyan-400/20"><Icon1 className="w-4 h-4" /></div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 flex items-center justify-center text-cyan-400 border border-cyan-400/20"><Icon2 className="w-4 h-4" /></div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-cyan-400/40" />
                    <span className="text-xs font-semibold text-cyan-400/60 uppercase tracking-wider">{card.title.split(' ')[0]} ↔ {card.title.split(' ')[2]}</span>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 flex items-center justify-center mb-5 text-cyan-400 group-hover:from-cyan-400 group-hover:to-blue-500 group-hover:text-white transition-all duration-500 relative z-10">
                    <card.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3 relative z-10">{card.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-5 relative z-10">{card.desc}</p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold relative z-10">{card.badge}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={400}>
          <p className="text-center text-slate-500 text-sm mt-12 max-w-2xl mx-auto leading-relaxed">
Все чаты сохраняются в истории — никаких лишних звонков и SMS. Всё внутри системы. FoodChain — единственная система, которая объединяет всех участников в едином информационном поле. Это не просто функция — это 
<span className="text-white font-semibold">новый уровень сервиса</span>.
          </p>
        </Reveal>
      </section>

      {/* ===== MODULES ===== */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 bg-[#0f1a2e]/50">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <SectionBadge>Возможности</SectionBadge>
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">Всё для управления <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">рестораном</span></h2>
              <p className="text-slate-400 max-w-xl mx-auto text-lg">8 модулей, покрывающих все потребности современного заведения. Нажмите, чтобы узнать подробнее.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {MODULES.map((mod, i) => (
              <Reveal key={mod.name} delay={50 * i}>
                <button onClick={() => setExpFeat(expFeat === i ? null : i)} className={`w-full text-left bg-[#0f1a2e]/50 backdrop-blur-sm rounded-xl p-5 border transition-all duration-300 hover:-translate-y-1 ${expFeat === i ? 'border-cyan-400/30 bg-cyan-400/5 shadow-lg shadow-cyan-500/5' : 'border-white/5 hover:border-cyan-400/15'}`}>
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-3 transition-all duration-300 ${expFeat === i ? 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-cyan-400/10 text-cyan-400'}`}>
                    <mod.icon className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-white text-sm mb-0.5">{mod.name}</div>
                  {expFeat === i && <div className="text-slate-400 text-xs leading-relaxed mt-2 border-t border-white/5 pt-2">{mod.desc}</div>}
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON ===== */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="compare">
        <FloatingOrbs />
        <GridPattern />
        <Reveal>
          <div className="text-center mb-16">
            <SectionBadge>Сравнение</SectionBadge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">Сравните сами. Мы <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">обгоняем конкурентов</span></h2>
          </div>
        </Reveal>
        <Reveal>
          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#0f1a2e]/50 backdrop-blur-sm shadow-[0_0_40px_rgba(0,0,0,0.2)]">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-4 md:p-5 font-bold text-white text-xs uppercase tracking-wider">Функция</th>
                  <th className="text-left p-4 md:p-5 font-bold text-cyan-400 text-xs uppercase tracking-wider">✦ FoodChain</th>
                  <th className="text-left p-4 md:p-5 font-bold text-slate-400 text-xs uppercase tracking-wider">iiko</th>
                  <th className="text-left p-4 md:p-5 font-bold text-slate-400 text-xs uppercase tracking-wider">YUMA</th>
                  <th className="text-left p-4 md:p-5 font-bold text-slate-400 text-xs uppercase tracking-wider">Poster</th>
                  <th className="text-left p-4 md:p-5 font-bold text-slate-400 text-xs uppercase tracking-wider">R‑Keeper</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className={`border-t border-white/5 transition-colors hover:bg-white/[0.02] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                    <td className="p-4 md:p-5 font-semibold text-white text-sm">{row.fn}</td>
                    <td className="p-4 md:p-5"><Cell val={row.fc} /></td>
                    <td className="p-4 md:p-5"><Cell val={row.iiko} /></td>
                    <td className="p-4 md:p-5"><Cell val={row.yuma} /></td>
                    <td className="p-4 md:p-5"><Cell val={row.poster} /></td>
                    <td className="p-4 md:p-5"><Cell val={row.rkeeper} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal delay={200}>
          <p className="text-center text-slate-400 mt-8 text-sm">Мы обгоняем конкурентов по функциональности и цене. <Link to="/register" className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors underline underline-offset-4 decoration-cyan-400/30">Попробуйте сами →</Link></p>
        </Reveal>
      </section>

      {/* ===== APPS ===== */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0b1120] via-[#0f1a2e] to-[#0b1120]">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <SectionBadge>Мобильные приложения</SectionBadge>
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">6 приложений — <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">единая экосистема</span></h2>
              <p className="text-slate-400 max-w-xl mx-auto text-lg">Каждый участник вашего бизнеса получает своё приложение с нужным набором функций.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {APPS.map((app, i) => (
              <Reveal key={app.id} delay={80 * i}>
                <button onClick={() => setModal(app.id)} className="group relative bg-gradient-to-b from-[#1a2744]/80 to-[#0f1a2e]/80 backdrop-blur-sm rounded-2xl p-6 border border-white/5 hover:border-cyan-400/20 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-500/5 text-center w-full">
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">{app.tag}</span>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg" style={{ background: `${app.color}15`, color: app.color }}>
                    <app.icon className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-2">{app.title}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{app.desc}</p>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <FloatingOrbs />
        <GridPattern />
        <Reveal>
          <div className="text-center mb-16">
            <SectionBadge>Отзывы</SectionBadge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">Нам доверяют <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">владельцы ресторанов</span></h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={120 * i}>
              <div className="group bg-gradient-to-b from-[#1a2744]/80 to-[#0f1a2e]/80 backdrop-blur-sm rounded-2xl p-7 border border-white/5 hover:border-cyan-400/10 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl">
                <div className="flex gap-0.5 mb-4">{stars}</div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6 italic">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}dd)` }}>{t.name[0]}</div>
                  <div>
                    <div className="text-white font-semibold text-sm">{t.name}</div>
                    <div className="text-slate-500 text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 bg-[#0f1a2e]/50" id="pricing">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <SectionBadge>Тарифы</SectionBadge>
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">Прозрачные цены <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">без скрытых платежей</span></h2>
              <p className="text-slate-400 max-w-xl mx-auto text-lg">Все тарифы включают 14-дневный бесплатный период. Никаких комиссий.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={150 * i}>
                <div className={`group relative rounded-2xl p-8 border transition-all duration-500 ${plan.popular ? 'bg-gradient-to-b from-[#1a2744] to-[#0f1a2e] border-cyan-400/40 shadow-[0_0_50px_rgba(0,180,216,0.08)]' : 'bg-gradient-to-b from-[#1a2744]/60 to-[#0f1a2e]/60 border-white/5 hover:border-cyan-400/20'}`}>
                  {plan.popular && (
                    <>
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold rounded-full shadow-lg shadow-cyan-500/30 inline-flex items-center gap-1.5">
                        <span className="relative flex w-2 h-2"><span className="absolute w-full h-full rounded-full bg-white animate-ping opacity-75" /><span className="relative w-2 h-2 rounded-full bg-white" /></span>
                        Самый популярный
                      </div>
                    </>
                  )}
                  <div className="font-bold text-lg text-white mb-1">{plan.name}</div>
                  <div className="text-slate-500 text-sm mb-5">{plan.desc}</div>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tracking-tight">{plan.price}</span>
                    <span className="text-slate-500 text-sm">₽/мес</span>
                    <span className="text-slate-600 text-sm line-through">{plan.oldPrice} ₽</span>
                  </div>
                  <ul className="my-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400">
                        <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0 drop-shadow-[0_0_4px_rgba(52,211,153,0.2)]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${plan.popular ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5' : 'border border-white/20 hover:border-cyan-400/40 text-white hover:bg-white/5'}`}>
                    Выбрать тариф
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={500}>
            <p className="text-center text-slate-500 text-sm mt-8">Все тарифы включают 14-дневный бесплатный период. Без привязки карты.</p>
          </Reveal>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <FloatingOrbs />
        <GridPattern />
        <Reveal>
          <div className="text-center mb-16">
            <SectionBadge>FAQ</SectionBadge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">Часто задаваемые <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">вопросы</span></h2>
          </div>
        </Reveal>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <Reveal key={i} delay={80 * i}>
              <div className={`group bg-gradient-to-b from-[#1a2744]/60 to-[#0f1a2e]/60 backdrop-blur-sm rounded-xl border transition-all ${openFaq === i ? 'border-cyan-400/20 shadow-lg shadow-cyan-500/5' : 'border-white/5 hover:border-white/10'}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 md:p-6 text-left">
                  <span className="text-sm md:text-base font-semibold text-white pr-4">{faq.q}</span>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${openFaq === i ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rotate-45 shadow-lg shadow-cyan-500/30' : 'bg-cyan-400/10 text-cyan-400'}`}>+</span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? 'max-h-80' : 'max-h-0'}`}>
                  <div className="px-5 md:px-6 pb-5 md:pb-6 pt-0">
                    <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#070d17] border-t border-white/5 py-16 px-4 sm:px-6 lg:px-8" id="contacts">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <span className="text-white font-black text-lg">F</span>
                </div>
                <span className="font-extrabold text-xl text-white tracking-tight">Food<span className="text-cyan-400">Chain</span></span>
              </Link>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">SaaS-платформа для управления рестораном нового поколения. Объединяем зал, кухню, доставку, склад и финансы.</p>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-5 uppercase tracking-wider">Продукт</h4>
              <div className="space-y-3">
                <a href="#features" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Возможности</a>
                <a href="#pricing" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Цены</a>
                <a href="#compare" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Сравнение с конкурентами</a>
                <Link to="/apps" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Приложения</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-5 uppercase tracking-wider">Компания</h4>
              <div className="space-y-3">
                <a href="#about" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">О нас</a>
                <a href="#contacts" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Контакты</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Блог</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Партнёрам</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-5 uppercase tracking-wider">Контакты</h4>
              <div className="space-y-3">
                <a href="tel:+74951234567" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">+7 (495) 123-45-67</a>
                <a href="mailto:hello@foodchain.ru" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">hello@foodchain.ru</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Telegram-канал</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">YouTube</a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <p>© 2026 FoodChain / MIRUZ. Все права защищены.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-cyan-400 transition-colors">Политика конфиденциальности</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">Публичная оферта</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== MODAL ===== */}
      {modal && APP_DETAILS[modal] && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-gradient-to-b from-[#1a2744] to-[#0f1a2e] rounded-2xl max-w-lg w-full p-8 border border-white/10 shadow-2xl relative animate-in" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all"><X className="w-4 h-4" /></button>
            <h3 className="text-xl font-bold text-white mb-3">{APP_DETAILS[modal].title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">{APP_DETAILS[modal].desc}</p>
            <ul className="space-y-2 mb-6">
              {APP_DETAILS[modal].features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-400">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-3">
              <div className="aspect-[9/16] bg-gradient-to-b from-white/5 to-white/[0.02] rounded-xl flex items-center justify-center text-slate-600 text-xs border border-white/5">Скриншот 1</div>
              <div className="aspect-[9/16] bg-gradient-to-b from-white/5 to-white/[0.02] rounded-xl flex items-center justify-center text-slate-600 text-xs border border-white/5">Скриншот 2</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float-particle {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes animate-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-in { animation: animate-in 0.3s ease-out; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0b1120; }
        ::-webkit-scrollbar-thumb { background: #1a2744; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #2a3a5a; }
      `}</style>
    </div>
  );
}
