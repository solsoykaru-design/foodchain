import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Clock, Send, MessageSquare } from 'lucide-react';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Спасибо! Мы свяжемся с вами в ближайшее время.');
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 py-24 px-4">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight text-white md:text-6xl">
            Свяжитесь с нами
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-amber-100/90">
            Мы всегда готовы ответить на ваши вопросы и принять предложения.
            Напишите нам, и мы свяжемся с вами в ближайшее время.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm lg:p-10">
              <div className="mb-8 flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-amber-600" />
                <h2 className="text-2xl font-semibold text-gray-900">Напишите нам</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Имя
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Ваше имя"
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.ru"
                      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Телефон
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+7 (999) 123-45-67"
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Тема обращения
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">Выберите тему</option>
                    <option value="booking">Бронирование</option>
                    <option value="menu">Меню и доставка</option>
                    <option value="feedback">Отзыв и предложения</option>
                    <option value="career">Вакансии</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Сообщение
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Ваше сообщение..."
                    className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-8 py-3 font-medium text-white transition-colors hover:bg-amber-700"
                >
                  <Send className="h-4 w-4" />
                  Отправить
                </button>
              </form>
            </div>
          </div>

          {/* Info Cards */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm lg:p-10">
              <h2 className="mb-8 text-2xl font-semibold text-gray-900">Контактная информация</h2>
              <div className="space-y-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <Mail className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <a href="mailto:support@foodchain.ru" className="text-gray-900 transition-colors hover:text-amber-600">
                      support@foodchain.ru
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <Phone className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Телефон</p>
                    <a href="tel:88001234567" className="text-gray-900 transition-colors hover:text-amber-600">
                      8 (800) 123-45-67
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <MapPin className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Адрес</p>
                    <p className="text-gray-900">г. Москва, ул. Тверская, д. 1</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Часы работы</p>
                    <p className="text-gray-900">Пн-Пт: 9:00–20:00</p>
                    <p className="text-gray-900">Сб-Вс: 10:00–18:00</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Placeholder */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="flex h-80 items-center justify-center rounded-2xl bg-gray-100 lg:h-96">
          <div className="text-center">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="text-lg font-medium text-gray-500">Карта проезда</p>
            <p className="text-sm text-gray-400">г. Москва, ул. Тверская, д. 1</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-amber-900 to-amber-800 px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
            Станьте частью FoodChain
          </h2>
          <p className="mb-8 text-lg text-amber-100/90">
            Откройте ресторан под брендом FoodChain или предложите сотрудничество.
          </p>
          <Link
            to="/"
            className="inline-block rounded-lg bg-white px-10 py-3.5 font-semibold text-amber-900 transition-colors hover:bg-amber-50"
          >
            Вернуться на главную
          </Link>
        </div>
      </section>
    </div>
  );
}
