import { Link } from 'react-router-dom';
import { User, Target, Award, Heart, Check, ArrowRight, Star, Quote, MapPin, Clock, Zap, TrendingUp, Shield } from 'lucide-react';

const stats = [
  { icon: TrendingUp, value: '500+', label: 'Ресторанов' },
  { icon: Zap, value: '50K+', label: 'Заказов в месяц' },
  { icon: Shield, value: '99.9%', label: 'Uptime' },
  { icon: Clock, value: '24/7', label: 'Поддержка' },
];

const team = [
  { name: 'Иван Петров', role: 'Основатель и CEO', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face' },
  { name: 'Анна Смирнова', role: 'Технический директор', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face' },
  { name: 'Михаил Орлов', role: 'Руководитель разработки', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face' },
  { name: 'Елена Козлова', role: 'Директор по продукту', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face' },
  { name: 'Сергей Волков', role: 'Руководитель продаж', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face' },
  { name: 'Мария Новикова', role: 'Директор по маркетингу', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face' },
];

const values = [
  { icon: Target, title: 'Миссия', text: 'Сделать управление рестораном простым, прозрачным и эффективным. Мы создаём инструменты, которые помогают рестораторам сосредоточиться на главном — на гостях и качестве блюд.' },
  { icon: Award, title: 'Качество', text: 'Мы стремимся к безупречному качеству каждого продукта. Каждая строка кода, каждый интерфейс и каждая интеграция проходят многоуровневое тестирование.' },
  { icon: Heart, title: 'Забота', text: 'Ставим интересы ресторанов и их гостей на первое место. Наша поддержка работает 24/7 и решает любые вопросы за считанные минуты.' },
  { icon: Check, title: 'Надёжность', text: 'Обеспечиваем стабильную работу 24 часа в сутки, 7 дней в неделю. 99.9% uptime и автоматическое резервное копирование всех данных.' },
];

const timeline = [
  { year: '2020', title: 'Основание FoodChain', desc: 'Команда из 3 разработчиков запускает MVP для одного ресторана в Москве.' },
  { year: '2021', title: 'Рост до 50 ресторанов', desc: 'Запуск мобильных приложений и интеграция с агрегаторами доставки.' },
  { year: '2022', title: 'Серия А', desc: 'Привлечение инвестиций, расширение команды до 30 человек, запуск экрана кухни (KDS).' },
  { year: '2023', title: '500+ ресторанов', desc: 'Выход на рынки СНГ, запуск AI-прогнозов и программы лояльности.' },
  { year: '2024', title: 'Платформа №1', desc: 'FoodChain становится ведущей платформой автоматизации для ресторанного бизнеса.' },
];

const partners = ['Яндекс.Еда', 'Delivery Club', 'Купер', 'СБП', '1С', 'Tinkoff', 'Sber', 'Yandex Cloud'];

const testimonials = [
  { text: 'FoodChain полностью изменил наш подход к управлению. Мы сократили время на отчёты с 4 часов до 15 минут в день.', name: 'Алексей Константинов', role: 'CEO, сеть кофеен CoffeeLab' },
  { text: 'Перешли на FoodChain год назад. За это время средний чек вырос на 18%, а количество ошибок в заказах упало до нуля.', name: 'Екатерина Морозова', role: 'Управляющая, ресторан «Терраса»' },
];

export function About() {
  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_top_right,_rgba(0,180,216,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_bottom_left,_rgba(0,150,200,0.06),transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-cyan-500/20">
              О компании
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              О компании FoodChain
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-400 sm:text-xl">
              Мы помогаем ресторанам автоматизировать бизнес — от управления заказами до аналитики продаж.
              FoodChain — это экосистема инструментов для современного ресторанного бизнеса.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105"
              >
                Связаться с нами
              </Link>
              <Link
                to="/features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
              >
                Наши возможности
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-white/5 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/[0.03] px-6 py-6 text-center backdrop-blur-sm transition hover:bg-white/[0.05]">
                  <StatIcon className="mx-auto h-6 w-6 text-cyan-400" />
                  <div className="mt-2 text-3xl font-bold text-white sm:text-4xl">{stat.value}</div>
                  <div className="mt-1 text-xs text-slate-500">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-cyan-500/5 to-blue-600/5 p-10 sm:p-16">
            <div className="absolute right-8 top-8">
              <Target className="h-32 w-32 text-cyan-500/10" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Наша миссия</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
              Сделать управление рестораном простым, прозрачным и эффективным.
              Мы создаём инструменты, которые помогают рестораторам сосредоточиться на главном — на гостях и качестве блюд.
            </p>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="border-t border-white/5 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">Наш путь</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-400">Как мы выросли от идеи до платформы №1</p>
          <div className="mt-14 space-y-8">
            {timeline.map((item, i) => (
              <div key={item.year} className="group relative flex gap-6 sm:gap-10">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white shadow-lg shadow-cyan-500/20">
                    {item.year.slice(2)}
                  </div>
                  {i < timeline.length - 1 && <div className="mt-2 w-px flex-1 bg-gradient-to-b from-cyan-500/30 to-transparent" />}
                </div>
                <div className="pb-8">
                  <div className="text-xs font-semibold text-cyan-400">{item.year}</div>
                  <h3 className="mt-1 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-white/5 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">Наши ценности</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-400">Четыре принципа, на которых строится каждый продукт FoodChain</p>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((item) => (
              <div key={item.title} className="group rounded-2xl border border-white/5 bg-white/[0.03] p-8 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:bg-white/[0.05]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 transition-all group-hover:from-cyan-500 group-hover:to-blue-600 group-hover:text-white">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-white/5 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">Команда</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-400">Талантливые люди, стоящие за FoodChain</p>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <div key={member.name} className="group rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-center backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:bg-white/[0.05]">
                <div className="mx-auto h-24 w-24 overflow-hidden rounded-full ring-2 ring-cyan-500/20 transition-all group-hover:ring-cyan-500/40">
                  <img src={member.image} alt={member.name} className="h-full w-full object-cover" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">{member.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-white/5 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">Отзывы</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-400">Что говорят наши клиенты</p>
          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 backdrop-blur-sm">
                <Quote className="h-8 w-8 text-cyan-500/30 mb-4" />
                <p className="text-sm leading-relaxed text-slate-300">{t.text}</p>
                <div className="mt-6 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-cyan-400 text-cyan-400" />
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="border-t border-white/5 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">Партнёры</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-400">Компании, которые доверяют FoodChain</p>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-6">
            {partners.map((partner) => (
              <div key={partner} className="flex h-16 w-40 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] px-6 text-sm font-semibold tracking-wide text-slate-500 transition-all hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-white/[0.05]">
                {partner}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Map / Offices */}
      <section className="border-t border-white/5 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 backdrop-blur-sm">
              <MapPin className="h-8 w-8 text-cyan-400 mb-4" />
              <h3 className="text-lg font-semibold text-white">Головной офис</h3>
              <p className="mt-2 text-sm text-slate-400">г. Москва, ул. Тверская, д. 1<br />БЦ «Галерея», 5 этаж</p>
              <p className="mt-1 text-sm text-slate-500">Пн-Пт: 9:00–20:00</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 backdrop-blur-sm">
              <MapPin className="h-8 w-8 text-cyan-400 mb-4" />
              <h3 className="text-lg font-semibold text-white">Офис разработки</h3>
              <p className="mt-2 text-sm text-slate-400">г. Санкт-Петербург, ул. Ленина, д. 25<br />БЦ «Невский», 12 этаж</p>
              <p className="mt-1 text-sm text-slate-500">Пн-Пт: 10:00–19:00</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Готовы автоматизировать ваш ресторан?</h2>
          <p className="mt-4 text-lg text-slate-400">Оставьте заявку — и мы покажем, как FoodChain может изменить ваш бизнес</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105"
            >
              Оставить заявку
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
            >
              Узнать больше
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
