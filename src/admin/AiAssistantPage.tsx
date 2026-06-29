import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, Loader2, Lightbulb, Mic, Square } from 'lucide-react';
import * as api from '../api';
import { addToast } from '../ToastContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  source?: string;
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Привет! Я AI-ассистент управляющего. Спросите меня о продажах, складе, заказах, персонале или финансах.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isSpeechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    api.getAiSuggestions().then(setSuggestions).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopRecording = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setRecording(false);
  };

  const toggleRecording = () => {
    if (!isSpeechSupported) {
      addToast('Голосовой ввод не поддерживается браузером', 'error');
      return;
    }
    if (recording) {
      stopRecording();
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'ru-RU';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => setRecording(true);
    rec.onend = () => setRecording(false);
    rec.onerror = () => { setRecording(false); addToast('Ошибка распознавания голоса', 'error'); };
    rec.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setInput(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        stopRecording();
        setTimeout(() => {
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          handleSubmit(fakeEvent, transcript);
        }, 100);
      }
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const handleSubmit = async (e: React.FormEvent, forcedText?: string) => {
    e.preventDefault();
    const text = (forcedText ?? input).trim();
    if (!text || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await api.aiChat(text, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer || 'Нет ответа', source: res.source }]);
    } catch (err: any) {
      addToast(err.message || 'Ошибка', 'error');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Произошла ошибка. Попробуйте позже.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center">
          <Bot className="text-white" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">AI-ассистент</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Вопросы о продажах, складе и персонале</p>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${m.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-none'}`}>
                {m.content}
                {m.source && <div className="mt-1 text-[10px] opacity-60">источник: {m.source}</div>}
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-zinc-600 dark:text-zinc-300" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-none px-4 py-3">
                <Loader2 size={18} className="animate-spin text-zinc-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {suggestions.length > 0 && messages.length === 1 && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2"><Lightbulb size={14} /> Идеи для запроса:</div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => { setInput(s); }} className="text-xs px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={recording ? 'Слушаю...' : 'Задайте вопрос...'}
            className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {isSpeechSupported && (
            <button
              type="button"
              onClick={toggleRecording}
              className={`px-4 py-3 rounded-xl text-white transition-all flex items-center gap-2 ${recording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600'}`}
              title={recording ? 'Остановить запись' : 'Голосовой ввод'}
            >
              {recording ? <Square size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-3 rounded-xl bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
