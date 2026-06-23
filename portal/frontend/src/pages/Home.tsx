import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronRight, Star, X, Menu,
  MessageCircle, Bike, User, ChefHat, Globe, Monitor,
  ShoppingCart, Package, BarChart3, Users, Megaphone, Smartphone, MessageSquare, Link2,
  Shield, Diamond, Gift, Split, Cloud, Cpu,
  BookOpen, Headphones, Award, Layers, Phone,
  Lock, ClipboardList, Wifi, Coffee, MapPin, Zap,
} from 'lucide-react';

const HERO_SLIDES = [
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=85',
  'https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=1920&q=85',
  'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=1920&q=85',
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1920&q=85',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1920&q=85',
];

const STATS = [
  { num: '100%', label: 'покрытие функций', color: 'text-[#c9a84c]' },
  { num: '17', label: 'уникальных фич', color: 'text-[#00b4d8]' },
  { num: '0%', label: 'скрытых платежей', color: 'text-[#c9a84c]' },
  { num: '14', label: 'дней бесплатно', color: 'text-[#00b4d8]' },
];

const ADVANTAGES = [
  { icon: Diamond, title: 'Единая экосистема', desc: 'Всё в одной системе: зал, кухня, доставка, склад, финансы. Никакой интеграции разнородных модулей.' },
  { icon: Zap, title: '17 уникальных функций', desc: 'Чаты, геймификация, офлайн-режим, 2FA, AI-прогнозирование спроса — то, чего нет у конкурентов.' },
  { icon: Shield, title: 'Современная архитектура', desc: 'Единая база данных, работа в реальном времени, горизонтальное масштабирование и облачная инфраструктура.' },
  { icon: Gift, title: '14 дней бесплатного доступа', desc: 'Полный доступ ко всем функциям. Без привязки карты и скрытых обязательств.' },
];

const FEATURES_17 = [
  { icon: MessageCircle, name: 'Чаты', desc: 'Гость ↔ официант ↔ курьер в реальном времени. Без звонков и SMS.' },
  { icon: Award, name: 'Геймификация', desc: 'Колесо удачи, викторины, челленджи для вовлечения гостей и мотивации персонала.' },
  { icon: Globe, name: 'Мультивалютность', desc: 'Поддержка нескольких валют для международных сетей ресторанов.' },
  { icon: Cpu, name: 'SDK', desc: 'Открытый SDK для создания собственных плагинов и расширений.' },
  { icon: Headphones, name: 'Колл-центр', desc: 'Интерфейс приёма заказов по телефону с IP-телефонией внутри системы.' },
  { icon: Wifi, name: 'Офлайн-режим', desc: 'Работа без интернета с автосинхронизацией при восстановлении связи.' },
  { icon: Cloud, name: 'AI-прогноз', desc: 'ML-модель прогнозирует продажи и закупки на основе исторических данных.' },
  { icon: Layers, name: 'Sous Chef', desc: 'Умная очередь на кухне — приоритизация заказов по времени и сложности.' },
  { icon: Split, name: 'Split Bill', desc: 'Деление чека между гостями за 2 клика.' },
  { icon: Smartphone, name: 'QR-заказ', desc: 'Гость сканирует QR и делает заказ сам со своего телефона.' },
  { icon: Monitor, name: 'FOH Display', desc: 'Экран раздачи: официанты видят готовые блюда без очереди.' },
  { icon: BookOpen, name: 'Честный знак', desc: 'Учёт маркированных товаров: вода, молочка, табак.' },
  { icon: Phone, name: 'IP-телефония', desc: 'Интеграция с АТС, запись и хранение всех разговоров.' },
  { icon: Coffee, name: 'Extensions', desc: 'Магазин расширений — подключайте сторонние сервисы в 1 клик.' },
  { icon: Lock, name: '2FA', desc: 'Двухфакторная защита аккаунтов администраторов.' },
  { icon: ClipboardList, name: 'Audit Log', desc: 'Логирование всех действий пользователей с полной прозрачностью.' },
  { icon: Smartphone, name: 'PWA', desc: 'Работает как приложение на телефоне гостя без установки.' },
];

const CHAT_CARDS = [
  { icon: MessageCircle, title: 'Гость ↔ Официант', desc: 'Гость может написать официанту из приложения — уточнить заказ, попросить счёт. Мгновенный ответ без очередей и криков через зал.', badge: 'Повышает лояльность на 40%' },
  { icon: Package, title: 'Курьер ↔ Официант', desc: 'Курьер уточняет адрес и время. Официант видит всё в приложении. Доставка становится быстрее и без ошибок.', badge: 'Ускоряет доставку на 25%' },
  { icon: MessageSquare, title: 'Гость ↔ Курьер', desc: 'Гость видит геолокацию курьера и может написать. Курьер отвечает — прозрачная доставка для всех.', badge: 'Снижает звонки на 60%' },
];

const MODULES = [
  { icon: ShoppingCart, name: 'Заказы', desc: 'Принимайте заказы из зала, доставки и самовывоза в одном окне.' },
  { icon: Package, name: 'Склад', desc: 'Контроль остатков, автозаказ, калькуляция и техкарты с себестоимостью.' },
  { icon: BarChart3, name: 'Финансы', desc: 'Выручка, прибыль, фудкост, средний чек — аналитика в реальном времени.' },
  { icon: Users, name: 'Персонал', desc: 'Смены, учёт времени, чаевые, KPI и мотивация сотрудников.' },
  { icon: Megaphone, name: 'Маркетинг', desc: 'Акции, скидки, программы лояльности, push и e-mail рассылки.' },
  { icon: Smartphone, name: 'Приложения', desc: 'Гость, официант, курьер, кухня — каждый получает свой инструмент.' },
  { icon: MessageCircle, name: 'Чаты', desc: 'Встроенные чаты между гостем, официантом и курьером.' },
  { icon: Link2, name: 'Интеграции', desc: 'Эквайринг, фискализация, Telegram, соцсети, сайт, карты.' },
];

const COMPARISON_ROWS = [
  { fn: 'Единая база данных и архитектура', fc: true, iiko: true, yuma: true, poster: true, rkeeper: '✗ модульная' },
  { fn: 'Встроенные чаты гость-официант-курьер', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'Офлайн-режим работы', fc: true, iiko: 'Ограничен', yuma: false, poster: 'Ограничен', rkeeper: 'Ограничен' },
  { fn: 'Геймификация персонала', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: '100% функций без доплат', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'Современный интерфейс', fc: true, iiko: 'Средний', yuma: true, poster: true, rkeeper: 'Устаревший' },
  { fn: 'Облачная версия', fc: true, iiko: true, yuma: true, poster: true, rkeeper: true },
  { fn: 'AI-прогнозирование спроса', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: '2FA и аудит безопасности', fc: true, iiko: 'Ограничен', yuma: false, poster: false, rkeeper: false },
  { fn: 'Цена входа', fc: 'Подписка от 9 900 ₽', iiko: 'от 35 000 ₽/мес', yuma: 'от 25 000 ₽/мес', poster: 'от 15 000 ₽/мес', rkeeper: 'от 107 000 ₽' },
];

const APPS = [
  { id: 'guest', tag: 'Гость', icon: User, title: 'Гость', desc: 'Меню, заказ, оплата, чаты, история, программа лояльности.' },
  { id: 'courier', tag: 'Курьер', icon: Bike, title: 'Курьер', desc: 'Заказы, навигатор, чаты, статусы доставки, выплаты.' },
  { id: 'waiter', tag: 'Официант', icon: ChefHat, title: 'Официант', desc: 'Приём заказов, отправка на кухню, чаты, оплата, чаевые.' },
  { id: 'kitchen', tag: 'Кухня', icon: Monitor, title: 'Кухня (KDS)', desc: 'Экран заказов, таймеры, сплит по зонам, статусы готовности.' },
  { id: 'website', tag: 'Сайт', icon: Globe, title: 'Веб-сайт', desc: 'Готовый сайт с меню, корзиной и онлайн-оплатой за 5 минут.' },
  { id: 'kiosk', tag: 'Киоск', icon: Monitor, title: 'Киоск (SST)', desc: 'Терминал самообслуживания, увеличивает средний чек на 20%.' },
];

const TESTIMONIALS = [
  { text: 'Перешли на FoodChain с iiko — разница колоссальная. Интерфейс современный, интуитивно понятный. Встроенные чаты — это уровень, которого нет ни у кого.', name: 'Алексей Кузнецов', role: 'Владелец сети «La Maison», Казань', color: '#c9a84c', rating: 5 },
  { text: 'Раньше пользовались Poster — не хватало функционала для доставки. FoodChain решил все проблемы: зал, доставка, склад в одной системе.', name: 'Мария Соколова', role: 'CEO «СушиМастер», Екатеринбург', color: '#00b4d8', rating: 5 },
  { text: 'Офлайн-режим спасает, когда интернет падает — ни одного простоя за полгода. AI-прогноз закупок сократил списание продуктов на 30%.', name: 'Дмитрий Волков', role: 'Управляющий «Biergarten», Москва', color: '#c9a84c', rating: 5 },
];

const PLANS = [
  {
    name: 'Бронзовый', price: '9 900', oldPrice: '14 900', desc: 'Для небольших заведений',
    features: ['Управление заказами', 'Склад и техкарты', 'Финансы и отчёты', 'Приложение официанта', 'До 3 кассовых мест', 'Техподдержка в чате', '14 дней бесплатно'],
    tier: 'bronze',
  },
  {
    name: 'Золотой', price: '19 900', oldPrice: '29 900', desc: 'Для ресторанов и служб доставки',
    features: ['Всё из «Бронзового»', 'Встроенные чаты', 'Приложения гостя и курьера', 'Маркетинг и лояльность', 'Интеграции и эквайринг', 'До 10 кассовых мест', 'Поддержка 24/7', 'AI-прогнозирование'],
    tier: 'gold',
  },
  {
    name: 'Платиновый', price: '39 900', oldPrice: '59 900', desc: 'Для сетей ресторанов',
    features: ['Всё из «Золотого»', 'Безлимит кассовых мест', 'Централизованное управление', 'Выделенный сервер / SLA', 'Геймификация и 2FA', 'Персональный менеджер', 'Индивидуальная доработка', 'Приоритетная поддержка'],
    tier: 'platinum',
  },
];

const FAQS = [
  { q: 'Что входит в тариф?', a: 'Каждый тариф включает полный набор функций, указанных в карточке. Никаких скрытых модулей — всё, что вы видите, уже включено в стоимость.' },
  { q: 'Нужен ли сервер для установки?', a: 'Нет. FoodChain — полностью облачное решение. Вам нужен только доступ в интернет. Для корпоративных клиентов возможна установка на выделенный сервер.' },
  { q: 'Можно ли перенести данные из другой системы?', a: 'Да. Предоставляем бесплатный перенос из iiko, R‑Keeper, Poster, YUMA и 1С. Миграция занимает 1–3 дня.' },
  { q: 'Есть ли техподдержка?', a: 'Да. На всех тарифах — чат с оператором. На «Золотом» — 24/7. На «Платиновом» — персональный менеджер.' },
  { q: 'Как работает демо-период?', a: '14 дней полного доступа ко всем функциям. Без привязки карты и обязательств.' },
  { q: 'Можно ли подключить эквайринг и фискализацию?', a: 'Да. Поддерживаем Сбербанк, Тинькофф, ЮKassa, CloudPayments. Всё работает из коробки.' },
];

const APP_DETAILS: Record<string, { title: string; desc: string; features: string[] }> = {
  guest: { title: 'Приложение «Гость»', desc: 'Полноценное мобильное приложение для ваших гостей.', features: ['Меню с фото и описаниями', 'Корзина и онлайн-оплата', 'Чат с официантом и курьером', 'История заказов', 'Программа лояльности'] },
  courier: { title: 'Приложение «Курьер»', desc: 'Профессиональное приложение для курьеров.', features: ['Приём новых заказов', 'Оптимальный маршрут', 'Чат с гостем и официантом', 'Статусы доставки', 'История выплат'] },
  waiter: { title: 'Приложение «Официант»', desc: 'Принимайте заказы гостей через планшет.', features: ['План зала и расстановка', 'Приём заказов', 'Отправка на кухню', 'Чат с гостем и курьером', 'Приём оплаты'] },
  kitchen: { title: 'Экран «Кухня» (KDS)', desc: 'Кухонный дисплей в реальном времени.', features: ['Все заказы онлайн', 'Сплит по зонам', 'Таймеры готовности', 'Цветовая индикация', 'Статусы готовности'] },
  website: { title: 'Веб-сайт ресторана', desc: 'Готовый адаптивный сайт за 5 минут.', features: ['Меню с фото', 'Корзина и оплата', 'Интеграция с доставкой', 'Свой домен', 'SEO-оптимизация'] },
  kiosk: { title: 'Киоск самообслуживания', desc: 'Терминал для залов быстрого питания.', features: ['Сенсорный интерфейс', 'Визуальное меню', 'Онлайн-оплата', 'QR-код заказа', '+20% к среднему чеку'] },
};

function Cell({ val }: { val: boolean | string }) {
  if (val === true) return <span className="text-[#c9a84c] font-bold text-lg drop-shadow-[0_0_8px_rgba(201,168,76,0.2)]">✓</span>;
  if (val === false) return <span className="text-[#707070] text-lg">✗</span>;
  if (typeof val === 'string' && (val.startsWith('✗') || val.startsWith('от'))) return <span className="text-[#707070] text-sm">{val}</span>;
  return <span className="text-[#b0b0b0] text-sm">{val}</span>;
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add('opacity-100', 'translate-y-0');
        el.classList.remove('opacity-0', 'translate-y-10');
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
    <div ref={ref} className={`opacity-0 translate-y-10 transition-all duration-[900ms] ease-out ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function GoldLine({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-gradient-to-r from-transparent via-[#c9a84c]/40 to-transparent ${className}`} />;
}

function SectionHeading({ badge, title, subtitle }: { badge?: string; title: React.ReactNode; subtitle?: string }) {
  return (
    <div className="text-center mb-16 md:mb-20">
      {badge && (
        <span className="inline-block font-sans text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.25em] text-[#c9a84c] mb-5">
          {badge}
        </span>
      )}
      <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
        {title}
      </h2>
      {subtitle && <p className="font-sans text-[#b0b0b0] text-sm md:text-base mt-4 max-w-xl mx-auto leading-relaxed">{subtitle}</p>}
      <GoldLine className="mt-6 max-w-[120px] mx-auto" />
    </div>
  );
}

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#c9a84c]/[0.03] blur-[150px]" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-[#00b4d8]/[0.03] blur-[120px]" />
      <div className="absolute top-1/3 left-1/2 w-64 h-64 rounded-full bg-[#c9a84c]/[0.02] blur-[100px]" />
    </div>
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
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const stars = Array.from({ length: 5 }, (_, i) => <Star key={i} className="w-4 h-4 fill-[#c9a84c] text-[#c9a84c]" />);

  return (
    <div className="min-h-screen bg-[#0b1120] text-white font-['Inter',sans-serif] overflow-x-hidden selection:bg-[#c9a84c]/30 selection:text-white">
      {/* ===== HEADER ===== */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${scrolled ? 'bg-[#0b1120]/90 backdrop-blur-2xl shadow-[0_1px_0_rgba(201,168,76,0.08)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-20 md:h-24">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 border border-[#c9a84c]/40 rounded-xl flex items-center justify-center bg-[#0b1120] group-hover:border-[#c9a84c]/70 transition-all duration-500">
                <span className="text-[#c9a84c] font-serif font-bold text-lg">F</span>
              </div>
              <span className="font-sans font-light text-xl text-white tracking-[0.15em]">FOOD<span className="text-[#c9a84c] font-semibold">CHAIN</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {['#features', '#pricing', '#about', '#contacts'].map((href, i) => (
                <a key={href} href={href} className="relative px-5 py-2 text-sm font-sans font-medium tracking-[0.08em] text-[#b0b0b0] hover:text-white transition-all duration-300">
                  {['Возможности', 'Цены', 'О нас', 'Контакты'][i]}
                  <span className="absolute bottom-0 left-4 right-4 h-px bg-[#c9a84c]/40 scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                </a>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-4">
              <Link to="/login" className="px-5 py-2 text-sm font-sans font-medium tracking-[0.08em] text-[#b0b0b0] hover:text-white border border-transparent hover:border-[#c9a84c]/20 rounded-lg transition-all duration-300">
                Вход
              </Link>
              <Link to="/register" className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#c9a84c] to-[#a8882e] rounded-lg blur opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
                <span className="relative flex items-center gap-2 font-sans font-semibold tracking-[0.05em] text-sm text-[#0b1120] bg-gradient-to-r from-[#c9a84c] to-[#a8882e] px-6 py-2.5 rounded-lg transition-all duration-300">
                  Попробовать бесплатно
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
            <button className="md:hidden p-2 text-white hover:text-[#c9a84c] transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-[#0b1120]/98 backdrop-blur-2xl border-t border-[#c9a84c]/10 px-6 py-5 space-y-2">
            {['Возможности', 'Цены', 'О нас', 'Контакты'].map((label, i) => (
              <a key={label} href={['#features', '#pricing', '#about', '#contacts'][i]} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-sans tracking-[0.08em] text-[#b0b0b0] hover:text-white hover:bg-white/5 transition-all">{label}</a>
            ))}
            <hr className="my-3 border-[#c9a84c]/10" />
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-sans tracking-[0.08em] text-[#b0b0b0] hover:text-white">Вход</Link>
            <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-sans font-semibold text-center text-[#0b1120] bg-gradient-to-r from-[#c9a84c] to-[#a8882e] rounded-lg">Попробовать бесплатно</Link>
          </div>
        )}
      </header>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          {HERO_SLIDES.map((src, i) => (
            <div key={i} className={`absolute inset-0 transition-all duration-[1500ms] ${i === slide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1120]/95 via-[#0b1120]/70 to-[#0b1120]/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.03)_0%,transparent_60%)]" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 pt-32 pb-20 w-full">
          <div className="max-w-3xl">
            <Reveal>
              <div className="flex items-center gap-3 mb-8">
                <GoldLine className="w-12" />
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-[#c9a84c]">
                  Премиальная платформа №1
                </span>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-[-0.02em] mb-6">
                Управляйте рестораном<br />
                <span className="text-[#c9a84c] italic">на уровне лидера</span>
              </h1>
            </Reveal>
            <Reveal delay={300}>
              <p className="font-sans text-lg md:text-xl text-[#b0b0b0] max-w-xl leading-relaxed mb-10 tracking-wide">
                FoodChain — премиальная SaaS-платформа для ресторанного бизнеса. Объединяет зал, кухню, доставку и финансы в единой экосистеме.
              </p>
            </Reveal>
            <Reveal delay={450}>
              <div className="flex flex-wrap gap-5 mb-14">
                <Link to="/register" className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#c9a84c] to-[#a8882e] rounded-xl blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
                  <span className="relative flex items-center gap-3 font-sans font-semibold tracking-[0.05em] text-sm text-[#0b1120] bg-gradient-to-r from-[#c9a84c] to-[#a8882e] px-8 py-4 rounded-xl transition-all duration-300 group-hover:-translate-y-0.5">
                    Начать 14-дневный бесплатный период
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
                <a href="#compare" className="inline-flex items-center gap-2.5 border border-[#c9a84c]/20 hover:border-[#c9a84c]/50 text-white px-8 py-4 rounded-xl transition-all duration-400 hover:bg-white/[0.02] text-sm font-sans font-medium tracking-[0.05em]">
                  Сравнить с конкурентами
                </a>
              </div>
            </Reveal>
            <Reveal delay={600}>
              <GoldLine className="mb-8 max-w-[400px]" />
              <div className="flex flex-wrap gap-x-12 gap-y-4">
                {STATS.map((item) => (
                  <div key={item.label} className="flex items-baseline gap-2">
                    <span className={`font-serif text-3xl font-bold ${item.color}`}>{item.num}</span>
                    <span className="font-sans text-xs text-[#707070] tracking-[0.1em] uppercase">{item.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== ADVANTAGES ===== */}
      <section className="relative py-28 px-6 sm:px-8 lg:px-10">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Преимущества"
            title={<>Преимущества, которые <span className="text-[#c9a84c]">делают нас лидером</span></>}
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ADVANTAGES.map((card, i) => (
              <Reveal key={card.title} delay={120 * i}>
                <div className="group relative bg-gradient-to-b from-[#101d35]/80 to-[#0b1120] rounded-2xl p-8 border border-[#c9a84c]/10 hover:border-[#c9a84c]/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#c9a84c]/5 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="w-14 h-14 rounded-xl border border-[#c9a84c]/20 flex items-center justify-center mb-5 text-[#c9a84c] group-hover:bg-[#c9a84c]/10 transition-all duration-500">
                    <card.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-white mb-3">{card.title}</h3>
                  <p className="font-sans text-sm text-[#b0b0b0] leading-relaxed">{card.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 17 FEATURES ===== */}
      <section className="relative py-28 px-6 sm:px-8 lg:px-10 bg-gradient-to-b from-[#0b1120] via-[#0d1a30] to-[#0b1120]" id="features">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="17 уникальных функций"
            title={<>17 функций, которых нет<br />в <span className="text-[#00b4d8]">iiko, YUMA, Poster и R‑Keeper</span></>}
            subtitle="Только в FoodChain собраны все эти возможности. Конкуренты предлагают лишь половину."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {FEATURES_17.map((feat, i) => (
              <Reveal key={feat.name} delay={30 * i}>
                <div className="group bg-[#0d1a30]/50 border border-[#c9a84c]/5 hover:border-[#c9a84c]/20 rounded-xl p-4 transition-all duration-400">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg border border-[#c9a84c]/10 flex items-center justify-center text-[#c9a84c] group-hover:bg-[#c9a84c]/10 transition-all duration-400 shrink-0">
                      <feat.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-sans font-semibold text-white text-xs tracking-[0.08em] mb-1.5 flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-[#c9a84c]/20 text-[#707070] text-[8px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        {feat.name}
                      </div>
                      <p className="font-sans text-[#707070] text-[11px] leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={600}>
            <p className="text-center font-sans text-sm text-[#707070] mt-10 max-w-2xl mx-auto tracking-[0.05em]">
              Почему мы лучшие? <span className="text-white font-semibold">Потому что мы даём больше.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== CHATS ===== */}
      <section className="relative py-28 px-6 sm:px-8 lg:px-10">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Уникальные чаты"
            title={<>Единственная система с <span className="text-[#00b4d8]">встроенными чатами</span></>}
            subtitle="Гость ↔ Официант ↔ Курьер. В реальном времени. Без звонков."
          />
          <div className="grid md:grid-cols-3 gap-6">
            {CHAT_CARDS.map((card, i) => (
              <Reveal key={card.title} delay={120 * i}>
                <div className="group relative bg-gradient-to-b from-[#101d35]/80 to-[#0b1120] border border-[#c9a84c]/10 hover:border-[#00b4d8]/30 rounded-2xl p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl">
                  <div className="w-14 h-14 rounded-full border border-[#00b4d8]/20 flex items-center justify-center mb-5 text-[#00b4d8] group-hover:bg-[#00b4d8]/10 transition-all duration-500">
                    <card.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-white mb-3">{card.title}</h3>
                  <p className="font-sans text-sm text-[#b0b0b0] leading-relaxed mb-5">{card.desc}</p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#c9a84c]/20 text-[#c9a84c] text-[10px] font-sans font-semibold tracking-[0.05em]">{card.badge}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={400}>
            <p className="text-center font-sans text-xs text-[#707070] mt-10 tracking-[0.1em] uppercase">
              Этого нет в iiko, YUMA, Poster и R‑Keeper
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== MODULES ===== */}
      <section className="relative py-28 px-6 sm:px-8 lg:px-10 bg-gradient-to-b from-[#0b1120] via-[#0d1a30]/80 to-[#0b1120]">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Возможности"
            title={<>Премиальный набор <span className="text-[#c9a84c]">инструментов</span></>}
            subtitle="8 модулей, покрывающих все потребности современного ресторана."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {MODULES.map((mod, i) => (
              <Reveal key={mod.name} delay={50 * i}>
                <button onClick={() => setExpFeat(expFeat === i ? null : i)} className={`w-full text-left bg-[#0d1a30]/50 border rounded-xl p-5 transition-all duration-500 hover:-translate-y-0.5 ${expFeat === i ? 'border-[#c9a84c]/30 bg-[#c9a84c]/5' : 'border-[#c9a84c]/5 hover:border-[#c9a84c]/15'}`}>
                  <div className={`w-11 h-11 rounded-lg border flex items-center justify-center mb-3 transition-all duration-500 ${expFeat === i ? 'border-[#c9a84c]/40 bg-[#c9a84c]/10 text-[#c9a84c]' : 'border-[#c9a84c]/10 text-[#b0b0b0]'}`}>
                    <mod.icon className="w-5 h-5" />
                  </div>
                  <div className="font-sans font-semibold text-white text-sm mb-0.5 tracking-[0.05em]">{mod.name}</div>
                  {expFeat === i && <div className="font-sans text-[#707070] text-xs leading-relaxed mt-2 border-t border-[#c9a84c]/10 pt-2">{mod.desc}</div>}
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON ===== */}
      <section className="relative py-28 px-6 sm:px-8 lg:px-10" id="compare">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Сравнение"
            title={<>Мы лидеры <span className="text-[#c9a84c]">по функциональности</span></>}
          />
          <Reveal>
            <div className="overflow-x-auto rounded-2xl border border-[#c9a84c]/10 bg-[#0d1a30]/50 shadow-[0_0_60px_rgba(201,168,76,0.03)]">
              <table className="w-full min-w-[700px] font-sans text-sm">
                <thead>
                  <tr className="border-b border-[#c9a84c]/10">
                    <th className="text-left p-4 md:p-5 font-semibold text-white text-xs uppercase tracking-[0.15em]">Функция</th>
                    <th className="text-left p-4 md:p-5 font-bold text-[#c9a84c] text-xs uppercase tracking-[0.15em]">✦ FoodChain</th>
                    <th className="text-left p-4 md:p-5 font-medium text-[#707070] text-xs uppercase tracking-[0.1em]">iiko</th>
                    <th className="text-left p-4 md:p-5 font-medium text-[#707070] text-xs uppercase tracking-[0.1em]">YUMA</th>
                    <th className="text-left p-4 md:p-5 font-medium text-[#707070] text-xs uppercase tracking-[0.1em]">Poster</th>
                    <th className="text-left p-4 md:p-5 font-medium text-[#707070] text-xs uppercase tracking-[0.1em]">R‑Keeper</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={i} className={`border-t border-[#c9a84c]/5 transition-colors hover:bg-white/[0.02]`}>
                      <td className="p-4 md:p-5 font-medium text-white text-sm">{row.fn}</td>
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
            <p className="text-center font-serif text-xl text-white mt-8 italic">
              FoodChain — <span className="text-[#c9a84c] not-italic font-semibold">больше, чем конкуренты</span>.
              <Link to="/register" className="block mt-4 font-sans text-sm text-[#c9a84c] hover:text-[#dfc06a] transition-colors underline underline-offset-4 decoration-[#c9a84c]/30">
                Попробуйте сами →
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== APPS ===== */}
      <section className="relative py-28 px-6 sm:px-8 lg:px-10 bg-gradient-to-b from-[#0b1120] via-[#0d1a30]/80 to-[#0b1120]">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Приложения"
            title={<>6 приложений — <span className="text-[#00b4d8]">единая экосистема</span></>}
            subtitle="Каждый участник вашего бизнеса получает свой инструмент."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {APPS.map((app, i) => (
              <Reveal key={app.id} delay={80 * i}>
                <button onClick={() => setModal(app.id)} className="group relative bg-gradient-to-b from-[#101d35]/80 to-[#0b1120] border border-[#c9a84c]/5 hover:border-[#00b4d8]/30 rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl text-center w-full">
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full border border-[#c9a84c]/20 text-[#c9a84c] text-[9px] font-sans font-semibold tracking-[0.08em]">{app.tag}</span>
                  <div className="w-14 h-14 rounded-xl border border-[#c9a84c]/10 flex items-center justify-center mx-auto mb-4 text-[#b0b0b0] group-hover:text-[#00b4d8] group-hover:border-[#00b4d8]/30 transition-all duration-500">
                    <app.icon className="w-6 h-6" />
                  </div>
                  <h4 className="font-sans font-semibold text-white text-sm mb-2 tracking-[0.05em]">{app.title}</h4>
                  <p className="font-sans text-[#707070] text-xs leading-relaxed">{app.desc}</p>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="relative py-28 px-6 sm:px-8 lg:px-10">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Отзывы"
            title={<>Нам доверяют <span className="text-[#c9a84c]">лидеры рынка</span></>}
          />
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={120 * i}>
                <div className="group bg-gradient-to-b from-[#101d35]/80 to-[#0b1120] border border-[#c9a84c]/10 hover:border-[#c9a84c]/20 rounded-2xl p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl">
                  <div className="flex gap-0.5 mb-4">{stars}</div>
                  <p className="font-sans text-sm text-[#b0b0b0] leading-relaxed mb-6 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-[#c9a84c]/10">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-serif font-bold text-sm shadow-lg" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}dd)` }}>{t.name[0]}</div>
                    <div>
                      <div className="font-sans font-semibold text-white text-sm">{t.name}</div>
                      <div className="font-sans text-[#707070] text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="relative py-28 px-6 sm:px-8 lg:px-10 bg-gradient-to-b from-[#0b1120] via-[#0d1a30]/80 to-[#0b1120]" id="pricing">
        <FloatingOrbs />
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            badge="Тарифы"
            title={<>Прозрачные цены <span className="text-[#c9a84c]">премиум-класса</span></>}
            subtitle="Все тарифы включают 14-дневный бесплатный период."
          />
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={150 * i}>
                <div className={`group relative rounded-2xl p-8 border transition-all duration-500 ${
                  plan.tier === 'gold'
                    ? 'bg-gradient-to-b from-[#101d35] to-[#0b1120] border-[#c9a84c]/40 shadow-[0_0_60px_rgba(201,168,76,0.05)]'
                    : 'bg-gradient-to-b from-[#101d35]/60 to-[#0b1120] border-[#c9a84c]/10 hover:border-[#c9a84c]/30'
                }`}>
                  {plan.tier === 'gold' && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1 bg-gradient-to-r from-[#c9a84c] to-[#a8882e] text-[#0b1120] text-xs font-sans font-bold rounded-full shadow-lg shadow-[#c9a84c]/30 tracking-[0.08em]">
                      Самый популярный
                    </div>
                  )}
                  <div className={`font-serif text-lg font-semibold text-white mb-1 ${plan.tier === 'gold' ? 'text-[#c9a84c]' : ''}`}>{plan.name}</div>
                  <div className="font-sans text-[#707070] text-sm mb-5 tracking-[0.05em]">{plan.desc}</div>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className={`font-serif text-4xl font-bold tracking-tight ${plan.tier === 'gold' ? 'text-[#c9a84c]' : 'text-white'}`}>{plan.price}</span>
                    <span className="font-sans text-[#707070] text-sm">₽/мес</span>
                    <span className="font-sans text-[#505050] text-sm line-through">{plan.oldPrice} ₽</span>
                  </div>
                  <ul className="my-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 font-sans text-sm text-[#b0b0b0]">
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.tier === 'gold' ? 'text-[#c9a84c]' : 'text-[#707070]'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-sans font-semibold tracking-[0.05em] transition-all duration-300 ${
                    plan.tier === 'gold'
                      ? 'bg-gradient-to-r from-[#c9a84c] to-[#a8882e] text-[#0b1120] shadow-lg shadow-[#c9a84c]/20 hover:shadow-[#c9a84c]/40 hover:-translate-y-0.5'
                      : 'border border-[#c9a84c]/20 hover:border-[#c9a84c]/40 text-white hover:bg-white/[0.02]'
                  }`}>
                    Выбрать тариф
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="relative py-28 px-6 sm:px-8 lg:px-10 max-w-3xl mx-auto">
        <FloatingOrbs />
        <SectionHeading
          badge="FAQ"
          title={<>Часто задаваемые <span className="text-[#c9a84c]">вопросы</span></>}
        />
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <Reveal key={i} delay={80 * i}>
              <div className={`group bg-gradient-to-b from-[#101d35]/60 to-[#0b1120] border rounded-xl transition-all ${openFaq === i ? 'border-[#c9a84c]/30 shadow-lg shadow-[#c9a84c]/5' : 'border-[#c9a84c]/10 hover:border-[#c9a84c]/20'}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 md:p-6 text-left">
                  <span className="font-sans text-sm md:text-base font-medium text-white pr-4 tracking-[0.03em]">{faq.q}</span>
                  <span className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all shrink-0 text-sm ${openFaq === i ? 'border-[#c9a84c]/40 bg-[#c9a84c]/10 text-[#c9a84c]' : 'border-[#c9a84c]/20 text-[#707070]'}`}>
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                <div className={`overflow-hidden transition-all duration-[500ms] ease-in-out ${openFaq === i ? 'max-h-80' : 'max-h-0'}`}>
                  <div className="px-5 md:px-6 pb-5 md:pb-6 pt-0">
                    <p className="font-sans text-[#b0b0b0] text-sm leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#070d17] border-t border-[#c9a84c]/10 py-16 px-6 sm:px-8 lg:px-10" id="contacts">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <Link to="/" className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 border border-[#c9a84c]/40 rounded-xl flex items-center justify-center">
                  <span className="text-[#c9a84c] font-serif font-bold text-lg">F</span>
                </div>
                <span className="font-sans font-light text-xl text-white tracking-[0.15em]">FOOD<span className="text-[#c9a84c] font-semibold">CHAIN</span></span>
              </Link>
              <p className="font-sans text-[#707070] text-sm leading-relaxed max-w-xs">Премиальная SaaS-платформа для управления рестораном. Объединяем зал, кухню, доставку, склад и финансы.</p>
            </div>
            <div>
              <h4 className="font-sans font-semibold text-white text-xs mb-5 uppercase tracking-[0.15em]">Продукт</h4>
              <div className="space-y-3">
                <a href="#features" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">Возможности</a>
                <a href="#pricing" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">Цены</a>
                <a href="#compare" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">Сравнение</a>
                <Link to="/apps" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">Приложения</Link>
              </div>
            </div>
            <div>
              <h4 className="font-sans font-semibold text-white text-xs mb-5 uppercase tracking-[0.15em]">Компания</h4>
              <div className="space-y-3">
                <a href="#about" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">О нас</a>
                <a href="#contacts" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">Контакты</a>
                <a href="#" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">Блог</a>
                <a href="#" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">Партнёрам</a>
              </div>
            </div>
            <div>
              <h4 className="font-sans font-semibold text-white text-xs mb-5 uppercase tracking-[0.15em]">Контакты</h4>
              <div className="space-y-3">
                <a href="tel:+74951234567" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">+7 (495) 123-45-67</a>
                <a href="mailto:hello@foodchain.ru" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">hello@foodchain.ru</a>
                <a href="#" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">Telegram</a>
                <a href="#" className="block font-sans text-[#707070] hover:text-[#c9a84c] transition-colors text-sm">YouTube</a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-[#c9a84c]/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-sans text-xs text-[#707070]">© 2026 FoodChain / MIRUZ. Все права защищены.</p>
            <div className="flex gap-6 font-sans text-xs text-[#707070]">
              <a href="#" className="hover:text-[#c9a84c] transition-colors">Политика конфиденциальности</a>
              <a href="#" className="hover:text-[#c9a84c] transition-colors">Публичная оферта</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== MODAL ===== */}
      {modal && APP_DETAILS[modal] && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-gradient-to-b from-[#101d35] to-[#0b1120] rounded-2xl max-w-lg w-full p-8 border border-[#c9a84c]/20 shadow-2xl relative animate-in" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full border border-[#c9a84c]/20 flex items-center justify-center text-[#707070] hover:text-white hover:border-[#c9a84c]/40 transition-all"><X className="w-4 h-4" /></button>
            <h3 className="font-serif text-xl font-bold text-white mb-3">{APP_DETAILS[modal].title}</h3>
            <p className="font-sans text-[#b0b0b0] text-sm leading-relaxed mb-5">{APP_DETAILS[modal].desc}</p>
            <ul className="space-y-2 mb-6">
              {APP_DETAILS[modal].features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 font-sans text-sm text-[#b0b0b0]">
                  <Check className="w-4 h-4 text-[#c9a84c] shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-3">
              <div className="aspect-[9/16] bg-gradient-to-b from-white/[0.03] to-white/[0.01] rounded-xl flex items-center justify-center text-[#505050] text-xs border border-[#c9a84c]/10">Скриншот 1</div>
              <div className="aspect-[9/16] bg-gradient-to-b from-white/[0.03] to-white/[0.01] rounded-xl flex items-center justify-center text-[#505050] text-xs border border-[#c9a84c]/10">Скриншот 2</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes animate-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-in { animation: animate-in 0.4s ease-out; }
      `}</style>
    </div>
  );
}
