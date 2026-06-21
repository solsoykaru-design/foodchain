import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, ChefHat } from 'lucide-react';
import * as api from '../../api';

interface ChatMessage {
  id: number;
  from: 'waiter' | 'kitchen';
  text: string;
  timestamp: string;
  orderId?: number;
}

const QUICK_MSGS = [
  'Замените картофель на рис',
  'Соус отдельно, пожалуйста',
  'Без лука',
  'Средняя прожарка',
  'Уберите острое',
  'Добавьте зелени',
  'Порцию побольше',
];

export default function KitchenChat({ orderId }: { orderId?: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const unsub = api.onEvent('kitchen:chat', (data: ChatMessage) => {
      setMessages(prev => [...prev, data]);
    });
    return unsub;
  }, []);

  const send = () => {
    if (!text.trim()) return;
    const msg: ChatMessage = {
      id: Date.now(),
      from: 'waiter',
      text: text.trim(),
      timestamp: new Date().toISOString(),
      orderId,
    };
    setMessages(prev => [...prev, msg]);
    api.request('/api/kitchen/chat', {
      method: 'POST',
      body: JSON.stringify(msg),
    }).catch(() => {});
    setText('');
  };

  return (
    <div className="pb-28 px-4 pt-4">
      <h2 className="text-lg font-extrabold text-white mb-4 flex items-center gap-2">
        <MessageSquare size={20} className="text-orange-500" /> Чат с кухней
      </h2>

      {/* Quick messages */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3">
        {QUICK_MSGS.map(msg => (
          <button key={msg} onClick={() => { setText(msg); }}
            className="px-3 py-1.5 bg-zinc-800 rounded-full text-xs text-zinc-300 whitespace-nowrap font-semibold active:bg-zinc-700">
            {msg}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.from === 'waiter' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.from === 'waiter' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-200'}`}>
              <div className="flex items-center gap-1 mb-0.5">
                {msg.from === 'kitchen' && <ChefHat size={12} />}
                <span className="text-[10px] opacity-70">{msg.from === 'waiter' ? 'Вы' : 'Кухня'}</span>
                {msg.orderId && <span className="text-[10px] opacity-50">· Заказ #{msg.orderId}</span>}
              </div>
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 bg-zinc-900 rounded-xl px-3 py-2 ring-1 ring-zinc-800">
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Сообщение..."
          className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" />
        <button onClick={send} disabled={!text.trim()}
          className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white disabled:opacity-40">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
