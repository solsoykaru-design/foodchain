import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Phone, MessageCircle, MapPin, Package } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';
import * as api from '../../api';

const STATUS_LABELS: Record<string, string> = {
  new: 'Заказ создан', confirmed: 'Подтверждён', preparing: 'Готовится',
  ready: 'Готов к выдаче', assigned: 'Назначен курьер', en_route: 'В пути',
  delivered: 'Доставлен', cancelled: 'Отменён',
};

const STATUS_ORDER = ['new', 'confirmed', 'preparing', 'ready', 'assigned', 'en_route', 'delivered'];

export default function OrderTrackingPage() {
  const ctx = useWebsite();
  const orderId = ctx.selectedDishData?.orderId;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgText, setMsgText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    const fetchOrder = async () => {
      try {
        const data = await api.get(`/api/orders/${orderId}/tracking`);
        setOrder(data);
      } catch {}
      setLoading(false);
    };
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    api.get(`/api/orders/${orderId}/chat`).then(setMessages).catch(() => {});
    const interval = setInterval(() => {
      api.get(`/api/orders/${orderId}/chat`).then(setMessages).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [orderId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!msgText.trim() || !orderId) return;
    try {
      await api.post(`/api/orders/${orderId}/chat`, { text: msgText });
      setMsgText('');
      const msgs = await api.get(`/api/orders/${orderId}/chat`);
      setMessages(msgs);
    } catch {}
  };

  if (!orderId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Package size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-bold mb-2">Нет активного заказа</h2>
        <p className="text-[var(--color-text-secondary)] mb-6">Сделайте заказ, чтобы отслеживать его статус</p>
        <button onClick={() => ctx.setPage('menu')} className="text-[var(--color-primary)] font-medium">Перейти в меню</button>
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-400">Загрузка...</div>;
  }

  if (!order) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-400">Заказ не найден</div>;
  }

  const currentIdx = STATUS_ORDER.indexOf(order.status);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Заказ #{order.id}</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">{STATUS_LABELS[order.status] || order.status}</p>

      {/* Timeline */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
        <div className="space-y-0">
          {STATUS_ORDER.map((s, i) => {
            const done = i <= currentIdx;
            const isCancelled = order.status === 'cancelled';
            return (
              <div key={s} className="flex items-start gap-3 pb-3 last:pb-0">
                <div className="flex flex-col items-center">
                  {done && !isCancelled ? (
                    <CheckCircle2 size={20} className="text-green-500" />
                  ) : (
                    <Circle size={20} className={i === currentIdx ? 'text-[var(--color-primary)]' : 'text-gray-300'} />
                  )}
                  {i < STATUS_ORDER.length - 1 && <div className={`w-0.5 h-6 ${done && !isCancelled ? 'bg-green-500' : 'bg-gray-200'}`} />}
                </div>
                <div>
                  <p className={`text-sm font-medium ${done && !isCancelled ? 'text-green-700' : i === currentIdx ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}>
                    {STATUS_LABELS[s]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order info */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
        <h3 className="font-semibold mb-3">Детали заказа</h3>
        <div className="text-sm space-y-1.5 text-[var(--color-text-secondary)]">
          <p><strong>Сумма:</strong> {order.total} ₽</p>
          {order.address && <p><strong>Адрес:</strong> {order.address}</p>}
          {order.comment && <p><strong>Комментарий:</strong> {order.comment}</p>}
          <p><strong>Создан:</strong> {new Date(order.createdAt).toLocaleString('ru-RU')}</p>
        </div>
        <div className="mt-3 space-y-1.5">
          {(order.items || []).map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.name} × {item.quantity}</span>
              <span className="font-medium">{item.price * item.quantity} ₽</span>
            </div>
          ))}
        </div>
      </div>

      {/* Courier info */}
      {order.courierName && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4 shadow-sm">
          <h3 className="font-semibold mb-3">Курьер</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{order.courierName}</p>
              {order.courierPhone && <p className="text-sm text-[var(--color-text-secondary)]">{order.courierPhone}</p>}
            </div>
            <div className="flex gap-2">
              {order.courierPhone && (
                <a href={`tel:${order.courierPhone}`} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors">
                  <Phone size={14} /> Позвонить
                </a>
              )}
              <button onClick={() => setChatOpen(!chatOpen)}
                className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-[var(--color-primary)] rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors">
                <MessageCircle size={14} /> Чат
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      {chatOpen && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-3">Чат с курьером</h3>
          <div className="h-48 overflow-y-auto mb-3 space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50">
            {messages.length === 0 && <p className="text-center text-xs text-gray-400 py-8">Нет сообщений</p>}
            {messages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.fromAdmin || msg.senderType === 'admin' || msg.senderType === 'courier' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${msg.fromAdmin || msg.senderType === 'admin' || msg.senderType === 'courier' ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-800 border border-gray-200'}`}>
                  {msg.text || msg.message}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2">
            <input value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Сообщение..." className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:border-[var(--color-primary)] outline-none transition-colors" />
            <button onClick={sendMessage} className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:brightness-110 transition-colors">Отправить</button>
          </div>
        </div>
      )}

      {/* Repeat order */}
      {order.status === 'delivered' && (
        <button onClick={() => ctx.setPage('menu')} className="w-full mt-4 py-3 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-700 transition-colors">
          Повторить заказ
        </button>
      )}
    </div>
  );
}
