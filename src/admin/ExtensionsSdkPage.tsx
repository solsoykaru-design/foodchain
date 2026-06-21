import { useState } from 'react';
import { Puzzle, Code, BookOpen, Terminal, Shield, Zap, Webhook, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { addToast } from '../ToastContext';

export default function ExtensionsSdkPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);
  const [hookSecret] = useState(() => 'hook_' + Math.random().toString(36).substring(2, 10));

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      addToast('Скопировано', 'success');
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const events = [
    { event: 'order.created', description: 'Новый заказ создан', payload: '{ orderId, items, total, user }' },
    { event: 'order.status_changed', description: 'Статус заказа изменился', payload: '{ orderId, from, to }' },
    { event: 'order.paid', description: 'Заказ оплачен', payload: '{ orderId, amount, method }' },
    { event: 'dish.ready', description: 'Блюдо готово', payload: '{ orderId, dishId, name }' },
    { event: 'review.created', description: 'Новый отзыв', payload: '{ reviewId, rating, text }' },
    { event: 'booking.created', description: 'Новая бронь', payload: '{ bookingId, date, time, guests }' },
    { event: 'user.registered', description: 'Гость зарегистрировался', payload: '{ userId, name, phone }' },
    { event: 'inventory.low_stock', description: 'Закончился складской запас', payload: '{ itemId, name, stock }' },
  ];

  const endpoints = [
    { method: 'GET', path: '/api/extensions/:id/data', auth: 'API Key in header', description: 'Получить данные плагина' },
    { method: 'POST', path: '/api/extensions/:id/webhook', auth: 'Hook Secret', description: 'Отправить событие в плагин' },
    { method: 'GET', path: '/api/extensions/:id/settings', auth: 'API Key', description: 'Настройки плагина' },
    { method: 'PUT', path: '/api/extensions/:id/settings', auth: 'API Key', description: 'Обновить настройки' },
  ];

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Puzzle size={24} /> SDK для разработчиков</h1>

      {/* Getting Started */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700 mb-6">
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><BookOpen size={18} /> Быстрый старт</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Создайте своё расширение для FoodChain. Плагины работают через Webhook-уведомления и API.
          После установки плагин получает уникальный Hook Secret для аутентификации.
        </p>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 font-mono text-xs relative">
          <div className="absolute top-2 right-2">
            <button onClick={() => copyText(`curl -X POST https://your-server.com/api/extensions/my-plugin/webhook \\\n  -H "X-Hook-Secret: ${hookSecret}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"event":"order.created","data":{"orderId":123}}'`, 'curl')}
              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
              {copied === 'curl' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>
          <pre className="text-zinc-300 text-left">{`$ npm install @foodchain/plugin-sdk

const foodchain = require('@foodchain/plugin-sdk');

foodchain.on('order.created', async (data) => {
  console.log('New order:', data.orderId);
  // Ваша логика
});

foodchain.listen(process.env.PORT || 3000);`}</pre>
        </div>
      </div>

      {/* Events / Hooks */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700 mb-6">
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Zap size={18} /> Система событий (Hooks)</h2>
        <p className="text-sm text-zinc-400 mb-4">Плагин подписывается на события через Hook Secret. При наступлении события FoodChain отправляет POST-запрос на endpoint плагина.</p>
        <div className="grid gap-2">
          {events.map((ev, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-sm">
              <span className="text-blue-500 font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 shrink-0">{ev.event}</span>
              <span className="flex-1 text-zinc-400">{ev.description}</span>
              <span className="text-xs text-zinc-500 font-mono hidden md:block">{ev.payload}</span>
            </div>
          ))}
        </div>
      </div>

      {/* API Endpoints */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700 mb-6">
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Terminal size={18} /> API для плагинов</h2>
        <p className="text-sm text-zinc-400 mb-4">Плагины могут получать доступ к данным через защищённые API-эндпоинты.</p>
        <div className="space-y-2">
          {endpoints.map((ep, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-sm">
              <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${ep.method === 'GET' ? 'bg-green-50 dark:bg-green-900/20 text-green-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'}`}>{ep.method}</span>
              <span className="font-mono text-xs flex-1">{ep.path}</span>
              <span className="text-xs text-zinc-500">{ep.auth}</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <p className="text-xs text-zinc-400 mb-2">Ваш Hook Secret (для аутентификации):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs font-mono">{hookSecret}</code>
            <button onClick={() => copyText(hookSecret, 'secret')} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
              {copied === 'secret' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700 mb-6">
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Shield size={18} /> Изоляция и безопасность</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
            <p className="font-bold mb-1">🔒 Ограниченный доступ</p>
            <p className="text-xs text-zinc-400">Плагин видит только данные своего tenant_id. API-ключи и пароли скрыты.</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
            <p className="font-bold mb-1">⏱ Таймауты</p>
            <p className="text-xs text-zinc-400">Webhook-вызовы имеют таймаут 5 секунд. Медленные плагины не блокируют систему.</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
            <p className="font-bold mb-1">📝 Аудит</p>
            <p className="text-xs text-zinc-400">Все действия плагинов логируются. Можно отключить любой плагин в панели.</p>
          </div>
        </div>
      </div>

      {/* Example */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
        <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Code size={18} /> Пример плагина (Node.js)</h2>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 font-mono text-xs relative">
          <button onClick={() => copyText(
`const express = require('express');
const app = express();
app.use(express.json());

const HOOK_SECRET = process.env.HOOK_SECRET;

// Проверка подписи
app.use((req, res, next) => {
  if (req.headers['x-hook-secret'] !== HOOK_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Обработчик новых заказов
app.post('/webhook', (req, res) => {
  const { event, data } = req.body;
  console.log('Event:', event, 'Data:', data);
  // Логика плагина
  res.json({ ok: true });
});

app.listen(3000);`, 'example')} className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition float-right">
            {copied === 'example' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <pre className="text-zinc-300">{`const express = require('express');
const app = express();
app.use(express.json());

const HOOK_SECRET = process.env.HOOK_SECRET;

// Проверка подписи
app.use((req, res, next) => {
  if (req.headers['x-hook-secret'] !== HOOK_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Обработчик новых заказов
app.post('/webhook', (req, res) => {
  const { event, data } = req.body;
  console.log('Event:', event, 'Data:', data);
  // Ваша логика
  res.json({ ok: true });
});

app.listen(3000);`}</pre>
        </div>
      </div>
    </div>
  );
}
