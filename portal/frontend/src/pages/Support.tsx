import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, ChevronDown, ChevronUp, MessageCircle, FileText, Mail, Phone, Clock, BookOpen, HelpCircle, ExternalLink, ArrowRight, Play, Users, Shield, Zap, Star } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FaqItem[] = [
  { category: 'Начало работы', question: 'Как зарегистрироваться в FoodChain?', answer: 'Нажмите «Попробовать бесплатно» на главной странице, заполните форму регистрации и подтвердите email. После этого вы получите доступ к 14-дневному пробному периоду со всеми функциями тарифа «Профессиональный».' },
  { category: 'Начало работы', question: 'Сколько времени занимает настройка?', answer: 'Базовая настройка занимает от 1 до 3 часов. Полное внедрение со всеми интеграциями — от 1 до 3 дней. Наши менеджеры помогут на каждом этапе.' },
  { category: 'Начало работы', question: 'Как добавить сотрудников в систему?', answer: 'В разделе «Персонал» админ-панели нажмите «Добавить сотрудника», заполните данные и назначьте роль. Сотрудник получит приглашение на email.' },
  { category: 'Тарифы', question: 'Могу ли я сменить тариф?', answer: 'Да, вы можете перейти на другой тариф в любое время. Изменения вступят в силу с начала следующего расчётного периода. Все ваши данные останутся сохранены.' },
  { category: 'Тарифы', question: 'Есть ли скидка при оплате за год?', answer: 'Да, при оплате за год мы предоставляем скидку до 25%. Вы также можете начать с бесплатного 14-дневного пробного периода.' },
  { category: 'Тарифы', question: 'Что входит в бесплатный пробный период?', answer: 'В пробный период вам доступны все функции тарифа «Профессиональный» без ограничений. Через 14 дней вы сможете выбрать подходящий тариф.' },
  { category: 'Интеграции', question: 'Как подключить Яндекс.Еду?', answer: 'В разделе «Интеграции» выберите Яндекс.Еда, авторизуйтесь в аккаунте агрегатора и подтвердите подключение. Занимает 5–10 минут.' },
  { category: 'Интеграции', question: 'Работает ли FoodChain с 1С?', answer: 'Да, мы поддерживаем двустороннюю интеграцию с 1С: данные о заказах, ингредиентах и финансах синхронизируются автоматически.' },
  { category: 'Интеграции', question: 'Какие платёжные системы поддерживаются?', answer: 'Мы поддерживаем СБП (QR), банковские карты (Visa, Mastercard, Мир), Apple Pay, Google Pay и наличные в заведении.' },
  { category: 'Устройства', question: 'Какие принтеры поддерживаются?', answer: 'Мы поддерживаем фискальные регистраторы и принтеры чеков Атол, Штрих-М, Viki Print, Epson и другие. Полный список в документации.' },
  { category: 'Устройства', question: 'Можно ли использовать планшеты для официантов?', answer: 'Да, приложение официанта работает на любых планшетах с современным браузером. Мы рекомендуем iPad или Android планшеты с экраном от 10".' },
  { category: 'Устройства', question: 'Какие требования к интернету?', answer: 'Для стабильной работы рекомендуется скорость от 5 Мбит/с. В случае потери связи система продолжает работать в офлайн-режиме.' },
];

const categories = ['Все', 'Начало работы', 'Тарифы', 'Интеграции', 'Устройства'];
const guides = [
  { icon: Play, title: 'Видео-инструкции', desc: 'Пошаговые видео по настройке и работе', count: '12 видео' },
  { icon: FileText, title: 'Документация', desc: 'Полная техническая документация API', count: '200+ страниц' },
  { icon: BookOpen, title: 'База знаний', desc: 'Статьи и ответы на частые вопросы', count: '150+ статей' },
  { icon: Users, title: 'Обучение', desc: 'Индивидуальное обучение для команд', count: 'доступно' },
];

export function Support() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Все');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filtered = faqs.filter((faq) => {
    const matchCat = activeCategory === 'Все' || faq.category === activeCategory;
    const matchSearch = !searchQuery || faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-20 sm:pb-28 sm:pt-28">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_top_right,_rgba(0,180,216,0.12),transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-cyan-500/20">
            Поддержка
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Центр поддержки
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            База знаний, документация и служба поддержки 24/7
          </p>
          <div className="mx-auto mt-10 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="text" placeholder="Поиск по вопросам и статьям..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-4 pl-12 pr-4 text-base text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-5xl grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {guides.map((guide) => {
            const GuideIcon = guide.icon;
            return (
              <a key={guide.title} href="#" className="group rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:bg-white/[0.05]">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 group-hover:from-cyan-500 group-hover:to-blue-600 group-hover:text-white transition-all">
                  <GuideIcon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">{guide.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{guide.desc}</p>
                <span className="mt-3 inline-block text-[11px] text-cyan-400">{guide.count} →</span>
              </a>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/5 px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-center gap-3 mb-10">
            <HelpCircle className="h-6 w-6 text-cyan-400" />
            <h2 className="text-2xl font-bold tracking-tight text-white">Часто задаваемые вопросы</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto mb-8 pb-1 justify-center flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat} onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition ${
                  activeCategory === cat
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/[0.05] text-slate-400 border border-white/5 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map((faq, i) => (
              <div
                key={i}
                className={`rounded-xl border transition-all ${
                  openFaq === i ? 'border-cyan-500/30 bg-white/[0.03]' : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-cyan-400 font-medium">{faq.category}</span>
                    <span className="text-sm font-medium text-white">{faq.question}</span>
                  </div>
                  {openFaq === i ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-cyan-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="border-t border-white/5 px-6 pb-5 pt-3">
                    <p className="text-sm leading-relaxed text-slate-400">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-10">
                <Search className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2 text-sm text-slate-500">Ничего не найдено</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="border-t border-white/5 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">Не нашли ответ?</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-400">Наша служба поддержки работает 24/7 и готова помочь</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <a href="mailto:support@foodchain.ru" className="group rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:bg-white/[0.05] text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 mx-auto">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">Email</h3>
              <p className="mt-1 text-xs text-slate-400">support@foodchain.ru</p>
              <p className="mt-2 text-[11px] text-cyan-400 group-hover:text-cyan-300">Ответ до 2 часов</p>
            </a>
            <a href="tel:88001234567" className="group rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:bg-white/[0.05] text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 mx-auto">
                <Phone className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">Телефон</h3>
              <p className="mt-1 text-xs text-slate-400">8 (800) 123-45-67</p>
              <p className="mt-2 text-[11px] text-cyan-400 group-hover:text-cyan-300">Звонок бесплатный</p>
            </a>
            <Link to="/contact" className="group rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:bg-white/[0.05] text-center sm:col-span-2 lg:col-span-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 mx-auto">
                <MessageCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">Форма обратной связи</h3>
              <p className="mt-1 text-xs text-slate-400">Напишите нам онлайн</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-cyan-400 group-hover:text-cyan-300">Перейти к форме <ArrowRight className="h-3 w-3" /></span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
