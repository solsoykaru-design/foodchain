import { Link } from 'react-router-dom';
import { BarChart3, LineChart, PieChart, TrendingUp, DollarSign, Percent, FileText, Download, Printer, Users, Clock, Calculator, ArrowRight, Check, Wallet, ShoppingCart, Package, Award } from 'lucide-react';

const metrics = [
  { icon: DollarSign, label: 'Выручка сегодня', value: '324 500 ₽', color: 'text-green-600', bg: 'bg-green-100' },
  { icon: TrendingUp, label: 'Выручка неделя', value: '2 185 000 ₽', color: 'text-blue-600', bg: 'bg-blue-100' },
  { icon: BarChart3, label: 'Выручка месяц', value: '8 742 000 ₽', color: 'text-purple-600', bg: 'bg-purple-100' },
  { icon: Wallet, label: 'Средний чек', value: '1 850 ₽', color: 'text-amber-600', bg: 'bg-amber-100' },
  { icon: Percent, label: 'Фудкост', value: '28.4%', color: 'text-rose-600', bg: 'bg-rose-100' },
  { icon: TrendingUp, label: 'Маржинальная прибыль', value: '71.6%', color: 'text-emerald-600', bg: 'bg-emerald-100' },
];

const revenueFeatures = [
  {
    icon: LineChart,
    title: 'Выручка по дням / неделям / месяцам',
    desc: 'Интерактивные графики с детализацией до каждого часа. Сравнение с предыдущими периодами.',
  },
  {
    icon: PieChart,
    title: 'Расходы по категориям',
    desc: 'Продукты, персонал, аренда, логистика, маркетинг — наглядная структура затрат.',
  },
  {
    icon: TrendingUp,
    title: 'Прогнозирование',
    desc: 'На основе исторических данных и сезонности. Точность прогноза до 92%.',
  },
  {
    icon: BarChart3,
    title: 'Сравнение периодов',
    desc: 'Неделя к неделе, месяц к месяцу, год к году. Динамика и тренды.',
  },
];

const foodCostFeatures = [
  {
    icon: Calculator,
    title: 'Калькуляция блюда',
    desc: 'Автоматический расчёт себестоимости из техкарт с учётом текущих цен поставщиков.',
  },
  {
    icon: Percent,
    title: 'Маржинальность',
    desc: 'Наценка и рентабельность каждого блюда. Цветовая индикация отклонений.',
  },
  {
    icon: ShoppingCart,
    title: 'Списание продуктов',
    desc: 'Контроль списаний с привязкой к причинам: срок годности, брак, пересортица.',
  },
  {
    icon: Award,
    title: 'ABC-анализ',
    desc: 'Какие блюда приносят 80% прибыли. Оптимизация меню на основе данных.',
  },
];

const reportTypes = [
  {
    icon: FileText,
    title: 'Отчёт по продажам',
    desc: 'Детализация по дням, блюдам, категориям, часам и сотрудникам.',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  {
    icon: Package,
    title: 'Отчёт по складу',
    desc: 'Остатки, обороты, списания, минимальные запасы, инвентаризация.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
  },
  {
    icon: Users,
    title: 'Отчёт по персоналу',
    desc: 'KPI, эффективность, зарплата, отработанные часы, заказы на сотрудника.',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
  },
  {
    icon: DollarSign,
    title: 'Финансовый отчёт',
    desc: 'P&L, cash flow, баланс. Полная финансовая картина ресторана.',
    color: 'text-amber-600',
    bg: 'bg-amber-100',
  },
  {
    icon: Clock,
    title: 'Отчёт по доставке',
    desc: 'Время доставки, километраж, курьеры, стоимость, рейтинг.',
    color: 'text-rose-600',
    bg: 'bg-rose-100',
  },
  {
    icon: Award,
    title: 'ABC-анализ блюд',
    desc: 'Категории A, B, C по выручке и маржинальности. Рекомендации по меню.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
  },
];

const payrollTypes = [
  { icon: Clock, title: 'Почасовая', desc: 'Оплата за фактически отработанные часы' },
  { icon: ShoppingCart, title: 'За заказы', desc: 'Процент с каждого выполненного заказа' },
  { icon: Wallet, title: 'Оклад', desc: 'Фиксированная сумма за период' },
  { icon: Calculator, title: 'Комбинированная', desc: 'Оклад + бонусы за KPI и выручку' },
];

export function Finance() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20">
            <BarChart3 size={32} />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
            Финансы, отчёты и аналитика
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Полный контроль над финансами ресторана: от выручки до маржинального анализа. Все цифры в реальном времени.
          </p>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold text-zinc-900 mb-6">Панель финансов</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {metrics.map((m, i) => (
              <div key={i} className="text-center">
                <div className={`w-10 h-10 ${m.bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                  <m.icon size={20} className={m.color} />
                </div>
                <div className="text-lg font-bold text-zinc-900">{m.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center justify-between text-sm text-zinc-500">
            <span>Графики продаж и загрузки в реальном времени</span>
            <Link to="/admin/finance" className="text-orange-500 font-medium hover:text-orange-600 transition flex items-center gap-1">
              Подробнее <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Revenue & Expenses */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <LineChart size={20} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Доходы и расходы</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {revenueFeatures.map((f, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 hover:shadow-md transition">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <f.icon size={20} className="text-blue-600" />
              </div>
              <h3 className="font-bold text-zinc-900 mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Food Cost */}
      <section className="bg-white border-t border-b border-zinc-200 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-sm">
              <Percent size={20} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900">Фудкост и себестоимость</h2>
          </div>
          <p className="text-zinc-500 text-sm sm:text-base max-w-2xl mb-8 leading-relaxed">
            Автоматический расчёт себестоимости каждого блюда на основе техкарт. Контроль маржинальности в реальном времени.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {foodCostFeatures.map((f, i) => (
              <div key={i} className="border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition bg-zinc-50">
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center mb-3">
                  <f.icon size={20} className="text-rose-600" />
                </div>
                <h3 className="font-bold text-zinc-900 text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reports */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
            <FileText size={20} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Отчёты</h2>
        </div>
        <p className="text-zinc-500 text-sm sm:text-base max-w-2xl mb-8 leading-relaxed">
          Готовые отчёты для управленческих решений. Экспорт в Excel, PDF, печать.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {reportTypes.map((r, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${r.bg} rounded-xl flex items-center justify-center`}>
                  <r.icon size={20} className={r.color} />
                </div>
              </div>
              <h3 className="font-bold text-zinc-900 text-sm mb-1">{r.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-6 text-sm text-zinc-500">
          <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-lg px-3 py-1.5">
            <Download size={14} className="text-zinc-400" /> Excel
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-lg px-3 py-1.5">
            <Download size={14} className="text-zinc-400" /> PDF
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-lg px-3 py-1.5">
            <Printer size={14} className="text-zinc-400" /> Печать
          </div>
        </div>
      </section>

      {/* Fiscal Reports */}
      <section className="bg-zinc-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-sm">
                  <DollarSign size={20} className="text-zinc-900" />
                </div>
                <h2 className="text-2xl font-bold">Фискальная отчётность</h2>
              </div>
              <p className="text-zinc-400 text-sm sm:text-base max-w-xl leading-relaxed">
                Все чеки и закрытия смен хранятся в системе. Легко найти любой чек, сформировать Z-отчёт. Полная интеграция с онлайн-кассами.
              </p>
              <div className="flex items-center gap-2 mt-4 text-sm text-emerald-400">
                <Check size={16} /> Интеграция с онлайн-кассами
              </div>
            </div>
            <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 shrink-0">
              <div className="text-3xl font-bold text-emerald-400">54-ФЗ</div>
              <div className="text-xs text-zinc-500 mt-1">Полное соответствие</div>
            </div>
          </div>
        </div>
      </section>

      {/* Payroll */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-sm">
            <Users size={20} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Зарплата сотрудников</h2>
        </div>
        <p className="text-zinc-500 text-sm sm:text-base max-w-2xl mb-8 leading-relaxed">
          Автоматический расчёт зарплаты на основе отработанных смен, заказов и KPI. Гибкая настройка систем оплаты.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {payrollTypes.map((p, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-md transition">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
                <p.icon size={20} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-zinc-900 text-sm mb-1">{p.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl shadow-orange-500/20">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Начните управлять финансами</h2>
          <p className="text-white/80 text-sm sm:text-base max-w-lg mx-auto mb-6 leading-relaxed">
            Полный финансовый учёт, аналитика и отчёты в одном окне. Всё, чтобы ресторан приносил больше прибыли.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-white text-orange-600 font-bold px-6 py-3 rounded-xl hover:bg-orange-50 transition shadow-lg"
          >
            Попробовать бесплатно <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
