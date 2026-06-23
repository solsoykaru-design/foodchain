import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, X, Menu, Star, ChevronLeft, ChevronRight, Maximize2,
  Smartphone, Tablet, Monitor, ShoppingCart, Package, BarChart3,
  Users, Megaphone, MessageCircle, Link2, MessageSquare, Bike, User, ChefHat, Globe,
  Zap, Shield, Diamond, Gift, QrCode, Split, Cloud, Cpu,
  BookOpen, Headphones, Award, Layers, Lock, ClipboardList, Wifi, Coffee, Phone, MapPin,
} from 'lucide-react';

/* ───── Data ───── */
const HERO_SLIDES = [
  { img: 'https://images.unsplash.com/photo-1573855619003-97b4799dcd8b?w=1920&q=85', label: 'Планшет официанта' },
  { img: 'https://images.unsplash.com/photo-1496318447583-f524534e9ce9?w=1920&q=85', label: 'Телефон гостя' },
  { img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1920&q=85', label: 'Киоск в зале' },
  { img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=85', label: 'Бэк-офис' },
  { img: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=1920&q=85', label: 'Курьер с телефоном' },
];

const DEVICES = [
  { icon: Smartphone, title: 'Смартфон гостя', desc: 'Меню, заказ, оплата, трекинг, чаты — всё в кармане.', img: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80' },
  { icon: Tablet, title: 'Планшет официанта', desc: 'Схема зала, приём заказов, отправка на кухню, оплата.', img: 'https://images.unsplash.com/photo-1573855619003-97b4799dcd8b?w=600&q=80' },
  { icon: Monitor, title: 'Киоск (терминал)', desc: 'Самообслуживание в зале: выбор блюд и оплата за 30 секунд.', img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=80' },
  { icon: Smartphone, title: 'Телефон курьера', desc: 'Заказы, навигатор, чат с гостем и официантом.', img: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=600&q=80' },
  { icon: Monitor, title: 'Кухонный экран (KDS)', desc: 'Все заказы на одном экране, таймеры, зоны кухни.', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80' },
  { icon: Monitor, title: 'Ноутбук / ПК', desc: 'Бэк-офис: дашборды, отчёты, управление меню и складом.', img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&q=80' },
];

const SCREENSHOTS = [
  { title: 'Гостевое приложение', desc: 'Меню, корзина, оплата, отслеживание заказа', img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&q=80' },
  { title: 'Приложение официанта', desc: 'Схема зала, создание заказа, приём оплаты', img: 'https://images.unsplash.com/photo-1573855619003-97b4799dcd8b?w=900&q=80' },
  { title: 'Приложение курьера', desc: 'Список заказов, карта с маршрутом, чат с гостем', img: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=900&q=80' },
  { title: 'Приложение кухни (KDS)', desc: 'Экран с заказами, таймеры, пошаговые рецепты', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=900&q=80' },
  { title: 'Бэк-офис', desc: 'Дашборд, управление меню, финансы и отчёты', img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&q=80' },
  { title: 'Склад и техкарты', desc: 'Учёт остатков, калькуляция блюд, автозаказ', img: 'https://images.unsplash.com/photo-1553729459-afe8f2e2a7c6?w=900&q=80' },
];

const FEATURE_SHOTS = [
  { title: 'Склад и техкарты', desc: 'Полный контроль остатков, автозаказ продуктов, калькуляция блюд и технические карты с расчётом себестоимости.', img: 'https://images.unsplash.com/photo-1553729459-afe8f2e2a7c6?w=900&q=80' },
  { title: 'Встроенные чаты', desc: 'Гость ↔ официант ↔ курьер. Реальное время. Без звонков. Все диалоги сохраняются в истории.', img: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=900&q=80' },
  { title: 'Онлайн-оплата', desc: 'Приём платежей картой, СБП, Apple Pay, Google Pay. Интеграция с Тинькофф, ЮKassa, CloudPayments.', img: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&q=80' },
  { title: 'Аналитика и отчёты', desc: 'Выручка, прибыль, средний чек, фудкост. Вся аналитика в реальном времени с экспортом в Excel.', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80' },
];

const MODULES = [
  { icon: ShoppingCart, name: 'Заказы', desc: 'Принимайте заказы из зала, доставки и самовывоза в одном окне.' },
  { icon: Package, name: 'Склад', desc: 'Контроль остатков, автозаказ, калькуляция и техкарты.' },
  { icon: BarChart3, name: 'Финансы', desc: 'Выручка, прибыль, фудкост, средний чек — онлайн.' },
  { icon: Users, name: 'Персонал', desc: 'Смены, чаевые, KPI и мотивация сотрудников.' },
  { icon: Megaphone, name: 'Маркетинг', desc: 'Акции, скидки, программы лояльности, push.' },
  { icon: MessageCircle, name: 'Чаты', desc: 'Чат между гостем, официантом и курьером.' },
  { icon: Globe, name: 'Интеграции', desc: 'Эквайринг, Telegram, соцсети, Google Maps.' },
  { icon: Link2, name: 'API', desc: 'Открытое API и SDK для ваших разработчиков.' },
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

const TESTIMONIALS = [
  { text: 'Перешли с iiko — разница колоссальная. Интерфейс современный, интуитивный. Встроенные чаты — то, чего нам не хватало.', name: 'Алексей Кузнецов', role: 'Владелец сети «La Maison», Казань', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80' },
  { text: 'Раньше работали на Poster — не хватало функционала для доставки. FoodChain решил все проблемы в одной системе.', name: 'Мария Соколова', role: 'CEO «СушиМастер», Екатеринбург', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80' },
  { text: 'Офлайн-режим спасает при сбоях интернета. AI-прогноз сократил списание продуктов на 30%. Рекомендую.', name: 'Дмитрий Волков', role: 'Управляющий «Biergarten», Москва', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80' },
];

const PLANS = [
  {
    name: 'Базовый', price: '9 900', oldPrice: '14 900', desc: 'Для небольших заведений',
    features: ['Управление заказами', 'Склад и техкарты', 'Финансы и отчёты', 'Приложение официанта', 'До 3 кассовых мест', 'Техподдержка в чате', '14 дней бесплатно'],
    popular: false,
  },
  {
    name: 'Бизнес', price: '19 900', oldPrice: '29 900', desc: 'Для ресторанов и служб доставки',
    features: ['Всё из «Базового»', 'Встроенные чаты', 'Приложения гостя и курьера', 'Маркетинг и лояльность', 'Интеграции и эквайринг', 'До 10 кассовых мест', 'Поддержка 24/7', 'AI-прогнозирование'],
    popular: true,
  },
  {
    name: 'Корпоративный', price: '39 900', oldPrice: '59 900', desc: 'Для сетей ресторанов',
    features: ['Всё из «Бизнеса»', 'Безлимит кассовых мест', 'Выделенный сервер/SLA', 'Геймификация и 2FA', 'Персональный менеджер', 'Индивидуальная доработка', 'Приоритетная поддержка'],
    popular: false,
  },
];

const FAQS = [
  { q: 'Что входит в тариф?', a: 'Каждый тариф включает полный набор функций из карточки. Никаких скрытых модулей — всё, что вы видите, уже включено.' },
  { q: 'Нужен ли сервер для установки?', a: 'Нет. FoodChain — облачное решение. Нужен только интернет. Для корпоративных клиентов — выделенный сервер.' },
  { q: 'Можно ли перенести данные из другой системы?', a: 'Да. Бесплатный перенос из iiko, R-Keeper, Poster, YUMA и 1С за 1–3 дня.' },
  { q: 'Есть ли техподдержка?', a: 'На «Базовом» — чат в рабочее время. На «Бизнесе» — 24/7. На «Корпоративном» — персональный менеджер.' },
  { q: 'Как работает демо-период?', a: '14 дней полного доступа. Без привязки карты и обязательств.' },
  { q: 'Можно ли подключить эквайринг?', a: 'Да. Сбербанк, Тинькофф, ЮKassa, CloudPayments. Всё из коробки.' },
];

/* ───── Helpers ───── */
function Cell({ val }: { val: boolean | string }) {
  if (val === true) return <span className="text-emerald-500 font-bold text-lg">✓</span>;
  if (val === false) return <span className="text-slate-300 text-lg">✗</span>;
  if (typeof val === 'string' && (val.startsWith('✗') || val.startsWith('от'))) return <span className="text-slate-400 text-sm">{val}</span>;
  return <span className="text-amber-500 text-sm">{val}</span>;
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

export function Home() {
  const [slide, setSlide] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expMod, setExpMod] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [galIdx, setGalIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  const stars = Array.from({ length: 5 }, (_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-800 font-['Inter',sans-serif] overflow-x-hidden selection:bg-cyan-500/30 selection:text-white">

      {/* ─── HEADER ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-white/90 backdrop-blur-xl shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all">
                <span className="text-white font-black text-base">F</span>
              </div>
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">Food<span className="text-cyan-500">Chain</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {['#features', '#pricing', '#reviews', '#contacts'].map((href, i) => (
                <a key={href} href={href} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200">
                  {['Возможности', 'Цены', 'Отзывы', 'Контакты'][i]}
                </a>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Вход</Link>
              <Link to="/register" className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all text-sm shadow-md">
                Попробовать бесплатно
              </Link>
            </div>
            <button className="md:hidden p-2 text-slate-600 hover:text-slate-900" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-white/98 backdrop-blur-2xl border-t border-slate-200 px-4 py-4 space-y-1">
            {['Возможности', 'Цены', 'Отзывы', 'Контакты'].map((label, i) => (
              <a key={label} href={['#features', '#pricing', '#reviews', '#contacts'][i]} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900">{label}</a>
            ))}
            <hr className="my-2 border-slate-200" />
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-medium text-slate-600">Вход</Link>
            <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-bold text-center text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl">Попробовать бесплатно</Link>
          </div>
        )}
      </header>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-white">
        <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2 opacity-30">
          {HERO_SLIDES.map((s, i) => (
            <div key={i} className={`rounded-2xl overflow-hidden transition-all duration-700 ${i === slide ? 'ring-2 ring-cyan-400 ring-offset-2 scale-[1.02] z-10' : 'opacity-60'}`}>
              <img src={s.img} alt={s.label} className="w-full h-full object-cover" loading={i < 3 ? 'eager' : 'lazy'} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/60 to-white/90" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 w-full">
          <div className="max-w-2xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 text-cyan-600 text-xs font-semibold rounded-full mb-6">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                Единая платформа для ресторана
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.08] tracking-tight mb-5">
                Управляйте рестораном<br />
                <span className="text-cyan-500">из любого устройства</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-lg sm:text-xl text-slate-500 max-w-lg leading-relaxed mb-8">
                FoodChain — единая платформа для зала, кухни, доставки и склада. 
                <span className="text-slate-700 font-medium"> Посмотрите, как это работает.</span>
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="flex flex-wrap gap-4 mb-10">
                <Link to="/register" className="relative group">
                  <span className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-7 py-3.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all text-sm shadow-md">
                    Начать 14-дневный демо-период
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
                <a href="#screenshots" className="inline-flex items-center gap-2 border border-slate-300 hover:border-cyan-400 text-slate-700 px-7 py-3.5 rounded-xl transition-all text-sm font-medium hover:bg-cyan-50">
                  Смотреть скриншоты
                </a>
              </div>
            </Reveal>
            <Reveal delay={400}>
              <div className="flex items-center gap-6 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> 100% функций</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> 17 фич</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> 0% скрытых платежей</span>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── DEVICES ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Работает на <span className="text-cyan-500">всех устройствах</span>
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto">Все приложения для вашего бизнеса в одной экосистеме.</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEVICES.map((d, i) => (
            <Reveal key={d.title} delay={80 * i}>
              <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-cyan-500/5 hover:-translate-y-1 transition-all duration-300">
                <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                  <img src={d.img} alt={d.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <d.icon className="w-4 h-4 text-cyan-500" />
                    <h3 className="font-bold text-slate-900 text-sm">{d.title}</h3>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed">{d.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── SCREENSHOTS GALLERY ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-cyan-500/[0.03] border-y border-slate-200" id="screenshots">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                Как это <span className="text-cyan-500">выглядит в работе</span>
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto">Посмотрите на интерфейсы системы в реальных сценариях.</p>
            </div>
          </Reveal>
          <Reveal>
            <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
              <div className="aspect-[16/9] sm:aspect-[16/8] bg-slate-100 relative">
                <img src={SCREENSHOTS[galIdx].img} alt={SCREENSHOTS[galIdx].title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
                  <h3 className="text-white font-bold text-lg sm:text-xl">{SCREENSHOTS[galIdx].title}</h3>
                  <p className="text-white/80 text-sm mt-1">{SCREENSHOTS[galIdx].desc}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100">
                <button onClick={() => setGalIdx(g => (g - 1 + SCREENSHOTS.length) % SCREENSHOTS.length)} className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500"><ChevronLeft className="w-5 h-5" /></button>
                <div className="flex gap-2">
                  {SCREENSHOTS.map((_, i) => (
                    <button key={i} onClick={() => setGalIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === galIdx ? 'bg-cyan-500 w-5' : 'bg-slate-300 hover:bg-slate-400'}`} />
                  ))}
                </div>
                <button onClick={() => setGalIdx(g => (g + 1) % SCREENSHOTS.length)} className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {SCREENSHOTS.map((s, i) => (
              <button key={i} onClick={() => setGalIdx(i)} className={`rounded-xl overflow-hidden border-2 transition-all ${i === galIdx ? 'border-cyan-400 ring-2 ring-cyan-200' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <img src={s.img} alt={s.title} className="w-full h-16 object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES WITH SCREENSHOTS ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="features">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Интерфейсы и <span className="text-cyan-500">функциональность</span>
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto">Посмотрите, как выглядят ключевые модули системы.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-6">
          {FEATURE_SHOTS.map((f, i) => (
            <Reveal key={f.title} delay={100 * i}>
              <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                  <img src={f.img} alt={f.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-slate-900 text-sm mb-2">{f.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── MODULES ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                Все модули <span className="text-cyan-500">в одной системе</span>
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto">8 модулей, которые покрывают все потребности ресторана.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MODULES.map((m, i) => (
              <Reveal key={m.name} delay={50 * i}>
                <button onClick={() => setExpMod(expMod === i ? null : i)} className={`w-full text-left bg-white border rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 ${expMod === i ? 'border-cyan-400 shadow-md shadow-cyan-500/10' : 'border-slate-200 hover:border-cyan-300'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 transition-all ${expMod === i ? 'bg-cyan-500 text-white shadow-md' : 'bg-cyan-50 text-cyan-500'}`}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-slate-900 text-sm">{m.name}</div>
                  {expMod === i && <div className="text-slate-500 text-xs mt-2 border-t border-slate-100 pt-2">{m.desc}</div>}
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPARISON ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="compare">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Сравните с <span className="text-cyan-500">конкурентами</span>
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto">Мы даём больше функций за меньшие деньги.</p>
          </div>
        </Reveal>
        <Reveal>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left p-4 font-bold text-slate-700 text-xs uppercase tracking-wider">Функция</th>
                  <th className="text-left p-4 font-bold text-cyan-500 text-xs uppercase tracking-wider">✦ FoodChain</th>
                  <th className="text-left p-4 font-medium text-slate-400 text-xs uppercase tracking-wider">iiko</th>
                  <th className="text-left p-4 font-medium text-slate-400 text-xs uppercase tracking-wider">YUMA</th>
                  <th className="text-left p-4 font-medium text-slate-400 text-xs uppercase tracking-wider">Poster</th>
                  <th className="text-left p-4 font-medium text-slate-400 text-xs uppercase tracking-wider">R-Keeper</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className={`border-t border-slate-100 hover:bg-cyan-50/30 transition-colors`}>
                    <td className="p-4 font-medium text-slate-700 text-sm">{row.fn}</td>
                    <td className="p-4"><Cell val={row.fc} /></td>
                    <td className="p-4"><Cell val={row.iiko} /></td>
                    <td className="p-4"><Cell val={row.yuma} /></td>
                    <td className="p-4"><Cell val={row.poster} /></td>
                    <td className="p-4"><Cell val={row.rkeeper} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal delay={200}>
          <p className="text-center mt-8 text-slate-500 text-sm">
            Мы обгоняем конкурентов по функциональности и цене.{' '}
            <Link to="/register" className="text-cyan-500 font-semibold hover:text-cyan-600 underline underline-offset-4">Попробуйте сами →</Link>
          </p>
        </Reveal>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200" id="reviews">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                Что говорят <span className="text-cyan-500">наши клиенты</span>
              </h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={120 * i}>
                <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-300">
                  <div className="flex gap-0.5 mb-4">{stars}</div>
                  <p className="text-slate-600 text-sm leading-relaxed mb-5">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <img src={t.img} alt={t.name} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                      <div className="text-slate-400 text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="pricing">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Прозрачные цены <span className="text-cyan-500">без сюрпризов</span>
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto">Все тарифы включают 14-дневный бесплатный период.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={150 * i}>
              <div className={`relative bg-white rounded-2xl border-2 p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${plan.popular ? 'border-cyan-400 shadow-lg shadow-cyan-500/10' : 'border-slate-200 hover:border-cyan-300'}`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold rounded-full shadow-md whitespace-nowrap">
                    Самый популярный
                  </div>
                )}
                <div className="font-bold text-lg text-slate-900 mb-1">{plan.name}</div>
                <div className="text-slate-400 text-sm mb-4">{plan.desc}</div>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{plan.price}</span>
                  <span className="text-slate-400 text-sm">₽/мес</span>
                  <span className="text-slate-300 text-sm line-through">{plan.oldPrice} ₽</span>
                </div>
                <ul className="my-6 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.popular ? 'text-cyan-500' : 'text-emerald-400'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${plan.popular ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:shadow-lg hover:shadow-cyan-500/30' : 'border border-slate-300 text-slate-700 hover:border-cyan-400 hover:bg-cyan-50'}`}>
                  Выбрать тариф
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-200">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                Часто задаваемые <span className="text-cyan-500">вопросы</span>
              </h2>
            </div>
          </Reveal>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={80 * i}>
                <div className={`bg-white border rounded-xl transition-all ${openFaq === i ? 'border-cyan-300 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                    <span className="text-sm font-medium text-slate-900 pr-4">{faq.q}</span>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${openFaq === i ? 'bg-cyan-500 text-white rotate-45' : 'bg-slate-100 text-slate-400'}`}>+</span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? 'max-h-80' : 'max-h-0'}`}>
                    <div className="px-5 pb-5 pt-0">
                      <p className="text-slate-500 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Начните <span className="text-cyan-500">14-дневный</span> демо-период
            </h2>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">Посмотрите на систему в деле. Без привязки карты и обязательств.</p>
            <Link to="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-8 py-4 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all shadow-md text-base">
              Попробовать бесплатно
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#0a192f] text-slate-400 py-16 px-4 sm:px-6 lg:px-8" id="contacts">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-white font-black text-base">F</span>
                </div>
                <span className="font-extrabold text-lg text-white tracking-tight">Food<span className="text-cyan-400">Chain</span></span>
              </Link>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">SaaS-платформа для управления рестораном. Объединяем зал, кухню, доставку, склад и финансы.</p>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs mb-5 uppercase tracking-wider">Продукт</h4>
              <div className="space-y-3">
                <a href="#features" className="block text-slate-400 hover:text-white transition-colors text-sm">Возможности</a>
                <a href="#pricing" className="block text-slate-400 hover:text-white transition-colors text-sm">Цены</a>
                <a href="#screenshots" className="block text-slate-400 hover:text-white transition-colors text-sm">Скриншоты</a>
                <a href="#reviews" className="block text-slate-400 hover:text-white transition-colors text-sm">Отзывы</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs mb-5 uppercase tracking-wider">Компания</h4>
              <div className="space-y-3">
                <a href="#" className="block text-slate-400 hover:text-white transition-colors text-sm">О нас</a>
                <a href="#contacts" className="block text-slate-400 hover:text-white transition-colors text-sm">Контакты</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors text-sm">Блог</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors text-sm">Партнёрам</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs mb-5 uppercase tracking-wider">Контакты</h4>
              <div className="space-y-3">
                <a href="tel:+74951234567" className="block text-slate-400 hover:text-white transition-colors text-sm">+7 (495) 123-45-67</a>
                <a href="mailto:hello@foodchain.ru" className="block text-slate-400 hover:text-white transition-colors text-sm">hello@foodchain.ru</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors text-sm">Telegram</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors text-sm">YouTube</a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <p>© 2026 FoodChain / MIRUZ. Все права защищены.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Политика конфиденциальности</a>
              <a href="#" className="hover:text-white transition-colors">Публичная оферта</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
