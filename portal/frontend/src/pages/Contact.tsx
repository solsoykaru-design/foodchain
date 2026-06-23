import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Clock, Send, MessageSquare, ArrowRight, Check, Github, Twitter, Instagram } from 'lucide-react';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 sm:py-32">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_top_right,_rgba(0,180,216,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_bottom_left,_rgba(0,150,200,0.06),transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-cyan-500/20">
            Контакты
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Свяжитесь с нами
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            Мы всегда готовы ответить на ваши вопросы и принять предложения.
            Напишите нам, и мы свяжемся с вами в ближайшее время.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 backdrop-blur-sm lg:p-10">
              <div className="mb-8 flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-cyan-400" />
                <h2 className="text-2xl font-semibold text-white">Напишите нам</h2>
              </div>
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-6">
                    <Check className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">Спасибо!</h3>
                  <p className="mt-2 text-sm text-slate-400">Мы свяжемся с вами в ближайшее время.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-400">Имя</label>
                      <input
                        id="name" name="name" type="text" required
                        value={formData.name} onChange={handleChange}
                        placeholder="Ваше имя"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-400">Email</label>
                      <input
                        id="email" name="email" type="email" required
                        value={formData.email} onChange={handleChange}
                        placeholder="your@email.ru"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-slate-400">Телефон</label>
                    <input
                      id="phone" name="phone" type="tel"
                      value={formData.phone} onChange={handleChange}
                      placeholder="+7 (999) 123-45-67"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-slate-400">Тема обращения</label>
                    <select
                      id="subject" name="subject" required
                      value={formData.subject} onChange={handleChange}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 text-white outline-none transition-colors focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    >
                      <option value="" className="bg-[#0a1628]">Выберите тему</option>
                      <option value="demo" className="bg-[#0a1628]">Запрос демонстрации</option>
                      <option value="support" className="bg-[#0a1628]">Техподдержка</option>
                      <option value="partnership" className="bg-[#0a1628]">Сотрудничество</option>
                      <option value="career" className="bg-[#0a1628]">Вакансии</option>
                      <option value="other" className="bg-[#0a1628]">Другое</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-400">Сообщение</label>
                    <textarea
                      id="message" name="message" required rows={5}
                      value={formData.message} onChange={handleChange}
                      placeholder="Ваше сообщение..."
                      className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105"
                  >
                    <Send className="h-4 w-4" />
                    Отправить
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Info Cards */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 backdrop-blur-sm lg:p-10">
              <h2 className="mb-8 text-2xl font-semibold text-white">Контактная информация</h2>
              <div className="space-y-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20">
                    <Mail className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Email</p>
                    <a href="mailto:support@foodchain.ru" className="text-white transition-colors hover:text-cyan-400">
                      support@foodchain.ru
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20">
                    <Phone className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Телефон</p>
                    <a href="tel:88001234567" className="text-white transition-colors hover:text-cyan-400">
                      8 (800) 123-45-67
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20">
                    <MapPin className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Головной офис</p>
                    <p className="text-white">г. Москва, ул. Тверская, д. 1</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20">
                    <Clock className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Часы работы</p>
                    <p className="text-white">Пн-Пт: 9:00–20:00</p>
                    <p className="text-white">Сб-Вс: 10:00–18:00</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-8 backdrop-blur-sm lg:p-10">
              <h2 className="mb-6 text-2xl font-semibold text-white">Мы в соцсетях</h2>
              <div className="grid grid-cols-3 gap-3">
                <a href="#" className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-5 text-sm text-slate-400 transition-all hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-white/[0.05]">
                  <Github className="h-6 w-6" />
                  <span>GitHub</span>
                </a>
                <a href="#" className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-5 text-sm text-slate-400 transition-all hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-white/[0.05]">
                  <Twitter className="h-6 w-6" />
                  <span>Twitter</span>
                </a>
                <a href="#" className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-5 text-sm text-slate-400 transition-all hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-white/[0.05]">
                  <Instagram className="h-6 w-6" />
                  <span>Instagram</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="flex h-80 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] lg:h-96">
          <div className="text-center">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-cyan-400" />
            <p className="text-lg font-medium text-white">Карта проезда</p>
            <p className="text-sm text-slate-500">г. Москва, ул. Тверская, д. 1</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">Станьте частью FoodChain</h2>
          <p className="mb-8 text-lg text-slate-400">
            Откройте ресторан под брендом FoodChain или предложите сотрудничество.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-10 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105"
            >
              Начать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-10 py-3.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
            >
              Вернуться на главную
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
