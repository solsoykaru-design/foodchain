import { Link } from 'react-router-dom';
import { User, Target, Award, Heart, Check } from 'lucide-react';

const stats = [
  { value: '500+', label: 'Ресторанов' },
  { value: '50K+', label: 'Заказов в месяц' },
  { value: '6', label: 'Сервисов' },
  { value: '24/7', label: 'Поддержка' },
];

const team = [
  { name: 'Иван Петров', role: 'Основатель и CEO' },
  { name: 'Анна Смирнова', role: 'Технический директор' },
  { name: 'Михаил Орлов', role: 'Руководитель разработки' },
  { name: 'Елена Козлова', role: 'Директор по продукту' },
];

const values = [
  { icon: Target, title: 'Миссия', text: 'Сделать управление рестораном простым, прозрачным и эффективным' },
  { icon: Award, title: 'Качество', text: 'Мы стремимся к безупречному качеству каждого заказа' },
  { icon: Heart, title: 'Забота', text: 'Ставим интересы ресторанов и их гостей на первое место' },
  { icon: Check, title: 'Надёжность', text: 'Обеспечиваем стабильную работу 24 часа в сутки, 7 дней в неделю' },
];

const partners = ['RestoSoft', 'iiko', 'QuickResto', 'Yandex', 'Sber', 'Tinkoff'];

export function About() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 px-6 py-24 text-white sm:py-32">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              О компании FoodChain
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-emerald-50 sm:text-xl">
              Мы помогаем ресторанам автоматизировать бизнес — от управления заказами до аналитики продаж.
              FoodChain — это экосистема инструментов для современного ресторанного бизнеса.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-emerald-700 shadow-lg transition hover:bg-emerald-50"
              >
                Связаться с нами
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400 px-6 py-3 font-semibold text-white transition hover:bg-emerald-600"
              >
                Наши сервисы
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 p-10 shadow-sm sm:p-16">
            <Target className="absolute right-8 top-8 h-32 w-32 text-emerald-200" />
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Наша миссия
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
              Наша миссия — сделать управление рестораном простым, прозрачным и эффективным.
              Мы создаём инструменты, которые помогают рестораторам сосредоточиться на главном — на гостях и качестве блюд.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-bold tracking-tight text-emerald-600 sm:text-5xl">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm font-medium text-gray-500 sm:text-base">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Наши ценности
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-gray-500">
            Четыре принципа, на которых строится каждый продукт FoodChain
          </p>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((item) => (
              <div
                key={item.title}
                className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-gray-50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Команда
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-gray-500">
            Талантливые люди, стоящие за FoodChain
          </p>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <div
                key={member.name}
                className="group rounded-2xl bg-white p-8 text-center shadow-sm transition hover:shadow-lg"
              >
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 shadow-inner">
                  <User className="h-10 w-10" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-gray-900">{member.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Партнёры
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-gray-500">
            Компании, которые доверяют FoodChain
          </p>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-10 sm:gap-16">
            {partners.map((partner) => (
              <div
                key={partner}
                className="flex h-16 w-36 items-center justify-center rounded-xl border border-gray-200 bg-white px-6 text-sm font-semibold tracking-wide text-gray-400 shadow-sm transition hover:border-emerald-300 hover:text-emerald-600"
              >
                {partner}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Готовы автоматизировать ваш ресторан?
          </h2>
          <p className="mt-4 text-lg text-emerald-50">
            Оставьте заявку — и мы покажем, как FoodChain может изменить ваш бизнес
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-emerald-700 shadow-lg transition hover:bg-emerald-50"
            >
              Оставить заявку
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400 px-8 py-4 font-semibold text-white transition hover:bg-emerald-600"
            >
              Узнать больше
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
