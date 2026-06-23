import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronRight, Star, X, Menu,
  MessageCircle, Bike, User, ChefHat, Globe, Monitor,
  ShoppingCart, Package, BarChart3, Users, Megaphone, Smartphone, MessageSquare, Link2,
  Zap, Shield, Diamond, Gift,
  ExternalLink,
} from 'lucide-react';

const HERO_SLIDES = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1920&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&q=80',
  'https://images.unsplash.com/photo-1488590528505-98d2b853aba4?w=1920&q=80',
];

const WHY_CARDS = [
  { icon: Globe, title: 'Единая экосистема', desc: 'Одно приложение для всего: зал, кухня, доставка, склад, финансы. Никаких зоопарков из 5 разных систем.' },
  { icon: Diamond, title: '100% функций без доплат', desc: 'Всё включено в подписку. Никаких скрытых платежей, никаких «купите ещё модуль». Честная цена с первого дня.' },
  { icon: Zap, title: '17 уникальных фич', desc: 'Чаты, геймификация, офлайн-режим, 2FA, прогнозирование спроса и другие возможности, которых нет у конкурентов.' },
  { icon: Gift, title: 'Бесплатный демо-доступ', desc: '14 дней полного доступа ко всем функциям. Без привязки карты, без обязательств. Просто попробуйте.' },
];

const CHAT_CARDS = [
  { arrow: [User, ChefHat], icon: MessageCircle, title: 'Гость ↔ Официант', desc: 'Гость может написать официанту из приложения — уточнить заказ, сообщить о проблеме, попросить счёт. Официант отвечает мгновенно.', badge: 'Повышает лояльность на 40%' },
  { arrow: [Bike, ChefHat], icon: Package, title: 'Курьер ↔ Официант', desc: 'Курьер уточняет адрес, время или особые пожелания. Официант видит всё в своём приложении и мгновенно реагирует.', badge: 'Ускоряет доставку на 25%' },
  { arrow: [User, Bike], icon: MessageSquare, title: 'Гость ↔ Курьер', desc: 'Гость видит, где находится курьер, и может написать ему. Курьер отвечает — доставка становится быстрее и удобнее для всех.', badge: 'Снижает количество звонков на 60%' },
];

const FEATURES = [
  { icon: ShoppingCart, name: 'Управление заказами', desc: 'Принимайте заказы из зала, с доставки и самовывоза в одном окне.' },
  { icon: Package, name: 'Склад и техкарты', desc: 'Полный контроль остатков, автозаказ продуктов, калькуляция блюд.' },
  { icon: BarChart3, name: 'Финансы и отчёты', desc: 'Выручка, прибыль, средний чек — вся аналитика в реальном времени.' },
  { icon: Users, name: 'Персонал', desc: 'Управление сменами, учёт времени, чаевые, KPI и мотивация.' },
  { icon: Megaphone, name: 'Маркетинг', desc: 'Акции, скидки, программы лояльности, push-уведомления.' },
  { icon: Smartphone, name: 'Мобильные приложения', desc: 'Отдельные приложения для гостя, официанта, курьера и кухни.' },
  { icon: MessageCircle, name: 'Чаты и уведомления', desc: 'Встроенные чаты между гостем, официантом и курьером.' },
  { icon: Link2, name: 'Интеграции', desc: 'Эквайринг, фискализация, Telegram, соцсети — всё, что нужно.' },
];

const COMPARISON_ROWS = [
  { fn: 'Единая база данных и архитектура', fc: true, iiko: true, yuma: true, poster: true, rkeeper: '✗ — модульная' },
  { fn: 'Встроенные чаты гость-официант-курьер', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'Офлайн-режим работы', fc: true, iiko: 'Ограниченно', yuma: false, poster: 'Ограниченно', rkeeper: 'Ограниченно' },
  { fn: 'Геймификация персонала', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'Стоимость входа', fc: 'Доступная подписка', iiko: 'от 35 000 ₽/мес', yuma: 'от 25 000 ₽/мес', poster: 'от 15 000 ₽/мес', rkeeper: 'от 107 000 ₽' },
  { fn: 'Современный интерфейс', fc: true, iiko: 'Средний', yuma: true, poster: true, rkeeper: 'Устаревший' },
  { fn: 'Облачная версия', fc: true, iiko: true, yuma: true, poster: true, rkeeper: true },
  { fn: '100% функций без доплат', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
];

const APPS = [
  { id: 'guest', tag: 'Гость', icon: User, title: 'Гость', desc: 'Меню, заказ, оплата, чат с официантом и курьером, история заказов.', color: '#00b4d8' },
  { id: 'courier', tag: 'Курьер', icon: Bike, title: 'Курьер', desc: 'Приём заказов, навигатор, чат с гостем и официантом, статусы.', color: '#22c55e' },
  { id: 'waiter', tag: 'Официант', icon: ChefHat, title: 'Официант', desc: 'Приём заказов, отправка на кухню, чат, закрытие счёта, чаевые.', color: '#f0b429' },
  { id: 'kitchen', tag: 'Кухня', icon: Monitor, title: 'Кухня', desc: 'Экран заказов, статусы готовности, таймеры, сплит-система.', color: '#ef4444' },
  { id: 'website', tag: 'Веб-сайт', icon: Globe, title: 'Сайт', desc: 'Готовый сайт ресторана с меню, корзиной и онлайн-оплатой.', color: '#8b5cf6' },
  { id: 'kiosk', tag: 'Киоск', icon: Monitor, title: 'Киоск', desc: 'Терминал самообслуживания. Увеличивает средний чек на 20%.', color: '#ec4899' },
];

const TESTIMONIALS = [
  { text: 'Перешли на FoodChain с iiko — разница колоссальная. Интерфейс современный, всё интуитивно понятно. А встроенные чаты — это просто бомба.', name: 'Алексей Кузнецов', role: 'Владелец сети «La Maison», Казань', color: '#00b4d8' },
  { text: 'Раньше пользовались Poster — не хватало функционала для доставки. FoodChain решил все проблемы: и зал, и доставка, и склад в одной системе.', name: 'Мария Соколова', role: 'CEO «СушиМастер», Екатеринбург', color: '#f0b429' },
  { text: 'Оценили офлайн-режим — интернет иногда падает, но работа не останавливается. Геймификация реально мотивирует персонал. Лучшее решение.', name: 'Дмитрий Волков', role: 'Управляющий «Biergarten», Москва', color: '#22c55e' },
];

const PLANS = [
  {
    name: 'Базовый', price: '9 900', desc: 'Для небольших кафе и кофеен',
    features: ['Управление заказами', 'Склад и техкарты', 'Финансы и отчёты', 'Приложение официанта', 'До 3 кассовых мест', 'Техподдержка в чате'],
    popular: false,
  },
  {
    name: 'Бизнес', price: '19 900', desc: 'Для ресторанов и служб доставки',
    features: ['Всё из «Базового»', 'Встроенные чаты', 'Приложение гостя и курьера', 'Маркетинг и лояльность', 'Интеграции и эквайринг', 'До 10 кассовых мест', 'Поддержка 24/7'],
    popular: true,
  },
  {
    name: 'Корпоративный', price: '39 900', desc: 'Для сетей ресторанов и франшиз',
    features: ['Всё из «Бизнеса»', 'Безлимит кассовых мест', 'Централизованное управление', 'Выделенный сервер', 'Геймификация и 2FA', 'Персональный менеджер', 'Индивидуальная доработка'],
    popular: false,
  },
];

const FAQS = [
  { q: 'Что входит в тариф?', a: 'В каждый тариф входит полный набор функций, указанных в карточке. Никаких скрытых модулей и доплат.' },
  { q: 'Нужен ли сервер для установки?', a: 'Нет. FoodChain — полностью облачное решение. Вам нужен только ноутбук или планшет с доступом в интернет.' },
  { q: 'Можно ли перенести данные из другой системы (iiko, R-Keeper)?', a: 'Да. Мы предоставляем бесплатный перенос данных из любых популярных систем. Обычно миграция занимает 1-3 дня.' },
  { q: 'Есть ли техподдержка?', a: 'Да. На всех тарифах — поддержка в чате с ответом до 5 минут. На «Бизнесе» — круглосуточно 24/7. На «Корпоративном» — персональный менеджер.' },
  { q: 'Как работает демо-период?', a: 'Вы получаете 14 дней полного доступа ко всем функциям. Без привязки карты и без обязательств.' },
  { q: 'Можно ли подключить эквайринг и фискализацию?', a: 'Да. Поддерживаем Сбербанк, Тинькофф, ЮKassa, CloudPayments. Автоматическая фискализация по 54-ФЗ.' },
];

const APP_DETAILS: Record<string, { title: string; desc: string }> = {
  guest: { title: 'Приложение «Гость»', desc: 'Полноценное мобильное приложение для ваших гостей. Меню с фотографиями, корзина, онлайн-оплата, чат с официантом и курьером, история заказов, программа лояльности.' },
  courier: { title: 'Приложение «Курьер»', desc: 'Приём заказов с автоматическим назначением, оптимальный маршрут, чат с гостем и официантом, статусы доставки, история выплат.' },
  waiter: { title: 'Приложение «Официант»', desc: 'Принимайте заказы прямо за столиком через планшет. Отправляйте на кухню мгновенно, общайтесь через чат, принимайте оплату.' },
  kitchen: { title: 'Экран «Кухня»', desc: 'Все входящие заказы в реальном времени. Сплит-система по зонам, таймеры, цветовая индикация, статусы готовности.' },
  website: { title: 'Веб-сайт ресторана', desc: 'Готовый адаптивный сайт с меню, корзиной и онлайн-оплатой. Настраивается за 5 минут. Все заказы синхронизируются с системой.' },
  kiosk: { title: 'Терминал «Киоск»', desc: 'Самообслуживание для залов быстрого питания. Сокращает очереди, увеличивает средний чек на 20% за счёт кросс-продаж.' },
};

function Cell({ val }: { val: boolean | string }) {
  if (val === true) return <span className="text-emerald-400 font-bold text-lg">✓</span>;
  if (val === false) return <span className="text-red-400/60 text-lg">✗</span>;
  if (typeof val === 'string' && (val.startsWith('✗') || val.startsWith('от'))) return <span className="text-red-400/80 text-sm">{val}</span>;
  return <span className="text-amber-400/80 text-sm">{val}</span>;
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('opacity-100', 'translate-y-0'); el.classList.remove('opacity-0', 'translate-y-8'); }
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
  const [expFeat, setExpFeat] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const h = document.getElementById('header');
      if (h) h.classList.toggle('shadow-lg', window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const renderStars = () => {
    const arr = [];
    for (let i = 0; i < 5; i++) arr.push(<Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />);
    return arr;
  };

  return (
    <div className="min-h-screen bg-[#0a192f] text-slate-200 font-['Inter',sans-serif] overflow-x-hidden">
      {/* Header */}
      <header id="header" className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="font-bold text-xl text-white">Food<span className="text-cyan-400">Chain</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {['Возможности', 'Цены', 'О нас', 'Контакты'].map((label, i) => (
                <a key={label} href={['#features', '#pricing', '#about', '#contacts'][i]} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">{label}</a>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition">Вход</Link>
              <Link to="/register" className="bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all hover:-translate-y-0.5">Попробовать бесплатно</Link>
            </div>
            <button className="md:hidden p-2 text-white" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-[#0a192f]/98 backdrop-blur-xl border-t border-white/5 px-4 py-4 space-y-1">
            {['Возможности', 'Цены', 'О нас', 'Контакты'].map((label, i) => (
              <a key={label} href={['#features', '#pricing', '#about', '#contacts'][i]} onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5">{label}</a>
            ))}
            <hr className="my-2 border-white/10" />
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 rounded-xl">Вход</Link>
            <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm font-bold text-cyan-400 hover:bg-white/5 rounded-xl">Попробовать бесплатно</Link>
          </div>
        )}
      </header>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center overflow-hidden" id="hero">
        <div className="absolute inset-0">
          {HERO_SLIDES.map((src, i) => (
            <div key={i} className={`absolute inset-0 transition-opacity duration-1000 ${i === slide ? 'opacity-100' : 'opacity-0'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a192f]/95 via-[#0a192f]/70 to-[#0a192f]/40" />
        </div>
        {/* Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-cyan-400/30 rounded-full" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${15 + Math.random() * 20}s linear infinite`,
              animationDelay: `${Math.random() * 20}s`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
            }} />
          ))}
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
          <div className="max-w-3xl">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/10 text-cyan-400 text-sm font-semibold mb-6 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                Платформа №1 для управления рестораном
              </div>
            </Reveal>
            <Reveal delay={150}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight mb-6">
                Управляйте рестораном<br />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">нового поколения</span>
              </h1>
            </Reveal>
            <Reveal delay={300}>
              <p className="text-lg sm:text-xl text-slate-400 max-w-xl leading-relaxed mb-8">
                FoodChain — SaaS-платформа, которая объединяет зал, кухню, доставку, склад и финансы. 100% функций без скрытых платежей.
              </p>
            </Reveal>
            <Reveal delay={450}>
              <div className="flex flex-wrap gap-4 mb-12">
                <Link to="/register" className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all hover:-translate-y-1 text-base">
                  Начать 14-дневный бесплатный период
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a href="#compare" className="inline-flex items-center gap-2 border border-white/20 hover:border-cyan-400/50 text-white px-8 py-4 rounded-2xl transition-all hover:-translate-y-1 text-base font-semibold">
                  Сравнить с конкурентами
                  <ChevronRight className="w-5 h-5" />
                </a>
              </div>
            </Reveal>
            <Reveal delay={600}>
              <div className="flex flex-wrap gap-8">
                {[
                  { num: '100%', label: 'функций включено', color: 'text-cyan-400' },
                  { num: '17', label: 'уникальных фич', color: 'text-amber-400' },
                  { num: '0%', label: 'скрытых платежей', color: 'text-cyan-400' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`text-2xl font-black ${item.color}`}>{item.num}</span>
                    <span className="text-sm text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== WHY US ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="about">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">Почему FoodChain</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Мы создали <span className="text-cyan-400">лучшую систему</span> для ресторанов</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Всё, что нужно для управления заведением — в одной платформе. Без лишних интеграций и скрытых платежей.</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHY_CARDS.map((card, i) => (
            <Reveal key={card.title} delay={100 * i}>
              <div className="group bg-[#112240] rounded-2xl p-8 border border-white/5 hover:border-cyan-400/20 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-500/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-14 h-14 rounded-xl bg-cyan-400/10 flex items-center justify-center mb-5 text-cyan-400 text-2xl group-hover:bg-cyan-400 group-hover:text-white transition-all duration-500 group-hover:shadow-lg group-hover:shadow-cyan-500/30">
                  <card.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{card.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{card.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== CHATS ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a192f] to-[#112240]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">Уникальные чаты</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Единственная система, где <span className="text-cyan-400">все говорят друг с другом</span></h2>
              <p className="text-slate-400 max-w-2xl mx-auto">В FoodChain встроены чаты между гостем, официантом и курьером. Этого нет в iiko, YUMA, Poster и R-Keeper.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {CHAT_CARDS.map((card, i) => {
              const ArrowIcon1 = card.arrow[0];
              const ArrowIcon2 = card.arrow[1];
              return (
                <Reveal key={card.title} delay={100 * i}>
                  <div className="bg-[#1e2a4a] rounded-2xl p-8 border border-white/5 hover:border-cyan-400/15 transition-all duration-500 hover:-translate-y-1">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-9 h-9 rounded-full bg-cyan-400/10 flex items-center justify-center text-cyan-400"><ArrowIcon1 className="w-4 h-4" /></div>
                      <ChevronRight className="w-4 h-4 text-cyan-400/60" />
                      <div className="w-9 h-9 rounded-full bg-cyan-400/10 flex items-center justify-center text-cyan-400"><ArrowIcon2 className="w-4 h-4" /></div>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-cyan-400/10 flex items-center justify-center mb-5 text-cyan-400">
                      <card.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-3">{card.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{card.desc}</p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">{card.badge}</span>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={400}>
            <p className="text-center text-slate-500 text-sm mt-10 max-w-2xl mx-auto">
              Все чаты сохраняются в истории — никаких лишних звонков и SMS. FoodChain — единственная система, которая объединяет всех участников в едином информационном поле. Это <span className="text-white font-semibold">новый уровень сервиса</span>.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="features">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">Возможности</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Всё для управления <span className="text-cyan-400">рестораном</span></h2>
            <p className="text-slate-400 max-w-xl mx-auto">8 модулей, которые покрывают все потребности современного заведения. Нажмите, чтобы узнать подробнее.</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {FEATURES.map((feat, i) => (
            <Reveal key={feat.name} delay={50 * i}>
              <button onClick={() => setExpFeat(expFeat === i ? null : i)} className={`w-full text-left bg-[#112240] rounded-xl p-5 border transition-all duration-300 hover:-translate-y-1 ${expFeat === i ? 'border-cyan-400/30 bg-cyan-400/5' : 'border-white/5 hover:border-cyan-400/15'}`}>
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-3 transition-all duration-300 ${expFeat === i ? 'bg-cyan-400 text-white shadow-lg shadow-cyan-500/30' : 'bg-cyan-400/10 text-cyan-400'}`}>
                  <feat.icon className="w-5 h-5" />
                </div>
                <div className="font-semibold text-white text-sm mb-1">{feat.name}</div>
                {expFeat === i && <div className="text-slate-400 text-xs leading-relaxed mt-2">{feat.desc}</div>}
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#112240]" id="compare">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">Сравнение</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Сравните сами. Мы <span className="text-cyan-400">обгоняем конкурентов</span> по функциональности и цене</h2>
            </div>
          </Reveal>
          <Reveal>
            <div className="overflow-x-auto rounded-2xl border border-white/5">
              <table className="w-full min-w-[650px] text-sm">
                <thead>
                  <tr className="bg-[#1e2a4a]">
                    <th className="text-left p-4 font-bold text-white">Функция</th>
                    <th className="text-left p-4 font-bold text-cyan-400">✦ FoodChain</th>
                    <th className="text-left p-4 font-bold text-slate-300">iiko</th>
                    <th className="text-left p-4 font-bold text-slate-300">YUMA</th>
                    <th className="text-left p-4 font-bold text-slate-300">Poster</th>
                    <th className="text-left p-4 font-bold text-slate-300">R-Keeper</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-semibold text-white">{row.fn}</td>
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
            <p className="text-center text-slate-400 mt-6 text-sm">Мы обгоняем конкурентов по функциональности и цене. <Link to="/register" className="text-cyan-400 font-semibold hover:underline">Попробуйте сами →</Link></p>
          </Reveal>
        </div>
      </section>

      {/* ===== MOBILE APPS ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">Мобильные приложения</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">6 приложений — <span className="text-cyan-400">единая экосистема</span></h2>
            <p className="text-slate-400 max-w-xl mx-auto">Каждый участник вашего бизнеса получает своё приложение с нужным набором функций.</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {APPS.map((app, i) => (
            <Reveal key={app.id} delay={80 * i}>
              <button onClick={() => setModal(app.id)} className="w-full text-center bg-[#112240] rounded-2xl p-6 border border-white/5 hover:border-cyan-400/20 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl group relative">
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">{app.tag}</span>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 text-2xl transition-all duration-500 group-hover:shadow-lg" style={{ background: `${app.color}15`, color: app.color }}>
                  <app.icon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-white text-sm mb-2">{app.title}</h4>
                <p className="text-slate-500 text-xs leading-relaxed">{app.desc}</p>
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#112240] to-[#0a192f]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">Отзывы</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Нам доверяют <span className="text-cyan-400">владельцы ресторанов</span></h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={150 * i}>
                <div className="bg-[#1e2a4a] rounded-2xl p-8 border border-white/5 hover:border-cyan-400/10 transition-all">
                  <div className="flex gap-0.5 mb-4">{renderStars()}</div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-6 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: t.color }}>{t.name[0]}</div>
                    <div>
                      <div className="text-white font-semibold text-sm">{t.name}</div>
                      <div className="text-slate-500 text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="pricing">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">Тарифы</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Прозрачные цены <span className="text-cyan-400">без скрытых платежей</span></h2>
            <p className="text-slate-400 max-w-xl mx-auto">Все тарифы включают 14-дневный бесплатный период. Никаких комиссий за транзакции.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={150 * i}>
              <div className={`rounded-2xl p-8 border transition-all duration-500 ${plan.popular ? 'bg-gradient-to-b from-[#1e2a4a] to-[#112240] border-cyan-400/40 shadow-xl shadow-cyan-500/10 relative' : 'bg-[#112240] border-white/5 hover:border-cyan-400/20'}`}>
                {plan.popular && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-cyan-500 text-white text-xs font-bold rounded-full shadow-lg shadow-cyan-500/30">Самый популярный</div>}
                <div className="font-bold text-lg text-white mb-1">{plan.name}</div>
                <div className="text-slate-400 text-sm mb-5">{plan.desc}</div>
                <div className="mb-1"><span className="text-4xl font-black text-white">{plan.price}</span> <span className="text-slate-500 text-sm">₽/мес</span></div>
                <ul className="my-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${plan.popular ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50' : 'border border-white/20 hover:border-cyan-400/50 text-white hover:bg-white/5'}`}>
                  Выбрать тариф
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={500}>
          <p className="text-center text-slate-500 text-sm mt-8">Все тарифы включают 14-дневный бесплатный период. Без привязки карты и без обязательств.</p>
        </Reveal>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto" id="faq">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-4">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Часто задаваемые <span className="text-cyan-400">вопросы</span></h2>
          </div>
        </Reveal>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <Reveal key={i} delay={80 * i}>
              <div className={`bg-[#112240] rounded-xl border transition-all ${openFaq === i ? 'border-cyan-400/20' : 'border-white/5'}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="text-sm font-semibold text-white">{faq.q}</span>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ml-4 ${openFaq === i ? 'bg-cyan-500 text-white rotate-45' : 'bg-cyan-400/10 text-cyan-400'}`}>+</span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-60' : 'max-h-0'}`}>
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#0d1b2a] border-t border-white/5 py-16 px-4 sm:px-6 lg:px-8" id="contacts">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">F</span>
                </div>
                <span className="font-bold text-lg text-white">Food<span className="text-cyan-400">Chain</span></span>
              </Link>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">SaaS-платформа для управления рестораном нового поколения. Объединяем зал, кухню, доставку, склад и финансы.</p>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-4">Продукт</h4>
              <div className="space-y-3 text-sm">
                <a href="#features" className="block text-slate-500 hover:text-cyan-400 transition">Возможности</a>
                <a href="#pricing" className="block text-slate-500 hover:text-cyan-400 transition">Цены</a>
                <a href="#compare" className="block text-slate-500 hover:text-cyan-400 transition">Сравнение</a>
                <Link to="/apps" className="block text-slate-500 hover:text-cyan-400 transition">Приложения</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-4">Компания</h4>
              <div className="space-y-3 text-sm">
                <a href="#about" className="block text-slate-500 hover:text-cyan-400 transition">О нас</a>
                <Link to="/about" className="block text-slate-500 hover:text-cyan-400 transition">Контакты</Link>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition">Блог</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition">Партнёрам</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-4">Контакты</h4>
              <div className="space-y-3 text-sm">
                <a href="tel:+74951234567" className="block text-slate-500 hover:text-cyan-400 transition">+7 (495) 123-45-67</a>
                <a href="mailto:hello@foodchain.ru" className="block text-slate-500 hover:text-cyan-400 transition">hello@foodchain.ru</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition">Telegram-канал</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition">YouTube</a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <p>© 2026 FoodChain / MIRUZ. Все права защищены.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-cyan-400 transition">Политика конфиденциальности</a>
              <a href="#" className="hover:text-cyan-400 transition">Публичная оферта</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== MODAL ===== */}
      {modal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-[#1e2a4a] rounded-2xl max-w-lg w-full p-8 border border-white/10 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 transition"><X className="w-4 h-4" /></button>
            <h3 className="text-xl font-bold text-white mb-3">{APP_DETAILS[modal]?.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{APP_DETAILS[modal]?.desc}</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="aspect-[9/16] bg-white/5 rounded-xl flex items-center justify-center text-slate-600 text-xs border border-white/5">Скриншот 1</div>
              <div className="aspect-[9/16] bg-white/5 rounded-xl flex items-center justify-center text-slate-600 text-xs border border-white/5">Скриншот 2</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
