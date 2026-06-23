import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronDown, ChevronUp,
  MessageCircle, Bike, Smartphone, ChefHat, ShoppingBag, Monitor,
  Zap, Shield, Wifi, Gift, DollarSign, Code, Phone, Clock,
  BarChart3, Target, QrCode, ScanLine, Headphones, Puzzle,
  Fingerprint, FileText, Globe, LayoutGrid,
  Package, Users, Megaphone, CreditCard, Mail,
  Star, PhoneCall, Settings, TrendingUp,
  MapPin, Truck, BarChart2,
  UserCheck, PieChart, Activity,
  Warehouse, Menu as MenuIcon, Users as UsersIcon, Banknote,
  Building2, Coffee, UtensilsCrossed, Pizza,
  ChefHat as ChefHatIcon, Store, ClipboardList, CheckCircle2,
} from 'lucide-react';

/* ─── ANIMATED TEXT ─── */

const venueTypes = ['Рестораны', 'Кафе', 'Доставка', 'Бары', 'Пекарни', 'Фудтраки'];

/* ─── MOCK IMAGES (placeholder product screenshots) ─── */

function TerminalMock() {
  return (
    <div className="relative">
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
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="relative">
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
    </div>
  );
}

function WaiterAppMock() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-[320px]">
      <div className="bg-green-600 px-4 py-3 text-white">
        <p className="text-xs font-bold">Зал «Основной»</p>
        <p className="text-[10px] opacity-80">12 столов • 2 официанта</p>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`rounded-lg border p-2 text-center ${
              [1,3,5].includes(i) 
                ? 'border-green-200 bg-green-50' 
                : [2,6].includes(i) 
                  ? 'border-amber-200 bg-amber-50' 
                  : 'border-gray-200'
            }`}>
              <span className="text-[10px] font-bold text-gray-800">{i + 1}</span>
              <p className="text-[7px] text-gray-500">
                {[1,3,5].includes(i) ? 'Занят' : [2,6].includes(i) ? 'Бронь' : 'Свободен'}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <div className="flex-1 bg-green-600 text-white rounded-lg py-2 text-center text-[10px] font-bold">Новый заказ</div>
          <div className="flex-1 border border-gray-200 rounded-lg py-2 text-center text-[10px] font-bold text-gray-600">Счета</div>
        </div>
      </div>
    </div>
  );
}

function DeliveryAppMock() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-[320px]">
      <div className="bg-gray-800 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold">Илья Курьер</p>
          <span className="bg-green-500/20 text-green-400 text-[8px] px-2 py-0.5 rounded-full">На линии</span>
        </div>
      </div>
      <div className="p-4">
        <div className="h-24 bg-gray-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-blue-50" />
          <svg className="w-full h-full relative" viewBox="0 0 200 80">
            <path d="M20 40 L60 25 L100 45 L140 30 L180 50" stroke="#22c55e" strokeWidth="2" fill="none" strokeDasharray="4 4" />
            <circle cx="20" cy="40" r="4" fill="#22c55e" />
            <circle cx="100" cy="45" r="3" fill="#f59e0b" />
            <circle cx="180" cy="50" r="4" fill="#ef4444" />
          </svg>
        </div>
        <div className="space-y-2">
          {['Тверская, 12', 'Арбат, 8'].map(addr => (
            <div key={addr} className="flex justify-between items-center text-xs">
              <span className="text-gray-700">{addr}</span>
              <span className="text-green-600 font-medium">320₽</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KioskMock() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-[320px]">
      <div className="bg-green-600 px-4 py-3 text-white flex items-center justify-between">
        <p className="text-xs font-bold">Выберите блюдо</p>
        <div className="bg-white/20 rounded-full px-2 py-0.5 text-[9px]">2</div>
      </div>
      <div className="p-4">
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {['Пицца', 'Паста', 'Салаты', 'Напитки'].map(c => (
            <span key={c} className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-medium ${
              c === 'Пицца' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>{c}</span>
          ))}
        </div>
        <div className="space-y-2">
          {['Маргарита — 450₽', 'Пепперони — 520₽'].map(item => (
            <div key={item} className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
              <span className="text-gray-700">{item.split(' — ')[0]}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-green-600">{item.split(' — ')[1]}</span>
                <div className="w-5 h-5 bg-green-600 text-white rounded flex items-center justify-center text-[10px] font-bold">+</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-green-600 text-white rounded-lg py-2 text-center text-[10px] font-bold">Оплатить</div>
      </div>
    </div>
  );
}

function KDSMock() {
  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-[400px]">
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
        <p className="text-xs font-bold text-white">Кухня — 5 заказов</p>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /><span className="text-[8px] text-gray-400">Активно</span></span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {[
          { id: '#124', items: 'Маргарита, Цезарь', time: '2 мин', urgent: false },
          { id: '#125', items: 'Карбонара, Раф', time: '5 мин', urgent: true },
          { id: '#126', items: 'Пепперони x2', time: '8 мин', urgent: false },
          { id: '#127', items: 'Тирамису, Капучино', time: '12 мин', urgent: false },
        ].map(o => (
          <div key={o.id} className={`rounded-lg border p-3 ${o.urgent ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${o.urgent ? 'text-red-600' : 'text-gray-800'}`}>{o.id}</span>
              {o.urgent && <span className="bg-red-100 text-red-600 text-[7px] px-1.5 py-0.5 rounded">Срочно</span>}
            </div>
            <p className="text-[9px] text-gray-500 mt-1">{o.items}</p>
            <div className="flex items-center justify-between mt-2">
              <span className={`text-[10px] font-bold ${o.urgent ? 'text-red-600' : 'text-gray-700'}`}>{o.time}</span>
              <button className="bg-green-600 text-white text-[7px] px-2 py-0.5 rounded font-bold">Готово</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackOfficeMock() {
  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-[400px]">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <span className="text-[9px] text-gray-400">Бэк-офис — Дашборд</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: 'Выручка', v: '45 230₽', c: 'text-green-600', bg: 'bg-green-50' },
            { l: 'Заказы', v: '24', c: 'text-blue-600', bg: 'bg-blue-50' },
            { l: 'Сред. чек', v: '1 884₽', c: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.l} className={`${s.bg} rounded-lg p-2 text-center`}>
              <p className="text-[7px] text-gray-500">{s.l}</p>
              <p className={`text-xs font-bold ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>
        <div className="border border-gray-100 rounded-lg p-2">
          <p className="text-[8px] font-bold text-gray-500 mb-2">Продажи сегодня</p>
          <div className="flex items-end gap-0.5 h-12">
            {[30,45,25,60,40,70,55,80,65,90,50,75].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-green-500 to-green-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DATA ─── */

const benefitIcons = [
  { icon: Settings, label: 'Гибкая стоимость под ваш бизнес' },
  { icon: Monitor, label: 'Вся функциональность в бэк-офисе' },
  { icon: Zap, label: 'Бесплатное внедрение' },
  { icon: PhoneCall, label: 'Бесплатная техподдержка' },
  { icon: Truck, label: 'Интеграция с Яндекс.Едой, Delivery Club и другими' },
];

const features17 = [
  { icon: MessageCircle, title: 'Встроенные чаты', desc: 'Гость-официант, гость-курьер, курьер-официант — общение в реальном времени без звонков.' },
  { icon: Gift, title: 'Геймификация', desc: 'Колесо удачи, викторины, челленджи для повышения вовлечённости гостей.' },
  { icon: DollarSign, title: 'Мультивалютность', desc: 'Поддержка нескольких валют для международных сетей.' },
  { icon: Code, title: 'SDK для разработчиков', desc: 'Создавайте свои плагины и расширения на базе нашего API.' },
  { icon: Headphones, title: 'Оператор колл-центра', desc: 'Интерфейс для приёма заказов по телефону.' },
  { icon: Wifi, title: 'Полный офлайн-режим', desc: 'Работа без интернета с автосинхронизацией.' },
  { icon: BarChart3, title: 'Прогнозирование спроса (AI)', desc: 'ML-модель для прогноза продаж и закупок.' },
  { icon: ChefHat, title: 'Sous Chef (умная очередь)', desc: 'Приоритизация заказов на кухне.' },
  { icon: CreditCard, title: 'Разделение счёта (split bill)', desc: 'Деление чека между гостями за 2 клика.' },
  { icon: QrCode, title: 'QR-самозаказ', desc: 'Гость сканирует QR и делает заказ сам.' },
  { icon: ScanLine, title: 'Экран раздачи (FOH)', desc: 'Отображение готовых блюд для выдачи.' },
  { icon: Shield, title: 'Честный знак (маркировка)', desc: 'Учёт маркированных товаров.' },
  { icon: Phone, title: 'IP-телефония', desc: 'Интеграция с АТС для приёма звонков.' },
  { icon: Puzzle, title: 'Магазин расширений', desc: 'Подключайте сторонние расширения.' },
  { icon: Fingerprint, title: '2FA', desc: 'Двухфакторная аутентификация.' },
  { icon: FileText, title: 'Аудит действий', desc: 'Логирование всех действий пользователей.' },
  { icon: Globe, title: 'PWA', desc: 'Сайт работает как приложение на телефоне.' },
];

const industrySections = [
  {
    icon: UtensilsCrossed,
    title: 'Рестораны и кафе',
    painPoints: [
      { icon: Shield, title: 'Как контролировать сотрудников и избежать воровства' },
      { icon: Star, title: 'Как контролировать качество блюд и сервиса' },
    ],
    features: [
      'Принимайте оплату любыми способами, включая баллы лояльности',
      'Рецептуру легко соблюдать благодаря безлимитным техкартам',
      'Создавайте специальное меню на определённые часы',
      'Анализируйте заказы по частоте и сумме чека',
      'Ведите складской учет и проводите инвентаризации',
      'Интеграция с Яндекс.Едой, Деливери и Купер',
    ],
    img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop',
  },
  {
    icon: Pizza,
    title: 'Фастфуд',
    painPoints: [
      { icon: UsersIcon, title: 'Что делать с высокой текучкой' },
      { icon: Clock, title: 'Как быстро обслуживать в часы пик' },
    ],
    features: [
      'Киоски самообслуживания — заказ без кассира',
      'Управление всеми заказами через кассовую программу',
      'Удобное управление зонами доставки на карте',
      'Заказ одним кликом передаётся на кухню',
      'Приложение для курьера с прокладкой маршрута',
      'Статусы заказов для покупателей в реальном времени',
    ],
    img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop',
  },
  {
    icon: Truck,
    title: 'Доставка еды',
    painPoints: [
      { icon: MapPin, title: 'Как организовать логистику доставки' },
      { icon: PieChart, title: 'Как управлять заказами с агрегаторов' },
    ],
    features: [
      'Приложение и сайт для онлайн-заказов на одном ядре',
      'Электронная очередь с отображением статусов',
      'Заказы в зале через QR-коды на столиках',
      'Удобный интерфейс кассы с настройкой под задачи',
      'Рекламные баннеры на экранах киосков',
      'Автоматическое применение скидок и акций',
    ],
    img: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=600&h=400&fit=crop',
  },
  {
    icon: Coffee,
    title: 'Пекарни и кофейни',
    painPoints: [
      { icon: Warehouse, title: 'Как эффективно вести складской учет' },
      { icon: TrendingUp, title: 'Как удержать клиентов и вернуть их снова' },
    ],
    features: [
      'Обслуживайте нескольких покупателей одновременно',
      'Автоматическое применение скидок (например, после 20:00)',
      'Весовой товар и продажа порциями',
      'Удобный учёт ингредиентов и заготовок',
      'Работа со складом и полная инвентаризация',
      'Модификаторы и топпинги для гибкого меню',
    ],
    img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop',
  },
  {
    icon: Building2,
    title: 'Столовые и корпоративное питание',
    painPoints: [
      { icon: ClipboardList, title: 'Как эффективно управлять производством' },
      { icon: UserCheck, title: 'Как создать базу постоянных клиентов' },
    ],
    features: [
      'Меню по дням недели и часам (завтрак, обед, ужин)',
      'Планирование производства и учёт фудкоста',
      'Продажа на вес и порциями с интеграцией весов',
      'Быстродействие интерфейса кассы',
      'Работа с постоянными посетителями и акциями',
      'Система баллов для групповых условий питания',
    ],
    img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop',
  },
  {
    icon: Store,
    title: 'Франшизы и сети',
    painPoints: [
      { icon: FileText, title: 'Как франчайзи соответствовать требованиям' },
      { icon: Activity, title: 'Как контролировать работу нескольких точек' },
    ],
    features: [
      'Упрощение масштабирования с готовой моделью',
      'Финансовое управление сетью в едином интерфейсе',
      'Стандарты и контроль качества в любом городе',
      'Управление складом и поставками централизованно',
      'Маркетинговая активность под каждое заведение',
      'Контроль запасов и учёт алкоголя (ЕГАИС, Честный знак)',
    ],
    img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop',
  },
];

const comparisonData = [
  { feature: 'Встроенные чаты', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Офлайн-режим', fc: true, iiko: false, yuma: 'Частично', poster: false, rk: false },
  { feature: 'Геймификация', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'AI-прогнозы', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'QR-самозаказ', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Split bill', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Приложение курьера', fc: true, iiko: false, yuma: false, poster: false, rk: false },
  { feature: 'Мобильное приложение гостя', fc: true, iiko: true, yuma: false, poster: false, rk: false },
  { feature: 'Облачная версия', fc: true, iiko: true, yuma: true, poster: true, rk: true },
  { feature: 'Современный интерфейс', fc: true, iiko: true, yuma: true, poster: true, rk: false },
  { feature: 'Единая архитектура', fc: true, iiko: true, yuma: true, poster: true, rk: false },
  { feature: '100% функций без доплат', fc: true, iiko: false, yuma: false, poster: false, rk: false },
];

const plans = [
  { name: 'Стартовый', price: '9 900 ₽', sub: 'Для небольших заведений', features: ['До 500 заказов/мес', 'До 5 сотрудников', '1 филиал', 'Управление меню', 'Базовые отчёты', 'Email-поддержка'] },
  { name: 'Бизнес', price: '19 900 ₽', sub: 'Для растущего бизнеса', popular: true, features: ['До 2 000 заказов/мес', 'До 20 сотрудников', 'До 3 филиалов', 'Все модули', 'Интеграции', 'Приоритетная поддержка'] },
  { name: 'Корпоративный', price: '39 900 ₽', sub: 'Для сетей ресторанов', features: ['Безлимит заказов', 'Безлимит сотрудников', 'Безлимит филиалов', 'AI-прогнозы', 'White Label', 'Персональный менеджер 24/7'] },
];

const faqs = [
  { q: 'Что входит в тариф?', a: 'Каждый тариф включает полный доступ ко всем модулям. Разница только в лимитах. Все функции доступны без ограничений.' },
  { q: 'Нужен ли сервер для установки?', a: 'Нет. FoodChain — облачная платформа. Нужен только браузер и интернет.' },
  { q: 'Можно ли перенести данные из другой системы?', a: 'Да. Поддерживаем импорт из iiko, R-Keeper, Poster, YUMA и Excel. Поможем с миграцией бесплатно.' },
  { q: 'Есть ли техподдержка?', a: 'Да. На всех тарифах — email. На «Бизнес» — приоритетная. На «Корпоративном» — персональный менеджер 24/7.' },
  { q: 'Как работает демо-период?', a: '14 дней полного доступа на тарифе «Бизнес». Без карты. После — выбор тарифа или бесплатный базовый.' },
  { q: 'Можно ли подключить эквайринг?', a: 'Да. Интегрированы с ведущими платёжными провайдерами и фискальными регистраторами.' },
];

const testimonials = [
  { text: 'Перешли на FoodChain 6 месяцев назад. Средний чек вырос на 23%, ошибки в заказах упали до нуля. Чаты — гости в восторге.', name: 'Алексей Константинов', role: 'Владелец CoffeeLab', rating: 5, img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
  { text: 'Раньше работали на R-Keeper — постоянные проблемы и скрытые платежи. FoodChain дал предсказуемость и экономию.', name: 'Екатерина Морозова', role: 'Управляющая рестораном «Терраса»', rating: 5, img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face' },
  { text: 'Запустили доставку за 3 дня. Интеграция с Яндекс.Едой — за час. Приложение курьера — отдельная гордость.', name: 'Дмитрий Соколов', role: 'CEO сети Grab&Go', rating: 5, img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face' },
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

/* ─── MAIN ─── */

export function Portal() {
  const [venueIdx, setVenueIdx] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setVenueIdx(p => (p + 1) % venueTypes.length), 2500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTestimonialIdx(p => (p + 1) % testimonials.length), 5000);
    return () => clearInterval(t);
  }, []);

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
              <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="font-bold text-xl text-gray-900">Food<span className="text-green-600">Chain</span></span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <div className="relative group">
                <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition flex items-center gap-1">
                  Тип заведения <ChevronDown className="h-3 w-3" />
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  {['Рестораны', 'Кафе', 'Доставка', 'Бары', 'Пекарни', 'Фудтраки'].map(item => (
                    <a key={item} href="#" className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">{item}</a>
                  ))}
                </div>
              </div>
              <div className="relative group">
                <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition flex items-center gap-1">
                  Продукт <ChevronDown className="h-3 w-3" />
                </button>
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  {[
                    { label: 'Бэк-офис', to: '/features' },
                    { label: 'Приложение официанта', to: '/apps' },
                    { label: 'Приложение курьера', to: '/apps' },
                    { label: 'Киоск самообслуживания', to: '/apps' },
                    { label: 'Экран кухни (KDS)', to: '/apps' },
                    { label: 'Онлайн-заказы', to: '/features' },
                  ].map(item => (
                    <Link key={item.label} to={item.to} className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">{item.label}</Link>
                  ))}
                </div>
              </div>
              <Link to="/features" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition">Оборудование</Link>
              <Link to="/pricing" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition">Цены</Link>
              <div className="relative group">
                <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition flex items-center gap-1">
                  Ресурсы <ChevronDown className="h-3 w-3" />
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <Link to="/about" className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">О нас</Link>
                  <Link to="/blog" className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900">Блог</Link>
                </div>
              </div>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <a href="tel:88001234567" className="text-sm font-medium text-gray-600 hover:text-gray-900">8 (800) 123-45-67</a>
              <Link to="/register" className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition shadow-sm shadow-green-600/20 hover:shadow-green-600/40">Запросить демо</Link>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="reveal opacity-0 translate-y-8 transition-all duration-700">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                Вся сила<br />
                EPOS для{' '}
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

              {/* Benefits */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {benefitIcons.map((b, i) => {
                  const BI = b.icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                        <BI className="h-5 w-5" />
                      </div>
                      <p className="text-sm text-gray-700 leading-snug">{b.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center lg:justify-end reveal opacity-0 translate-y-8 transition-all duration-700 delay-200">
              <div className="relative">
                <TerminalMock />
                <div className="absolute -bottom-8 -left-16">
                  <PhoneMock />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLIENT LOGOS CAROUSEL */}
      <section className="py-12 border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-sm text-gray-400 mb-8">Уже используют FoodChain</p>
          <div className="flex overflow-hidden">
            <div className="flex gap-8 animate-scroll">
              {[...clientLogos, ...clientLogos].map((logo, i) => (
                <div key={i} className={`shrink-0 px-6 py-3 rounded-xl ${logo.bg} text-sm font-semibold`}>
                  {logo.name}
                </div>
              ))}
            </div>
          </div>
          <div className="text-center mt-8">
            <Link to="/register" className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-semibold">
              Присоединяйтесь <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* WHY US — Check out everything */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Всё о системе FoodChain</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Более 5 лет мы работаем с заведениями общественного питания, чтобы понять особенности реального сервиса.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Settings, title: 'Вся функциональность в бэк-офисе', desc: 'Ваш бэк-офис объединяет всё: учёт склада, настройку меню, управление персоналом, финансы, контроль затрат и маркетинг.' },
              { icon: MenuIcon, title: 'Продвинутое управление меню', desc: 'Обрабатывайте все заказы из зала, доставки и самовывоза. Принимайте заказы с доставки напрямую. Отправляйте заказы на кухню мгновенно.' },
              { icon: Globe, title: 'Сайт под ваш бренд', desc: 'Запустите собственную службу доставки. Используйте QR-коды для заказа. Гибкая настройка для сетей и франшиз.' },
            ].map((item, i) => (
              <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group rounded-2xl border border-gray-100 p-8 hover:border-green-200 hover:shadow-lg transition-all">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all">
                  <item.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-gray-900">{item.title}</h3>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-4 gap-8 mt-12">
            {[
              { icon: Smartphone, title: 'Приложение официанта', desc: 'Официанты быстро принимают заказы, записывают гостей в программу лояльности, добавляют предпочтения и отправляют заказы на кухню.' },
              { icon: Truck, title: 'Приложение курьера', desc: 'Назначайте курьеров прямо с кассы и отслеживайте маршруты доставки в реальном времени с интеграцией Google Maps.' },
              { icon: Monitor, title: 'Киоск самообслуживания', desc: 'Ускоряйте обслуживание, сокращайте очереди и снижайте нагрузку на персонал. Используйте экран как меню, трекер заказов и рекламное пространство.' },
              { icon: ChefHat, title: 'Экран кухни', desc: 'Заказы поступают на нужный станок кухни. Когда блюда готовы, кухня мгновенно уведомляет официанта.' },
            ].map((item, i) => (
              <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group rounded-2xl border border-gray-100 p-6 hover:border-green-200 hover:shadow-lg transition-all text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-600 group-hover:bg-green-50 group-hover:text-green-600 transition-all mx-auto">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEVICE MOCKUPS — Apps */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Все приложения для вашего бизнеса</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">6 приложений, которые полностью покрывают все процессы вашего заведения</p>
          </div>
          <div className="space-y-16">
            {[
              { mock: WaiterAppMock, title: 'Приложение официанта', desc: 'Схема зала, приём заказов, отправка на кухню и оплата с планшета.', features: ['Интуитивный интерфейс', 'Работает на любых устройствах', 'Синхронизация в реальном времени'] },
              { mock: DeliveryAppMock, title: 'Приложение курьера', desc: 'Маршруты, геолокация, статусы доставки. Работает на любом смартфоне.', features: ['Автоматическая прокладка маршрута', 'Отслеживание в реальном времени', 'Приём оплаты на месте'] },
              { mock: KioskMock, title: 'Киоск самообслуживания', desc: 'Сенсорный терминал для самостоятельного заказа в зале.', features: ['Электронная очередь', 'Рекламные баннеры', 'Приём любых способов оплаты'] },
              { mock: KDSMock, title: 'Экран кухни (KDS)', desc: 'Очередь заказов с таймерами, автосписание ингредиентов.', features: ['Статусы заказов', 'Звуковые оповещения', 'Приоритизация блюд'] },
              { mock: BackOfficeMock, title: 'Бэк-офис', desc: 'Дашборд, управление меню, склад, финансы и персонал.', features: ['Аналитика и отчёты', 'Управление персоналом', 'Контроль затрат'] },
            ].map((app, i) => {
              const Mock = app.mock;
              return (
                <div key={i} className={`grid items-center gap-10 lg:grid-cols-2 reveal opacity-0 translate-y-8 transition-all duration-700 ${i % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}>
                  <div className={i % 2 === 1 ? 'lg:col-start-2' : ''}>
                    <h3 className="text-2xl font-bold text-gray-900">{app.title}</h3>
                    <p className="mt-3 text-lg text-gray-500">{app.desc}</p>
                    <ul className="mt-6 space-y-3">
                      {app.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`flex justify-center ${i % 2 === 1 ? 'lg:col-start-1' : ''}`}><Mock /></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* INDUSTRY SECTIONS */}
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
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
                        <SectionIcon className="h-6 w-6" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900">{section.title}</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      {section.painPoints.map((pp, j) => {
                        const PPIcon = pp.icon;
                        return (
                          <div key={j} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <div className="flex items-center gap-2 mb-2">
                              <PPIcon className="h-4 w-4 text-green-600" />
                              <span className="text-xs font-medium text-gray-700">{pp.title}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <ul className="space-y-2.5">
                      {section.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-gray-600">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`flex justify-center ${i % 2 === 1 ? 'lg:col-start-1' : ''}`}>
                    <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-100">
                      <img src={section.img} alt={section.title} className="w-full h-[300px] object-cover" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 17 FEATURES */}
      <section className="py-20 bg-gray-50" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">17 функций, которых нет у конкурентов</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-3xl mx-auto">FoodChain — единственная система, которая даёт все эти преимущества из коробки.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {features17.map((f, i) => (
              <div key={i} className="reveal opacity-0 translate-y-8 transition-all duration-700 group flex gap-4 rounded-xl border border-gray-100 bg-white p-5 hover:border-green-200 hover:shadow-md transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="py-20 bg-white">
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
                      <td key={key} className={`px-4 py-4 text-center ${key === 'fc' ? 'bg-green-50/50' : ''}`}>
                        {row[key] === true ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </span>
                        ) : row[key] === false ? (
                          <span className="text-gray-300 text-sm">—</span>
                        ) : (
                          <span className="text-gray-500 text-xs">{row[key]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Надёжный поставщик EPOS-систем</h2>
            <p className="mt-4 text-lg text-gray-500">Реальные результаты от реальных пользователей</p>
          </div>
          <div className="relative reveal opacity-0 translate-y-8 transition-all duration-700">
            {testimonials.map((t, i) => (
              <div key={i} className={`transition-all duration-500 ${i === testimonialIdx ? 'block' : 'hidden'}`}>
                <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12 text-center shadow-sm">
                  <div className="flex justify-center gap-1 mb-6">
                    {Array.from({ length: t.rating }, (_, j) => <Star key={j} className="h-5 w-5 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-lg sm:text-xl text-gray-700 leading-relaxed italic">"{t.text}"</p>
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

      {/* PRICING */}
      <section className="py-20 bg-white" id="pricing">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16 reveal opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Выберите ваш тариф</h2>
            <p className="mt-4 text-lg text-gray-500">Все тарифы включают 14-дневный бесплатный пробный период</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <div key={i} className={`reveal opacity-0 translate-y-8 transition-all duration-700 relative flex flex-col rounded-2xl border p-8 ${plan.popular ? 'border-green-500 bg-gradient-to-b from-green-50 to-white shadow-xl shadow-green-500/10 ring-1 ring-green-500/20 scale-105' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-600 px-4 py-1 text-xs font-bold text-white shadow-lg">Самый популярный</span>}
                <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.sub}</p>
                <div className="mt-6 flex items-baseline gap-1"><span className="text-4xl font-bold text-gray-900">{plan.price}</span><span className="text-sm text-gray-500">/мес</span></div>
                <ul className="mt-8 flex-1 space-y-3.5">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-gray-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />{f}</li>
                  ))}
                </ul>
                <Link to="/register" className={`mt-8 block w-full rounded-lg px-6 py-3 text-center text-sm font-semibold transition-all ${plan.popular ? 'bg-green-600 text-white shadow-lg hover:bg-green-700 hover:shadow-xl' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>Выбрать тариф</Link>
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
                    {isOpen ? <ChevronUp className="h-5 w-5 shrink-0 text-green-600" /> : <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />}
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
          <p className="mt-4 text-xs text-gray-400">Нажимая кнопку, вы принимаете соглашение об обработке персональных данных</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 py-16">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">F</span>
                </div>
                <span className="font-bold text-white text-lg">Food<span className="text-green-400">Chain</span></span>
              </div>
              <p className="text-sm leading-relaxed text-gray-500 max-w-xs">Единая EPOS-система для общественного питания.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Продукт</h4>
              <div className="space-y-3 text-sm">
                <Link to="/features" className="block text-gray-500 hover:text-green-400 transition">EPOS-терминал</Link>
                <Link to="/features" className="block text-gray-500 hover:text-green-400 transition">Бэк-офис</Link>
                <Link to="/features" className="block text-gray-500 hover:text-green-400 transition">Маркетинг и лояльность</Link>
                <Link to="/features" className="block text-gray-500 hover:text-green-400 transition">Онлайн-заказы</Link>
                <Link to="/apps" className="block text-gray-500 hover:text-green-400 transition">Киоск самообслуживания</Link>
                <Link to="/apps" className="block text-gray-500 hover:text-green-400 transition">Электронная очередь</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Приложения</h4>
              <div className="space-y-3 text-sm">
                <Link to="/apps" className="block text-gray-500 hover:text-green-400 transition">Экран кухни</Link>
                <Link to="/apps" className="block text-gray-500 hover:text-green-400 transition">Приложение курьера</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Услуги</h4>
              <div className="space-y-3 text-sm">
                <Link to="/pricing" className="block text-gray-500 hover:text-green-400 transition">Цены</Link>
                <Link to="/features" className="block text-gray-500 hover:text-green-400 transition">Оборудование</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Компания</h4>
              <div className="space-y-3 text-sm">
                <Link to="/about" className="block text-gray-500 hover:text-green-400 transition">О нас</Link>
                <Link to="/contact" className="block text-gray-500 hover:text-green-400 transition">Контакты</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">© 2026 FoodChain / MIRUZ. Все права защищены.</p>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <a href="#" className="hover:text-green-400 transition">Политика конфиденциальности</a>
              <a href="#" className="hover:text-green-400 transition">Условия использования</a>
              <a href="#" className="hover:text-green-400 transition">Файлы cookie</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
