import { Link } from 'react-router-dom';
import {
  CreditCard,
  QrCode,
  Smartphone,
  Wallet,
  Printer,
  ShieldCheck,
  ClipboardCheck,
  Beer,
  Globe,
  MapPin,
  ShoppingCart,
  ArrowRight,
  Check,
  ExternalLink,
  Building2,
  Banknote,
} from 'lucide-react';

const paymentMethods = [
  {
    icon: CreditCard,
    name: 'Т-Банк',
    description: 'Приём платежей по картам Visa, Mastercard и Мир',
  },
  {
    icon: QrCode,
    name: 'СБП',
    description: 'Оплата по QR-коду через Систему быстрых платежей',
  },
  {
    icon: Smartphone,
    name: 'Apple Pay / Google Pay',
    description: 'Оплата в одно касание с любого устройства',
  },
  {
    icon: Wallet,
    name: 'ЮKassa',
    description: 'Универсальный платёжный шлюз с поддержкой всех способов оплаты',
  },
];

const fiscalDevices = [
  {
    icon: Printer,
    name: 'Атол',
    description: 'Поддержка всех моделей онлайн-касс Атол',
  },
  {
    icon: Printer,
    name: 'Штрих-М',
    description: 'Интеграция с кассовыми аппаратами Штрих-М',
  },
  {
    icon: ShieldCheck,
    name: 'Честный знак',
    description: 'Маркировка товаров и контроль оборота продукции',
  },
  {
    icon: Beer,
    name: 'ЕГАИС',
    description: 'Учёт алкогольной продукции и передача данных',
  },
];

const deliveryAggregators = [
  {
    icon: ShoppingCart,
    name: 'Яндекс Еда',
    description: 'Синхронизация меню и автоматический приём заказов',
  },
  {
    icon: ShoppingCart,
    name: 'Delivery Club',
    description: 'Автоматический приём и обработка заказов',
  },
  {
    icon: ShoppingCart,
    name: 'СберМаркет',
    description: 'Интеграция с маркетплейсом продуктов и товаров',
  },
];

const deliveryBenefits = [
  'Единая очередь заказов из всех сервисов',
  'Автоматическое обновление статусов доставки',
  'Синхронизация меню в реальном времени',
  'Уведомления о новых заказах в системе',
];

const syncItems = [
  'Заказы и чеки',
  'Номенклатура и цены',
  'Контрагенты и поставщики',
  'Остатки склада',
  'Акты сверки',
];

const banks = [
  'Сбербанк', 'Т-Банк', 'ВТБ', 'Альфа-Банк',
  'Райффайзенбанк', 'Газпромбанк', 'Открытие', 'Ак Барс',
];

export function Integrations() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 pb-24 pt-20 sm:pb-32 sm:pt-28">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_bottom_right,_rgba(239,68,68,0.08),transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-orange-500/25">
            FoodChain
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Интеграции и{' '}
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              фискализация
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-300 sm:text-xl">
            Подключите всё, что нужно вашему ресторану: онлайн-кассы, агрегаторы
            доставки, банки и 1С.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/40 hover:scale-105"
            >
              Начать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-600 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </section>

      {/* Online Payments */}
      <section className="relative -mt-16 px-4 pb-16 sm:-mt-20 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/50 sm:p-12">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Онлайн-оплата
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-gray-500">
                Все платежи проходят с соблюдением 54-ФЗ. Чек автоматически
                отправляется в ФНС и клиенту.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <div
                    key={method.name}
                    className="group rounded-xl border border-gray-100 bg-gray-50/50 p-6 transition-all duration-300 hover:border-orange-200 hover:bg-orange-50/50 hover:shadow-lg hover:shadow-orange-500/5"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-gray-900">
                      {method.name}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                      {method.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Fiscalization */}
      <section className="px-4 pb-16 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Фискализация и кассы
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-500">
              Поддержка всех популярных моделей онлайн-касс. Автоматическая
              печать чеков при оплате.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {fiscalDevices.map((device) => {
              const Icon = device.icon;
              return (
                <div
                  key={device.name}
                  className="group rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">
                    {device.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                    {device.description}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50/50 px-6 py-5">
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <p className="text-sm leading-relaxed text-gray-600">
                Все чеки автоматически передаются в ФНС через ОФД. Электронные
                чеки отправляются клиентам на email или по SMS. Полное
                соответствие требованиям 54-ФЗ.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Delivery Aggregators */}
      <section className="bg-white px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Агрегаторы доставки
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-500">
              Принимайте заказы из всех популярных сервисов доставки прямо в
              вашу систему.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {deliveryAggregators.map((agg) => {
              const Icon = agg.icon;
              return (
                <div
                  key={agg.name}
                  className="group rounded-xl border border-gray-100 bg-gray-50/50 p-6 shadow-sm transition-all duration-300 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-500/5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/20 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">
                    {agg.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                    {agg.description}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {deliveryBenefits.map((benefit) => (
              <div
                key={benefit}
                className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-5 py-4 text-sm text-gray-600"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                {benefit}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 1C Integration */}
      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50 sm:grid sm:grid-cols-2">
            <div className="p-8 sm:p-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
                <Building2 className="h-6 w-6" />
              </div>
              <h2 className="mt-6 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Интеграция с 1С
              </h2>
              <p className="mt-3 text-gray-500 leading-relaxed">
                Двусторонний обмен данными с 1С: Предприятие. Автоматическая
                синхронизация без участия бухгалтера.
              </p>
              <ul className="mt-6 space-y-3">
                {syncItems.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-xl bg-blue-50/50 px-5 py-4">
                <p className="text-sm leading-relaxed text-gray-600">
                  Бухгалтерия всегда в актуальном состоянии. Забудьте о ручном
                  переносе данных и сверках.
                </p>
              </div>
            </div>
            <div className="hidden bg-gradient-to-br from-blue-500 to-cyan-500 p-8 sm:flex sm:flex-col sm:items-center sm:justify-center sm:p-12">
              <Building2 className="h-24 w-24 text-white/30" />
              <p className="mt-6 text-center text-lg font-semibold text-white">
                1С: Предприятие
              </p>
              <p className="mt-2 text-center text-sm text-white/70">
                Полная синхронизация данных
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Maps & Navigation */}
      <section className="bg-gray-900 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white">
              <MapPin className="h-4 w-4" />
              Карты и навигация
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Геолокация и карты
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-400">
              Отображайте ваш ресторан на картах и отслеживайте курьеров в
              реальном времени.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                name: 'Яндекс.Карты',
                desc: 'Геокодирование, построение маршрутов и отображение ресторана',
              },
              {
                name: 'Google Maps',
                desc: 'Глобальная картография и навигация для курьеров',
              },
              {
                name: '2GIS',
                desc: 'Детальные карты городов и навигация по помещениям',
              },
            ].map((map) => (
              <div
                key={map.name}
                className="group rounded-xl border border-gray-700 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-orange-500/50 hover:bg-white/10"
              >
                <Globe className="h-8 w-8 text-orange-400 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="mt-4 text-base font-semibold text-white">
                  {map.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
                  {map.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Acquiring */}
      <section className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50">
            <div className="p-8 sm:p-12">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
                  <Banknote className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                    Эквайринг
                  </h2>
                  <p className="mt-1 text-gray-500">
                    Приём платежей через банковские терминалы
                  </p>
                </div>
              </div>
              <p className="mt-6 text-gray-500 leading-relaxed">
                Подключайте банковские терминалы для приёма оплаты картами в
                ресторане. Все платежи проходят через защищённые каналы с
                соблюдением требований PCI DSS.
              </p>
              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Поддерживаемые банки
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {banks.map((bank) => (
                    <span
                      key={bank}
                      className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600 transition-all duration-200 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                    >
                      {bank}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-orange-500 to-red-600 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Готовы подключить интеграции?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-orange-100">
            Оставьте заявку — мы поможем настроить все интеграции под ваш бизнес
            за 1 день.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-orange-600 shadow-lg shadow-black/20 transition-all duration-300 hover:shadow-xl hover:shadow-black/30 hover:scale-105"
            >
              Начать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-8 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/10"
            >
              Связаться с нами
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
