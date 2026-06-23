import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronRight, Star, X, Menu, ChevronUp, Play, Pause,
  Smartphone, Tablet, Monitor, ShoppingCart, Package, BarChart3,
  Users, Megaphone, MessageCircle, Globe, MessageSquare, Bike, User, ChefHat,
  Download, CreditCard, BarChart4, QrCode, Split, MapPin, Bell, Clock, Shield,
  BookOpen, DollarSign, FileText, Layers, Zap,
} from 'lucide-react';

/* ─── DATA ─── */
const HERO_SLIDES = [
  'https://images.unsplash.com/photo-1573855619003-97b4799dcd8b?w=1920&q=85',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1920&q=85',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&q=85',
  'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=1920&q=85',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=85',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1920&q=85',
];

const STAT_BLOCKS = [
  { num: '100%', label: 'функций', sub: 'покрытие всех процессов ресторана' },
  { num: '17', label: 'уникальных фич', sub: 'чат, AI, офлайн, 2FA, геймификация' },
  { num: '10+', label: 'приложений', sub: 'гость, официант, курьер, кухня, киоск, сайт' },
  { num: '14', label: 'дней демо', sub: 'бесплатный доступ без карты' },
];

const FEATURES = [
  { icon: ShoppingCart, title: 'Управление заказами', desc: 'Принимайте заказы из зала, с доставки и самовывоза в одном окне. Автоматическое распределение на кухню, печать чеков и контроль статусов.', img: 'https://images.unsplash.com/photo-1553729459-afe8f2e2a7c6?w=800&q=80' },
  { icon: Package, title: 'Склад и техкарты', desc: 'Полный контроль остатков, автозаказ продуктов, калькуляция блюд с расчётом себестоимости. Технологические карты с пошаговыми рецептами.', img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80' },
  { icon: BarChart3, title: 'Финансы и отчёты', desc: 'Выручка, прибыль, средний чек, фудкост, зарплата сотрудников — вся аналитика в реальном времени с экспортом в Excel и 1С.', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80' },
  { icon: Users, title: 'Управление персоналом', desc: 'График смен, учёт рабочего времени, чаевые, KPI, мотивация сотрудников. Каждый сотрудник видит свою статистику в приложении.', img: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80' },
  { icon: Megaphone, title: 'Маркетинг и акции', desc: 'Акции, скидки, программы лояльности, push-уведомления, e-mail и SMS рассылки. Персонализированные предложения для каждого гостя.', img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80' },
  { icon: MessageCircle, title: 'Встроенные чаты', desc: 'Гость ↔ официант, гость ↔ курьер, курьер ↔ официант. Реальное время без звонков. Все чаты сохраняются в истории.', img: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=800&q=80' },
  { icon: Bike, title: 'Управление доставкой', desc: 'Автоматическое назначение курьера, оптимальный маршрут по карте, чат с гостем, онлайн-отслеживание статуса доставки.', img: 'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=800&q=80' },
  { icon: BarChart4, title: 'Аналитика и прогноз', desc: 'ML-модель прогнозирует продажи и закупки на основе исторических данных. Меньше списаний, больше прибыли.', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80' },
  { icon: Globe, title: 'Интеграции и API', desc: 'Эквайринг, фискализация, Telegram, соцсети, сайт, Google Maps, 1С, агрегаторы доставки. Открытое API и SDK для любых доработок.', img: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80' },
  { icon: Shield, title: 'Безопасность и 2FA', desc: 'Двухфакторная аутентификация, аудит всех действий, логирование, резервное копирование. Ваши данные под надёжной защитой.', img: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&q=80' },
];

const APP_CATEGORIES = [
  { icon: Smartphone, title: 'Гость', desc: 'Меню, заказ, оплата, трекинг, история, программа лояльности, чаты', color: 'from-cyan-400 to-blue-500' },
  { icon: Tablet, title: 'Официант', desc: 'Схема зала, приём заказов, отправка на кухню, оплата, чаевые', color: 'from-emerald-400 to-green-500' },
  { icon: Smartphone, title: 'Курьер', desc: 'Заказы, навигатор, чат, статусы доставки, история выплат', color: 'from-amber-400 to-orange-500' },
  { icon: Monitor, title: 'Кухня (KDS)', desc: 'Экран заказов, таймеры, сплит по зонам, статусы готовности', color: 'from-red-400 to-rose-500' },
  { icon: Smartphone, title: 'Киоск', desc: 'Терминал самообслуживания для залов быстрого питания', color: 'from-violet-400 to-purple-500' },
  { icon: Globe, title: 'Веб-сайт', desc: 'Готовый сайт ресторана с меню, корзиной и онлайн-оплатой', color: 'from-cyan-400 to-teal-500' },
  { icon: Monitor, title: 'Бэк-офис', desc: 'Дашборды, управление, отчёты, настройки', color: 'from-indigo-400 to-blue-500' },
  { icon: Monitor, title: 'Портал', desc: 'Панель арендатора — платёжи, сотрудники, подписка', color: 'from-pink-400 to-rose-500' },
];

const GALLERY = [
  { cat: 'Гость', items: [
    'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80',
  ]},
  { cat: 'Официант', items: [
    'https://images.unsplash.com/photo-1573855619003-97b4799dcd8b?w=600&q=80',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  ]},
  { cat: 'Курьер', items: [
    'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=600&q=80',
    'https://images.unsplash.com/photo-1478144593103-5480c2f2e0e8?w=600&q=80',
    'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=600&q=80',
  ]},
  { cat: 'Кухня', items: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80',
    'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80',
  ]},
  { cat: 'Бэк-офис', items: [
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80',
    'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=600&q=80',
  ]},
  { cat: 'Киоск', items: [
    'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80',
  ]},
];

const VIDEOS = [
  { title: 'Обзор гостевого приложения', desc: 'Как гость делает заказ, оплачивает и общается с официантом', thumb: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80', duration: '1:45' },
  { title: 'Приложение официанта', desc: 'Приём заказов, отправка на кухню и приём оплаты', thumb: 'https://images.unsplash.com/photo-1573855619003-97b4799dcd8b?w=800&q=80', duration: '2:10' },
  { title: 'Бэк-офис и аналитика', desc: 'Дашборды, отчёты, управление меню и складом', thumb: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80', duration: '3:20' },
  { title: 'Видео-отзыв клиента', desc: 'Владелец сети ресторанов делится опытом работы', thumb: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80', duration: '1:30' },
];

const COMPARISON = [
  { fn: 'Единая база данных и архитектура', fc: true, iiko: true, yuma: true, poster: true, rkeeper: '✗' },
  { fn: 'Встроенные чаты гость-официант-курьер', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'Офлайн-режим работы', fc: true, iiko: 'Ограничен', yuma: false, poster: 'Ограничен', rkeeper: 'Ограничен' },
  { fn: 'Геймификация персонала', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'AI-прогнозирование спроса', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: '100% функций без доплат', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'Современный интерфейс', fc: true, iiko: 'Средний', yuma: true, poster: true, rkeeper: 'Устаревший' },
  { fn: 'Облачная версия', fc: true, iiko: true, yuma: true, poster: true, rkeeper: true },
  { fn: 'Мобильное приложение гостя', fc: true, iiko: 'Ограничен', yuma: false, poster: false, rkeeper: false },
  { fn: 'QR-самозаказ', fc: true, iiko: true, yuma: true, poster: true, rkeeper: false },
  { fn: 'Split bill (разделение счёта)', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: '2FA и аудит безопасности', fc: true, iiko: 'Ограничен', yuma: false, poster: false, rkeeper: false },
  { fn: 'SDK для разработчиков', fc: true, iiko: false, yuma: false, poster: false, rkeeper: false },
  { fn: 'Бесплатный демо-доступ 14 дней', fc: true, iiko: false, yuma: false, poster: true, rkeeper: false },
];

const TESTIMONIALS = [
  { text: 'Перешли на FoodChain с iiko — разница колоссальная. Интерфейс современный, интуитивно понятный. Встроенные чаты — это уровень, которого нет ни у кого из конкурентов. Гости в восторге, персоналу удобно.', name: 'Алексей Кузнецов', role: 'Владелец сети «La Maison», Казань', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80', rating: 5 },
  { text: 'Раньше пользовались Poster — не хватало функционала для доставки. FoodChain решил все проблемы: зал, доставка, склад в одной системе. Плюс техподдержка отвечает за 2 минуты.', name: 'Мария Соколова', role: 'CEO «СушиМастер», Екатеринбург', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80', rating: 5 },
  { text: 'Офлайн-режим спасает при сбоях интернета — ни одного простоя за полгода. Геймификация реально мотивирует персонал. AI-прогноз сократил списание продуктов на 30%.', name: 'Дмитрий Волков', role: 'Управляющий «Biergarten», Москва', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80', rating: 5 },
  { text: 'Внедрили во всех 12 ресторанах сети. Централизованное управление, единая аналитика, 2FA для безопасности — лучшее решение на рынке. Рекомендую всем сетевикам.', name: 'Екатерина Романова', role: 'CEO сети «Mangal House», СПб', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80', rating: 5 },
  { text: 'Ведём бизнес уже 3 года на FoodChain. Ни разу не пожалели. Система постоянно обновляется, добавляются новые функции. Отдельное спасибо за чаты — гости обожают.', name: 'Сергей Иванов', role: 'Владелец «Coffee House», Новосибирск', img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&q=80', rating: 5 },
  { text: 'Попробовали демо — подкупило. Перевели все 5 точек за неделю. Интеграция с агрегаторами и 1С работает идеально. AI-прогноз закупок — это маст-хэв.', name: 'Анна Козлова', role: 'CEO «Fresh Kitchen», Краснодар', img: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&q=80', rating: 5 },
  { text: 'Как региональная сеть из 8 ресторанов, мы перепробовали всё. FoodChain — единственная система, которая закрывает 100% наших задач. И поддержка на высоте.', name: 'Тимур Ахметов', role: 'CEO «Bashkiria Foods», Уфа', img: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&q=80', rating: 5 },
  { text: 'Понравилось, что не нужно ничего дополнительно покупать. Всё включено в тариф. За 2 года работы ни одного скрытого платежа. Честно и прозрачно.', name: 'Ольга Павлова', role: 'Управляющая «Траттория», Ростов-на-Дону', img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&q=80', rating: 5 },
];

const PLANS = [
  { name: 'Базовый', price: '9 900', oldPrice: '14 900', desc: 'Для небольших заведений', features: ['Управление заказами', 'Склад и техкарты', 'Финансы и отчёты', 'Приложение официанта', 'До 3 кассовых мест', 'Техподдержка в чате', '14 дней бесплатно'], popular: false },
  { name: 'Бизнес', price: '19 900', oldPrice: '29 900', desc: 'Для ресторанов и доставки', features: ['Всё из «Базового»', 'Встроенные чаты', 'Приложения гостя и курьера', 'Маркетинг и лояльность', 'Интеграции и эквайринг', 'До 10 кассовых мест', 'Поддержка 24/7', 'AI-прогнозирование'], popular: true },
  { name: 'Корпоративный', price: '39 900', oldPrice: '59 900', desc: 'Для сетей и франшиз', features: ['Всё из «Бизнеса»', 'Безлимит кассовых мест', 'Выделенный сервер/SLA', 'Геймификация и 2FA', 'Персональный менеджер', 'Индивидуальная доработка', 'Приоритетная поддержка', 'Централизованное управление'], popular: false },
];

const FAQS = [
  { q: 'Что входит в тариф?', a: 'Каждый тариф включает полный набор функций, указанных в карточке. Никаких скрытых модулей — всё, что вы видите, уже входит в стоимость. При необходимости можно добавить дополнительные кассовые места.' },
  { q: 'Нужен ли сервер для установки?', a: 'Нет. FoodChain — полностью облачное решение. Вам нужен только ноутбук или планшет с интернетом. Всё остальное — хостинг, безопасность, бэкапы — мы берём на себя.' },
  { q: 'Можно ли перенести данные из другой системы?', a: 'Да. Предоставляем бесплатный перенос из iiko, R-Keeper, Poster, YUMA, 1С и других систем. Переносим меню, склад, базу клиентов и историю заказов. Миграция занимает от 1 до 3 дней.' },
  { q: 'Сколько времени нужно на внедрение?', a: 'Базовая настройка занимает 1 день. Полное внедрение со всеми интеграциями — от 3 до 7 дней. Для сетей — до 2 недель. Мы сопровождаем на всех этапах.' },
  { q: 'Есть ли техподдержка?', a: 'На «Базовом» — чат с ответом до 5 минут в рабочее время (9:00–21:00). На «Бизнесе» — круглосуточная поддержка 24/7. На «Корпоративном» — персональный менеджер и выделенная линия.' },
  { q: 'Как работает демо-период?', a: '14 дней полного доступа ко всем функциям системы. Без привязки карты. Без обязательств. Если система не подойдёт — доступ просто отключается.' },
  { q: 'Можно ли подключить эквайринг и фискализацию?', a: 'Да. Поддерживаем Сбербанк, Тинькофф, ЮKassa, CloudPayments. Автоматическая фискализация по 54-ФЗ через облачную кассу. Работает из коробки.' },
  { q: 'Какие нужны кассовые аппараты?', a: 'Поддерживаем все популярные модели: Атол, Штрих-М, Эвотор, Дримкас. Работаем через облачную кассу или локально. Возможна аренда оборудования.' },
  { q: 'Есть ли интеграция с агрегаторами доставки?', a: 'Да. Интегрированы с Яндекс Еда, Delivery Club, Купер, Chibbis и другими. Заказы с агрегаторов попадают напрямую в систему и на кухонный экран.' },
  { q: 'Можно ли работать без интернета?', a: 'Да. Полноценный офлайн-режим: касса, заказы, приём платежей. При восстановлении соединения данные автоматически синхронизируются. Ни минуты простоя.' },
  { q: 'Какие отчёты доступны?', a: 'Более 50 встроенных отчётов: выручка, фудкост, средний чек, популярность блюд, прибыльность, зарплата, складские остатки. Экспорт в Excel, PDF, 1С.' },
  { q: 'Брендируется ли система под наш ресторан?', a: 'Да. Мобильные приложения, сайт, киоск, чаты — всё брендируется под ваш ресторан: логотип, цвета, название. Гости видят ваш бренд, а не FoodChain.' },
];

/* ─── HELPERS ─── */
function Cell({ val }: { val: boolean | string }) {
  if (val === true) return <span className="text-emerald-400 font-bold">✓</span>;
  if (val === false) return <span className="text-slate-600">✗</span>;
  if (typeof val === 'string' && val.startsWith('✗')) return <span className="text-slate-500 text-xs">✗</span>;
  return <span className="text-amber-400 text-xs">{val}</span>;
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
    }, { threshold: 0.05 });
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

/* ─── SECTION COMPONENTS ─── */
function SectionTitle({ badge, title, subtitle, className = '' }: { badge?: string; title: React.ReactNode; subtitle?: string; className?: string }) {
  return (
    <div className={`text-center mb-14 md:mb-16 ${className}`}>
      {badge && <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 mb-4 bg-cyan-500/10 px-4 py-1.5 rounded-full">{badge}</span>}
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="text-slate-400 text-sm md:text-base mt-4 max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
    </div>
  );
}

export function Home() {
  const [slide, setSlide] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expFeat, setExpFeat] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [galTab, setGalTab] = useState(0);
  const [galImg, setGalImg] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const [emailSub, setEmailSub] = useState('');

  /* Hero carousel */
  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  /* Scroll effects */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
      setShowBackTop(window.scrollY > 800);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const stars = Array.from({ length: 5 }, (_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white font-['Inter',sans-serif] overflow-x-hidden selection:bg-cyan-500/30 selection:text-white">

      {/* ━━━ HEADER ━━━ */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#0a1628]/90 backdrop-blur-2xl shadow-[0_1px_0_rgba(0,180,216,0.1)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all">
                <span className="text-white font-black text-base">F</span>
              </div>
              <span className="font-extrabold text-lg text-white tracking-tight">Food<span className="text-cyan-400">Chain</span></span>
            </Link>
            <nav className="hidden lg:flex items-center gap-0.5">
              {[
                { href: '/features', label: 'Возможности' },
                { href: '/apps', label: 'Приложения' },
                { href: '/pricing', label: 'Цены' },
                { href: '/about', label: 'О нас' },
                { href: '#blog', label: 'Блог' },
                { href: '#', label: 'Контакты' },
              ].map(item => (
                <Link key={item.href} to={item.href} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-cyan-400 hover:bg-white/[0.03] rounded-lg transition-all duration-200">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Вход</Link>
              <Link to="/register" className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all text-sm shadow-md">Попробовать бесплатно</Link>
            </div>
            <button className="md:hidden p-2 text-white hover:text-cyan-400 transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-[#0a1628]/98 backdrop-blur-2xl border-t border-cyan-500/10 px-4 py-4">
            {['/features', '/apps', '/pricing', '/about'].map((path, i) => (
              <Link key={path} to={path} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-cyan-400 transition-all">{[ 'Возможности', 'Приложения', 'Цены', 'О нас'][i]}</Link>
            ))}
            <hr className="my-2 border-slate-800" />
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-medium text-slate-300">Вход</Link>
            <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-bold text-center text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl mt-2">Попробовать бесплатно</Link>
          </div>
        )}
      </header>

      {/* ━━━ HERO ━━━ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628]/60 via-[#0a1628]/40 to-[#0a1628]/90 z-10" />
        {HERO_SLIDES.map((src, i) => (
          <div key={i} className={`absolute inset-0 transition-all duration-[1500ms] ${i === slide ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>
            <img src={src} alt="" className="w-full h-full object-cover" loading={i < 2 ? 'eager' : 'lazy'} />
          </div>
        ))}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center gap-2 pb-8">
          {HERO_SLIDES.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)} className={`w-2 h-2 rounded-full transition-all ${i === slide ? 'bg-cyan-400 w-6' : 'bg-white/30 hover:bg-white/50'}`} />
          ))}
        </div>
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 w-full">
          <div className="max-w-3xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 text-cyan-400 text-xs font-semibold rounded-full border border-cyan-500/20 mb-6 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                Полная экосистема для управления рестораном
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-[1.06] tracking-tight mb-5">
                FoodChain — полная экосистема<br />
                <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">для управления рестораном</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-lg sm:text-xl text-slate-400 max-w-xl leading-relaxed mb-8">
                15+ модулей для автоматизации всего бизнеса. 8 приложений для всех участников процесса. 
                Единая база данных, облачная инфраструктура, работа в реальном времени.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="flex flex-wrap gap-4">
                <Link to="/register" className="relative group">
                  <span className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-8 py-4 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all text-base shadow-md">
                    Начать 14-дневный демо-период
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
                <a href="#features" className="inline-flex items-center gap-2 border border-slate-600 hover:border-cyan-400/40 text-slate-300 px-8 py-4 rounded-xl transition-all text-base font-medium">
                  Смотреть возможности
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ━━━ STATS ━━━ */}
      <section className="py-16 bg-gradient-to-b from-[#0a1628] to-[#0d1a30]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STAT_BLOCKS.map((s, i) => (
              <Reveal key={s.label} delay={100 * i}>
                <div className="text-center p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm hover:border-cyan-400/20 transition-all duration-500 group">
                  <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-br from-cyan-300 to-blue-400 bg-clip-text text-transparent mb-2">{s.num}</div>
                  <div className="font-bold text-white text-sm mb-1">{s.label}</div>
                  <div className="text-xs text-slate-500">{s.sub}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ FEATURES ━━━ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0a1628]" id="features">
        <div className="max-w-7xl mx-auto">
          <SectionTitle
            badge="15+ модулей"
            title="Все возможности FoodChain в одном месте"
            subtitle="15+ модулей для автоматизации всего бизнеса — от заказа до аналитики."
          />
          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={60 * i}>
                <div className="group bg-gradient-to-b from-[#0d1a30]/80 to-[#0a1628] rounded-2xl border border-white/5 hover:border-cyan-400/20 overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/5 flex flex-col sm:flex-row">
                  <div className="sm:w-48 h-40 sm:h-auto overflow-hidden shrink-0">
                    <img src={f.img} alt={f.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                  </div>
                  <div className="p-5 flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                        <f.icon className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-white text-base">{f.title}</h3>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div className="text-center mt-10">
              <Link to="/features" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Смотреть все 15+ модулей <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ APPS ━━━ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a1628] to-[#0d1a30]" id="apps">
        <div className="max-w-7xl mx-auto">
          <SectionTitle
            badge="8 приложений"
            title="Все приложения экосистемы FoodChain"
            subtitle="8 приложений для всех участников процесса — от гостя до управляющего."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {APP_CATEGORIES.map((app, i) => {
              const Icon = app.icon;
              return (
                <Reveal key={app.title} delay={70 * i}>
                  <Link to="/apps" className="group relative bg-gradient-to-b from-[#0d1a30]/80 to-[#0a1628] rounded-2xl border border-white/5 hover:border-cyan-400/20 p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl block overflow-hidden">
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${app.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-lg mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold text-white text-sm mb-2">{app.title}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">{app.desc}</p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━ GALLERY ━━━ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0a1628]" id="screenshots">
        <div className="max-w-7xl mx-auto">
          <SectionTitle
            badge="50+ скриншотов"
            title="Посмотрите, как работает система"
            subtitle="Реальные скриншоты всех интерфейсов. 50+ изображений."
          />
          <Reveal>
            <div className="flex flex-wrap gap-2 mb-6 justify-center">
              {GALLERY.map((g, i) => (
                <button key={g.cat} onClick={() => { setGalTab(i); setGalImg(0); }} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${galTab === i ? 'bg-cyan-500/10 border-cyan-400/30 text-cyan-400' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
                  {g.cat}
                </button>
              ))}
            </div>
          </Reveal>
          <Reveal>
            <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-[#0d1a30] shadow-2xl">
              <div className="aspect-[16/9] bg-slate-800 relative">
                <img src={GALLERY[galTab].items[galImg]} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <button onClick={() => setGalImg(g => (g - 1 + GALLERY[galTab].items.length) % GALLERY[galTab].items.length)} className="p-2 hover:bg-white/5 rounded-lg transition text-slate-400"><ChevronRight className="w-5 h-5 rotate-180" /></button>
                <div className="flex gap-2">
                  {GALLERY[galTab].items.map((_, i) => (
                    <button key={i} onClick={() => setGalImg(i)} className={`w-2 h-2 rounded-full transition-all ${i === galImg ? 'bg-cyan-400 w-5' : 'bg-slate-600 hover:bg-slate-500'}`} />
                  ))}
                </div>
                <button onClick={() => setGalImg(g => (g + 1) % GALLERY[galTab].items.length)} className="p-2 hover:bg-white/5 rounded-lg transition text-slate-400"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          </Reveal>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
            {GALLERY.map((g, gi) => g.items.map((img, ii) => (
              <button key={`${gi}-${ii}`} onClick={() => { setGalTab(gi); setGalImg(ii); }} className={`rounded-lg overflow-hidden border-2 transition-all ${galTab === gi && galImg === ii ? 'border-cyan-400 ring-2 ring-cyan-400/30' : 'border-transparent opacity-50 hover:opacity-100'}`}>
                <img src={img} alt="" className="w-full h-14 object-cover" loading="lazy" />
              </button>
            )))}
          </div>
          <Reveal delay={200}>
            <div className="text-center mt-8">
              <Link to="/apps" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Все скриншоты и приложения <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ VIDEO ━━━ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a1628] to-[#0d1a30]" id="video">
        <div className="max-w-7xl mx-auto">
          <SectionTitle
            badge="5+ видео"
            title="Смотрите видео-демонстрации"
            subtitle="Короткие видео-обзоры всех приложений и функций системы."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VIDEOS.map((v, i) => (
              <Reveal key={v.title} delay={100 * i}>
                <div className="group relative rounded-2xl overflow-hidden border border-white/5 bg-[#0d1a30] cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:border-cyan-400/20 transition-all duration-500">
                  <div className="aspect-video bg-slate-800 relative overflow-hidden">
                    <img src={v.thumb} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-cyan-500/80 flex items-center justify-center group-hover:bg-cyan-500 group-hover:scale-110 transition-all duration-300 shadow-lg">
                        <Play className="w-6 h-6 text-white ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 text-xs text-white/70 bg-black/50 px-2 py-0.5 rounded">{v.duration}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-white text-sm mb-1">{v.title}</h3>
                    <p className="text-slate-400 text-xs">{v.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ COMPARISON ━━━ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0a1628]" id="compare">
        <div className="max-w-7xl mx-auto">
          <SectionTitle
            badge="Сравнение"
            title="Сравните с конкурентами"
            subtitle="Полная таблица сравнения FoodChain с iiko, YUMA, Poster и R-Keeper."
          />
          <Reveal>
            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#0d1a30]/50 shadow-[0_0_60px_rgba(0,0,0,0.2)]">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="text-left p-3 md:p-4 font-bold text-white text-xs uppercase tracking-[0.1em]">Функция</th>
                    <th className="text-left p-3 md:p-4 font-bold text-cyan-400 text-xs uppercase tracking-[0.1em]">✦ FoodChain</th>
                    <th className="text-left p-3 md:p-4 font-medium text-slate-500 text-xs uppercase">iiko</th>
                    <th className="text-left p-3 md:p-4 font-medium text-slate-500 text-xs uppercase">YUMA</th>
                    <th className="text-left p-3 md:p-4 font-medium text-slate-500 text-xs uppercase">Poster</th>
                    <th className="text-left p-3 md:p-4 font-medium text-slate-500 text-xs uppercase">R‑Keeper</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={i} className={`border-t border-white/5 transition-colors hover:bg-white/[0.02]`}>
                      <td className="p-3 md:p-4 font-medium text-white text-sm">{row.fn}</td>
                      <td className="p-3 md:p-4"><Cell val={row.fc} /></td>
                      <td className="p-3 md:p-4"><Cell val={row.iiko} /></td>
                      <td className="p-3 md:p-4"><Cell val={row.yuma} /></td>
                      <td className="p-3 md:p-4"><Cell val={row.poster} /></td>
                      <td className="p-3 md:p-4"><Cell val={row.rkeeper} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-center mt-8 text-slate-400 text-sm">
              FoodChain — <span className="text-white font-semibold">больше, чем конкуренты</span>.{' '}
              <Link to="/register" className="text-cyan-400 font-semibold hover:text-cyan-300 underline underline-offset-4">Попробуйте сами →</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ━━━ TESTIMONIALS ━━━ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a1628] to-[#0d1a30]" id="reviews">
        <div className="max-w-7xl mx-auto">
          <SectionTitle
            badge="Отзывы"
            title="Что говорят наши клиенты"
            subtitle="Реальные истории от владельцев и управляющих ресторанов."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={60 * i}>
                <div className="bg-gradient-to-b from-[#0d1a30]/80 to-[#0a1628] rounded-2xl border border-white/5 hover:border-cyan-400/10 p-6 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl">
                  <div className="flex gap-0.5 mb-3">{stars}</div>
                  <p className="text-slate-300 text-xs leading-relaxed mb-4">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                    <img src={t.img} alt={t.name} className="w-9 h-9 rounded-full object-cover" loading="lazy" />
                    <div>
                      <div className="font-semibold text-white text-xs">{t.name}</div>
                      <div className="text-slate-500 text-[10px]">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ PRICING ━━━ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0a1628]" id="pricing">
        <div className="max-w-7xl mx-auto">
          <SectionTitle
            badge="Тарифы"
            title="Выберите свой тариф"
            subtitle="Прозрачные цены без скрытых платежей. Все тарифы включают 14-дневный демо-период."
          />
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={150 * i}>
                <div className={`relative bg-gradient-to-b from-[#0d1a30]/80 to-[#0a1628] rounded-2xl border-2 p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl ${plan.popular ? 'border-cyan-400/50 shadow-lg shadow-cyan-500/10' : 'border-white/5 hover:border-cyan-400/20'}`}>
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold rounded-full shadow-lg shadow-cyan-500/30 whitespace-nowrap">
                      Самый популярный
                    </div>
                  )}
                  <div className="font-bold text-lg text-white mb-1">{plan.name}</div>
                  <div className="text-slate-400 text-sm mb-5">{plan.desc}</div>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white tracking-tight">{plan.price}</span>
                    <span className="text-slate-500 text-sm">₽/мес</span>
                    <span className="text-slate-600 text-sm line-through">{plan.oldPrice} ₽</span>
                  </div>
                  <ul className="my-6 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.popular ? 'text-cyan-400' : 'text-emerald-400'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:shadow-lg hover:shadow-cyan-500/30'
                      : 'border border-white/10 text-slate-300 hover:border-cyan-400/30 hover:text-white'
                  }`}>
                    Выбрать тариф
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div className="text-center mt-8">
              <Link to="/pricing" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium transition-colors text-sm">
                Детальное сравнение тарифов <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ━━━ FAQ ━━━ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a1628] to-[#0d1a30]">
        <div className="max-w-3xl mx-auto">
          <SectionTitle
            badge="FAQ"
            title="Часто задаваемые вопросы"
            subtitle="12 ответов на самые частые вопросы о FoodChain."
          />
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={50 * i}>
                <div className={`group bg-[#0d1a30]/60 border rounded-xl transition-all ${openFaq === i ? 'border-cyan-400/30 shadow-lg shadow-cyan-500/5' : 'border-white/5 hover:border-white/10'}`}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                    <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${openFaq === i ? 'bg-cyan-500 text-white' : 'bg-white/5 text-slate-500'}`}>
                      {openFaq === i ? '−' : '+'}
                    </span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-400 ease-in-out ${openFaq === i ? 'max-h-96' : 'max-h-0'}`}>
                    <div className="px-5 pb-5 pt-0">
                      <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ NEWSLETTER ━━━ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0a1628] border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">Подпишитесь на новости</h2>
            <p className="text-slate-400 text-sm mb-8">Будьте в курсе новых функций, обновлений и спецпредложений.</p>
            <form onSubmit={e => { e.preventDefault(); setEmailSub(''); }} className="flex gap-3 max-w-md mx-auto">
              <input type="email" value={emailSub} onChange={e => setEmailSub(e.target.value)} required placeholder="your@email.com" className="flex-1 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 transition-all" />
              <button type="submit" className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all text-sm shrink-0 shadow-md">
                Подписаться
              </button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="bg-[#070d18] border-t border-white/5 py-16 px-4 sm:px-6 lg:px-8" id="contacts">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-white font-black text-base">F</span>
                </div>
                <span className="font-extrabold text-lg text-white tracking-tight">Food<span className="text-cyan-400">Chain</span></span>
              </Link>
              <p className="text-slate-600 text-sm leading-relaxed max-w-xs">Полная SaaS-экосистема для управления рестораном. Объединяем зал, кухню, доставку, склад и финансы.</p>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs mb-5 uppercase tracking-[0.15em]">Продукт</h4>
              <div className="space-y-2.5">
                <Link to="/features" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Возможности</Link>
                <Link to="/apps" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Приложения</Link>
                <Link to="/pricing" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Цены</Link>
                <Link to="/integrations" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Интеграции</Link>
                <a href="#compare" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Сравнение</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs mb-5 uppercase tracking-[0.15em]">Компания</h4>
              <div className="space-y-2.5">
                <Link to="/about" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">О нас</Link>
                <Link to="/contact" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Контакты</Link>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Блог</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Партнёрам</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Карьера</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white text-xs mb-5 uppercase tracking-[0.15em]">Контакты</h4>
              <div className="space-y-2.5">
                <a href="tel:+74951234567" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">+7 (495) 123-45-67</a>
                <a href="mailto:hello@foodchain.ru" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">hello@foodchain.ru</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">Telegram</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">YouTube</a>
                <a href="#" className="block text-slate-500 hover:text-cyan-400 transition-colors text-sm">ВКонтакте</a>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 py-8 border-t border-white/5">
            <div>
              <h5 className="font-semibold text-white text-xs mb-3 uppercase tracking-[0.1em]">Возможности</h5>
              <div className="space-y-1.5">
                {['Управление заказами', 'Склад и техкарты', 'Финансы', 'Персонал', 'Маркетинг', 'Доставка', 'Аналитика', 'Интеграции'].map(l => (
                  <Link key={l} to="/features" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-white text-xs mb-3 uppercase tracking-[0.1em]">Приложения</h5>
              <div className="space-y-1.5">
                {['Гость', 'Официант', 'Курьер', 'Кухня (KDS)', 'Киоск', 'Веб-сайт', 'Бэк-офис', 'Портал'].map(l => (
                  <Link key={l} to="/apps" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-white text-xs mb-3 uppercase tracking-[0.1em]">Ресурсы</h5>
              <div className="space-y-1.5">
                <a href="#" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">База знаний</a>
                <a href="#" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">Видео-уроки</a>
                <a href="#" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">Кейсы клиентов</a>
                <a href="#" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">API документация</a>
                <a href="#" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">Помощь</a>
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-white text-xs mb-3 uppercase tracking-[0.1em]">Правовое</h5>
              <div className="space-y-1.5">
                <a href="#" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">Политика конфиденциальности</a>
                <a href="#" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">Публичная оферта</a>
                <a href="#" className="block text-slate-600 hover:text-slate-400 text-xs transition-colors">Согласие на обработку</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">© 2026 FoodChain / MIRUZ. Все права защищены.</p>
          </div>
        </div>
      </footer>

      {/* ━━━ BACK TO TOP ━━━ */}
      {showBackTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-8 right-8 z-50 w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-lg hover:shadow-cyan-500/40 hover:-translate-y-1 transition-all duration-300 shadow-md animate-[fadeIn_0.3s_ease]">
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
