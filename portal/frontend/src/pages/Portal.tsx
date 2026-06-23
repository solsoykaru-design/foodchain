import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Star, Check, ChevronRight, ChevronDown, ChevronUp,
  MessageCircle, Bike, Smartphone, ChefHat, ShoppingBag, Monitor,
  Zap, Shield, Wifi, Gift, DollarSign, Code, Phone, Clock,
  BarChart3, Target, QrCode, ScanLine, Headphones, Puzzle,
  Fingerprint, FileText, Globe, Menu, LayoutGrid, Store,
  Package, Users, Megaphone, CreditCard, Mail, X,
} from 'lucide-react';

const images = {
  hero1: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&h=900&fit=crop',
  hero2: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1600&h=900&fit=crop',
  hero3: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&h=900&fit=crop',
  hero4: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1600&h=900&fit=crop',
  chat1: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop',
  chat2: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=600&fit=crop',
  chat3: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=800&h=600&fit=crop',
  app1: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop',
  app2: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop',
  app3: 'https://images.unsplash.com/photo-1605637367405-6bf1d0f38897?w=800&h=600&fit=crop',
  app4: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=600&fit=crop',
  app5: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
  app6: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop',
};

const features17 = [
  { icon: MessageCircle, title: 'Встроенные чаты', desc: 'Гость-официант, гость-курьер, курьер-официант — общение в реальном времени без звонков.' },
  { icon: Gift, title: 'Геймификация', desc: 'Колесо удачи, викторины, челленджи для повышения вовлечённости гостей.' },
  { icon: DollarSign, title: 'Мультивалютность', desc: 'Поддержка нескольких валют для международных сетей.' },
  { icon: Code, title: 'SDK для разработчиков', desc: 'Создавайте свои плагины и расширения на базе нашего API.' },
  { icon: Headphones, title: 'Оператор колл-центра', desc: 'Интерфейс для приёма заказов по телефону.' },
  { icon: Wifi, title: 'Полный офлайн-режим', desc: 'Работа без интернета с автосинхронизацией при восстановлении связи.' },
  { icon: BarChart3, title: 'Прогнозирование спроса (AI)', desc: 'ML-модель для прогноза продаж и оптимизации закупок.' },
  { icon: ChefHat, title: 'Sous Chef (умная очередь)', desc: 'Приоритизация заказов на кухне по времени и сложности.' },
  { icon: CreditCard, title: 'Разделение счёта (split bill)', desc: 'Деление чека между гостями за 2 клика.' },
  { icon: QrCode, title: 'QR-самозаказ', desc: 'Гость сканирует QR и делает заказ самостоятельно.' },
  { icon: ScanLine, title: 'Экран раздачи (FOH display)', desc: 'Отображение готовых блюд для выдачи гостям.' },
  { icon: Shield, title: 'Честный знак (маркировка)', desc: 'Учёт маркированных товаров: вода, молочка, табак.' },
  { icon: Phone, title: 'IP-телефония', desc: 'Интеграция с АТС для приёма звонков.' },
  { icon: Puzzle, title: 'Магазин приложений (Extensions)', desc: 'Подключайте сторонние расширения из нашего маркетплейса.' },
  { icon: Fingerprint, title: '2FA (двухфакторная аутентификация)', desc: 'Защита аккаунтов администраторов.' },
  { icon: FileText, title: 'Аудит действий (Audit log)', desc: 'Логирование всех действий пользователей.' },
  { icon: Globe, title: 'PWA (Progressive Web App)', desc: 'Сайт работает как приложение на телефоне гостя.' },
];

const modules = [
  { icon: ShoppingBag, title: 'Управление заказами', desc: 'Единое окно для всех каналов — приложение, сайт, Telegram, агрегаторы.' },
  { icon: Package, title: 'Склад и техкарты', desc: 'Автоматический расчёт ингредиентов, контроль остатков, инвентаризация.' },
  { icon: BarChart3, title: 'Финансы и отчёты', desc: 'Выручка, фудкост, маржинальный анализ, дашборды в реальном времени.' },
  { icon: Users, title: 'Персонал', desc: 'Графики, KPI, расчёт зарплаты, чаевые, push-уведомления.' },
  { icon: Megaphone, title: 'Маркетинг', desc: 'Акции, промокоды, программа лояльности, A/B тесты.' },
  { icon: Smartphone, title: 'Мобильные приложения', desc: 'Брендированные приложения для гостя, курьера, официанта, кухни.' },
  { icon: MessageCircle, title: 'Чаты и уведомления', desc: 'Встроенные чаты гость-официант-курьер, push и email-рассылки.' },
  { icon: Globe, title: 'Интеграции', desc: 'Яндекс.Еда, Delivery Club, 1С, платёжные системы, Telegram.' },
];

const comparisonData = [
  { feature: 'Единая архитектура', fc: true, iiko: true, yuma: true, poster: true, rk: false },
  { feature: 'Встроенные чаты', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Офлайн-режим', fc: true, iiko: false, yuma: 'Частично', poster: false, rk: false },
  { feature: 'Геймификация', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Современный интерфейс', fc: true, iiko: true, yuma: true, poster: true, rk: false },
  { feature: 'Облачная версия', fc: true, iiko: true, yuma: true, poster: true, rk: true },
  { feature: 'Мобильное приложение гостя', fc: true, iiko: true, yuma: false, poster: false, rk: false },
  { feature: 'Приложение курьера', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'AI-прогнозы', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'QR-самозаказ', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Split bill', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: '2FA', fc: true, iiko: true, yuma: false, poster: false, rk: true },
  { feature: '100% функций без доплат', fc: true, iiko: false, yuma: false, poster: false, rk: false },
];

const plans = [
  {
    name: 'Базовый', price: '9 900 ₽', subtitle: 'Для небольших заведений',
    features: ['До 500 заказов/мес', 'До 5 сотрудников', '1 филиал', 'Управление меню', 'Базовые отчёты', 'Email-поддержка'],
  },
  {
    name: 'Бизнес', price: '19 900 ₽', subtitle: 'Для растущего бизнеса', popular: true,
    features: ['До 2 000 заказов/мес', 'До 20 сотрудников', 'До 3 филиалов', 'Все модули', 'Интеграции', 'Приоритетная поддержка'],
  },
  {
    name: 'Корпоративный', price: '39 900 ₽', subtitle: 'Для сетей ресторанов',
    features: ['Безлимит заказов', 'Безлимит сотрудников', 'Безлимит филиалов', 'AI-прогнозы', 'White Label', 'Персональный менеджер 24/7'],
  },
];

const faqs = [
  { q: 'Что входит в тариф?', a: 'Каждый тариф включает полный доступ ко всем модулям платформы. Разница только в лимитах на заказы, сотрудников и филиалы. Все функции доступны без ограничений.' },
  { q: 'Нужен ли сервер для установки?', a: 'Нет. FoodChain — облачная платформа. Вам нужен только компьютер или планшет с браузером и доступом в интернет. Мы берём на себя хостинг, безопасность и резервное копирование.' },
  { q: 'Можно ли перенести данные из другой системы?', a: 'Да. Мы поддерживаем импорт данных из iiko, R-Keeper, Poster, YUMA и Excel. Наши специалисты помогут с миграцией бесплатно.' },
  { q: 'Есть ли техподдержка?', a: 'Да. На всех тарифах — поддержка по email. На тарифе «Бизнес» — приоритетная поддержка. На «Корпоративном» — персональный менеджер 24/7.' },
  { q: 'Как работает демо-период?', a: 'Вы получаете 14 дней полного доступа к платформе на тарифе «Бизнес». Никакой привязки карты. Через 14 дней вы можете выбрать тариф или продолжить бесплатно с базовым функционалом.' },
  { q: 'Можно ли подключить эквайринг и фискализацию?', a: 'Да. Мы интегрированы с ведущими платёжными провайдерами и поддерживаем фискальные регистраторы Атол, Штрих-М, Viki Print и другие.' },
];

const testimonials = [
  { text: 'Перешли на FoodChain 6 месяцев назад. За это время средний чек вырос на 23%, а количество ошибок в заказах упало до нуля. Отдельное спасибо за чаты — гости в восторге.', name: 'Алексей Константинов', role: 'Владелец сети кофеен CoffeeLab', rating: 5, img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
  { text: 'Раньше работали на R-Keeper — постоянные проблемы с обновлениями и скрытые платежи. FoodChain дал нам предсказуемость и реальную экономию. Рекомендую.', name: 'Екатерина Морозова', role: 'Управляющая рестораном «Терраса»', rating: 5, img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face' },
  { text: 'Запустили доставку за 3 дня. Интеграция с Яндекс.Едой настроилась за час. Приложение курьера — отдельная любовь. Гости видят где курьер, курьер видит маршрут.', name: 'Дмитрий Соколов', role: 'CEO сети Grab&Go', rating: 5, img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face' },
];

const stats = [
  { icon: Zap, value: '17', label: 'Уникальных фич' },
  { icon: Check, value: '100%', label: 'Функций без доплат' },
  { icon: Shield, value: '99.9%', label: 'Uptime' },
  { icon: Users, value: '500+', label: 'Ресторанов' },
];

function useScrollReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('opacity-100', 'translate-y-0'); e.target.classList.remove('opacity-0', 'translate-y-8'); } }); },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

export function Portal() {
  useScrollReveal();
  const [heroIdx, setHeroIdx] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openModule, setOpenModule] = useState<number | null>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const heroBg = [images.hero1, images.hero2, images.hero3, images.hero4];

  useEffect(() => {
    const t = setInterval(() => setHeroIdx(p => (p + 1) % heroBg.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTestimonialIdx(p => (p + 1) % testimonials.length), 6000);
    return () => clearInterval(t);
  }, []);

  const ComparisonIcon = ({ val }: { val: boolean | string }) => {
    if (val === true) return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20"><Check className="h-3.5 w-3.5 text-emerald-400" /></span>;
    if (val === false) return <span className="text-slate-600 text-sm">—</span>;
    return <span className="text-slate-400 text-xs">{val}</span>;
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white font-['Inter',sans-serif] overflow-x-hidden selection:bg-cyan-500/30">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a1628]/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-xl transition">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="font-bold text-xl text-white">Food<span className="text-cyan-400">Chain</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {['features', 'pricing', 'about', 'contact'].map(p => (
                <Link key={p} to={`/${p}`} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition">{p === 'features' ? 'Возможности' : p === 'pricing' ? 'Цены' : p === 'about' ? 'О нас' : 'Контакты'}</Link>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition">Войти</Link>
              <Link to="/register" className="bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition hover:-translate-y-0.5">Попробовать бесплатно</Link>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative h-screen min-h-[600px] flex items-center">
        {heroBg.map((src, i) => (
          <div key={i} className={`absolute inset-0 transition-opacity duration-1000 ${i === heroIdx ? 'opacity-100' : 'opacity-0'}`}>
            <img src={src} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628]/95 via-[#0a1628]/80 to-[#0a1628]/60" />
          </div>
        ))}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-3xl">
            <div className="reveal opacity-0 translate-y-8 transition-all duration-700">
              <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-4 py-1.5 text-xs font-semibold text-cyan-400 backdrop-blur-sm mb-6">
                <Zap className="h-3.5 w-3.5" /> SaaS-платформа №1 для ресторанов
              </span>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
                Управляйте рестораном <br />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">нового поколения</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl leading-relaxed">
                FoodChain — SaaS-платформа, которая объединяет зал, кухню, доставку, склад и финансы. 100% функций без скрытых платежей.
              </p>
            </div>
            <div className="mt-10 reveal opacity-0 translate-y-8 transition-all duration-700 delay-200">
              <div className="flex flex-wrap gap-4">
                <Link to="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 rounded-xl text-sm font-bold text-white shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:scale-105">
                  Начать 14-дневный бесплатный период <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#features" className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-8 py-4 rounded-xl text-sm font-semibold text-white/80 backdrop-blur-sm hover:bg-white/10 transition">
                  Смотреть возможности
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-400">
                {stats.map(s => <span key={s.label} className="flex items-center gap-2"><s.icon className="h-4 w-4 text-cyan-400" /> {s.value} {s.label}</span>)}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {heroBg.map((_, i) => <button key={i} onClick={() => setHeroIdx(i)} className={`h-1.5 rounded-full transition-all ${i === heroIdx ? 'w-8 bg-cyan-400' : 'w-1.5 bg-white/30'}`} />)}
        </div>
      </section>

      {/* WHY US */}
      <section className="relative px-4 py-24 sm:py-32 border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,180,216,0.05),transparent_50%)]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Почему FoodChain?</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">Мы создали платформу, которая решает реальные проблемы рестораторов</p>
          </div>
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: LayoutGrid, title: 'Единая экосистема', desc: 'Одно приложение для зала, кухни, доставки, склада и финансов. Всё в одном окне.' },
              { icon: Check, title: '100% функций без доплат', desc: 'Все модули включены в подписку. Никаких скрытых платежей и дополнительных лицензий.' },
              { icon: Zap, title: '17 уникальных фич', desc: 'Чаты, геймификация, офлайн-режим, 2FA, AI-прогнозы и другие. Их нет у конкурентов.' },
              { icon: Clock, title: 'Бесплатный демо-доступ', desc: '14 дней полного доступа. Без привязки карты. Без обязательств.' },
            ].map((item, i) => (
              <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group rounded-2xl border border-white/5 bg-white/[0.03] p-8 hover:border-cyan-500/30 hover:bg-white/[0.05] hover:-translate-y-1 transition-all">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 group-hover:from-cyan-500 group-hover:to-blue-600 group-hover:text-white transition-all">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 17 FEATURES */}
      <section className="px-4 py-24 sm:py-32 border-t border-white/5" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">17 функций, которых нет у конкурентов</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-3xl mx-auto">
              FoodChain — единственная система, которая даёт вам эти преимущества из коробки. Никто из конкурентов не предлагает их в базовой версии.
            </p>
          </div>
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {features17.map((f, i) => (
              <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group flex gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:border-cyan-500/20 hover:bg-white/[0.04] transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-8 py-5">
              <Zap className="h-5 w-5 text-cyan-400" />
              <p className="text-sm text-slate-300">Эти 17 функций — ваш ключ к повышению эффективности, безопасности и лояльности клиентов. Их нет у конкурентов — и это ваше главное преимущество.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CHATS */}
      <section className="px-4 py-24 sm:py-32 border-t border-white/5 bg-gradient-to-b from-[#0a1628] via-[#0d1f35] to-[#0a1628]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-4 py-1.5 text-xs font-semibold text-cyan-400 backdrop-blur-sm mb-6">
              <MessageCircle className="h-3.5 w-3.5" /> Уникальное преимущество
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Единственная система, где все говорят друг с другом</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-3xl mx-auto">
              В FoodChain встроены чаты между гостем, официантом и курьером. Ваши сотрудники и клиенты всегда на связи — в реальном времени, без звонков и лишних действий. Этого нет в iiko, YUMA, Poster и R-Keeper.
            </p>
          </div>
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {[
              { img: images.chat1, icon: MessageCircle, title: 'Гость ↔ Официант', desc: 'Гость может написать официанту из приложения — уточнить заказ, сообщить о проблеме, попросить счёт. Официант отвечает мгновенно.' },
              { img: images.chat2, icon: Bike, title: 'Курьер ↔ Официант', desc: 'Курьер уточняет адрес, время или особые пожелания. Официант видит всё в своём приложении и координирует выдачу.' },
              { img: images.chat3, icon: Smartphone, title: 'Гость ↔ Курьер', desc: 'Гость видит, где находится курьер, и может написать ему. Курьер отвечает — доставка становится быстрее и удобнее.' },
            ].map((chat, i) => (
              <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden hover:border-cyan-500/30 transition-all">
                <div className="h-40 overflow-hidden">
                  <img src={chat.img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400"><chat.icon className="h-5 w-5" /></div>
                    <h3 className="text-base font-semibold text-white">{chat.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{chat.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-8 py-5">
              <MessageCircle className="h-5 w-5 text-cyan-400" />
              <p className="text-sm text-slate-300">FoodChain — единственная система, которая объединяет всех участников в едином информационном поле. Это не просто функция — это новый уровень сервиса.</p>
            </div>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section className="px-4 py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Все возможности в одной платформе</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">8 модулей, которые покрывают все процессы ресторана</p>
          </div>
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((m, i) => {
              const isOpen = openModule === i;
              return (
                <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700">
                  <button onClick={() => setOpenModule(isOpen ? null : i)} className={`w-full text-left rounded-xl border p-5 transition-all ${isOpen ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'}`}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400">
                      <m.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-white">{m.title}</h3>
                    <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 mt-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="px-4 py-24 sm:py-32 border-t border-white/5 bg-gradient-to-b from-[#0a1628] via-[#0d1f35] to-[#0a1628]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Сравните сами</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-3xl mx-auto">Мы обгоняем конкурентов по функциональности и цене</p>
          </div>
          <div className="mt-12 overflow-x-auto reveal opacity-0 translate-y-8 transition-all duration-700">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Функция</th>
                  <th className="px-4 py-4 text-center text-xs font-bold text-cyan-400 uppercase tracking-wider bg-cyan-500/10 rounded-t-xl">FoodChain</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">iiko</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">YUMA</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Poster</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">R-Keeper</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                    <td className="px-4 py-4 text-sm text-white">{row.feature}</td>
                    {(['fc', 'iiko', 'yuma', 'poster', 'rk'] as const).map(key => (
                      <td key={key} className={`px-4 py-4 text-center ${key === 'fc' ? 'bg-cyan-500/5' : ''}`}>
                        <ComparisonIcon val={row[key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-10 text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-8 py-5">
              <Target className="h-5 w-5 text-cyan-400" />
              <p className="text-sm text-slate-300">Мы обгоняем конкурентов по функциональности и цене. <Link to="/register" className="text-cyan-400 hover:text-cyan-300 underline">Попробуйте сами</Link></p>
            </div>
          </div>
        </div>
      </section>

      {/* APPS */}
      <section className="px-4 py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Мобильные приложения</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">6 приложений, которые полностью покрывают все процессы ресторана</p>
          </div>
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ShoppingBag, title: 'Гостевое приложение', desc: 'Меню, заказ, оплата и отслеживание доставки. Полностью под ваш бренд.', img: images.app1 },
              { icon: Smartphone, title: 'Приложение курьера', desc: 'Маршруты, геолокация, статусы заказов. Работает на любом смартфоне.', img: images.app3 },
              { icon: Monitor, title: 'Приложение официанта', desc: 'Схема зала, приём заказов, отправка на кухню и оплата с планшета.', img: images.app2 },
              { icon: ChefHat, title: 'Экран кухни (KDS)', desc: 'Очередь заказов с таймерами, автосписание ингредиентов, звуковые оповещения.', img: images.app4 },
              { icon: BarChart3, title: 'Бэк-офис', desc: 'Дашборд, управление меню, склад, финансы и персонал в одном окне.', img: images.app5 },
              { icon: QrCode, title: 'Киоск самообслуживания', desc: 'Сенсорный терминал для самостоятельного заказа в зале.', img: images.app6 },
            ].map((app, i) => (
              <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden hover:border-cyan-500/30 hover:-translate-y-1 transition-all">
                <div className="h-44 overflow-hidden">
                  <img src={app.img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400"><app.icon className="h-5 w-5" /></div>
                    <h3 className="text-base font-semibold text-white">{app.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{app.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-4 py-24 sm:py-32 border-t border-white/5 bg-gradient-to-b from-[#0a1628] via-[#0d1f35] to-[#0a1628]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Отзывы клиентов</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">Реальные результаты от реальных пользователей FoodChain</p>
          </div>
          <div className="mt-16 max-w-3xl mx-auto relative" ref={testimonialsRef}>
            <div className="overflow-hidden">
              <div className="transition-all duration-500">
                {testimonials.map((t, i) => (
                  <div key={i} className={`transition-all duration-500 ${i === testimonialIdx ? 'block' : 'hidden'}`}>
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 sm:p-10 text-center">
                      <div className="flex justify-center gap-1 mb-6">
                        {Array.from({ length: t.rating }, (_, j) => <Star key={j} className="h-5 w-5 fill-amber-400 text-amber-400" />)}
                      </div>
                      <p className="text-lg sm:text-xl text-slate-200 leading-relaxed italic">«{t.text}»</p>
                      <div className="mt-8 flex items-center justify-center gap-4">
                        <img src={t.img} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-cyan-500/30" />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-white">{t.name}</p>
                          <p className="text-xs text-slate-500">{t.role}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button key={i} onClick={() => setTestimonialIdx(i)} className={`h-1.5 rounded-full transition-all ${i === testimonialIdx ? 'w-8 bg-cyan-400' : 'w-1.5 bg-white/20'}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="px-4 py-24 sm:py-32 border-t border-white/5" id="pricing">
        <div className="max-w-7xl mx-auto">
          <div className="text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Выберите ваш тариф</h2>
            <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">Все тарифы включают 14-дневный бесплатный период. Без привязки карты.</p>
          </div>
          <div className="mt-16 grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <div key={i} className={`reveal opacity-0 translate-y-8 transition-all duration-700 relative flex flex-col rounded-2xl border p-8 ${plan.popular ? 'border-cyan-500/40 bg-gradient-to-b from-[#0f2035] to-[#0a1628] shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/20 scale-105' : 'border-white/5 bg-white/[0.03] hover:border-white/10'}`}>
                {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1 text-xs font-bold text-white shadow-lg">Самый популярный</span>}
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.subtitle}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm text-slate-500">/мес</span>
                </div>
                <ul className="mt-8 flex-1 space-y-3.5">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-slate-400">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className={`mt-8 block w-full rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all ${plan.popular ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]' : 'border border-white/10 bg-white/5 text-white/80 hover:bg-white/10'}`}>
                  Выбрать тариф
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-24 sm:py-32 border-t border-white/5 bg-gradient-to-b from-[#0a1628] via-[#0d1f35] to-[#0a1628]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Часто задаваемые вопросы</h2>
          </div>
          <div className="mt-12 space-y-3 reveal opacity-0 translate-y-8 transition-all duration-700">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className={`rounded-xl border transition-all ${isOpen ? 'border-cyan-500/30 bg-white/[0.03]' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}>
                  <button onClick={() => setOpenFaq(isOpen ? null : i)} className="flex w-full items-center justify-between px-6 py-5 text-left">
                    <span className="text-sm font-medium text-white">{faq.q}</span>
                    {isOpen ? <ChevronUp className="h-5 w-5 shrink-0 text-cyan-400" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />}
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-48' : 'max-h-0'}`}>
                    <div className="border-t border-white/5 px-6 pb-5 pt-3">
                      <p className="text-sm leading-relaxed text-slate-400">{faq.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-4 py-24 sm:py-32 border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,180,216,0.08),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto text-center reveal opacity-0 translate-y-8 transition-all duration-700">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Начните бесплатно уже сегодня</h2>
          <p className="mt-4 text-lg text-slate-400">14 дней полного доступа. Без привязки карты. Без обязательств.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 rounded-xl text-sm font-bold text-white shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:scale-105">
              Начать бесплатно <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/contact" className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-8 py-4 rounded-xl text-sm font-semibold text-white/80 backdrop-blur-sm hover:bg-white/10 transition">
              Связаться с нами
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0a1628] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-16">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-cyan-500/20">
                  <span className="text-white font-bold text-sm">F</span>
                </div>
                <span className="font-bold text-white text-lg">Food<span className="text-cyan-400">Chain</span></span>
              </div>
              <p className="text-sm leading-relaxed text-slate-500 max-w-xs">Полный комплект инструментов для автоматизации ресторанного бизнеса.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Продукт</h4>
              <div className="space-y-3 text-sm">
                <Link to="/features" className="block text-slate-500 hover:text-cyan-400 transition">Возможности</Link>
                <Link to="/pricing" className="block text-slate-500 hover:text-cyan-400 transition">Цены</Link>
                <Link to="/apps" className="block text-slate-500 hover:text-cyan-400 transition">Приложения</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Компания</h4>
              <div className="space-y-3 text-sm">
                <Link to="/about" className="block text-slate-500 hover:text-cyan-400 transition">О нас</Link>
                <Link to="/blog" className="block text-slate-500 hover:text-cyan-400 transition">Блог</Link>
                <Link to="/contact" className="block text-slate-500 hover:text-cyan-400 transition">Контакты</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Контакты</h4>
              <div className="space-y-3 text-sm">
                <a href="mailto:support@foodchain.ru" className="flex items-center gap-2 text-slate-500 hover:text-cyan-400 transition"><Mail className="h-3.5 w-3.5" /> support@foodchain.ru</a>
                <a href="tel:88001234567" className="flex items-center gap-2 text-slate-500 hover:text-cyan-400 transition"><Phone className="h-3.5 w-3.5" /> 8 (800) 123-45-67</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">© 2026 FoodChain / MIRUZ. Все права защищены.</p>
            <div className="flex gap-4 text-xs text-slate-600">
              <a href="#" className="hover:text-cyan-400 transition">Политика конфиденциальности</a>
              <a href="#" className="hover:text-cyan-400 transition">Условия использования</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
