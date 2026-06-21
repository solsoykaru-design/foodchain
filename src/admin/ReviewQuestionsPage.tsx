import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { MessageSquare, X, MessageCircle } from 'lucide-react';

export default function ReviewQuestionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerId, setAnswerId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.request('/api/review-questions');
      setItems(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submitAnswer = async () => {
    if (!answerText.trim()) return addToast('Введите ответ', 'error');
    try {
      await api.request(`/api/review-questions/${answerId}/answer`, {
        method: 'PATCH',
        body: JSON.stringify({ answer: answerText.trim() }),
      });
      setAnswerId(null);
      setAnswerText('');
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
          <MessageSquare size={22} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Вопросы и ответы</h1>
          <p className="text-sm text-zinc-500">Управление вопросами от гостей</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Загрузка...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Вопрос</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Ответ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Пользователь</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Дата</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200 font-medium max-w-xs">{item.question}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-xs">
                    {item.answer ? (
                      <span className="text-green-600 dark:text-green-400">{item.answer}</span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600 italic">Нет ответа</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{item.userName || item.user_name || '—'}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-nowrap">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!item.answer && (
                      <button onClick={() => { setAnswerId(item.id); setAnswerText(''); }}
                        className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100 dark:hover:bg-green-900/40 active:scale-[0.97] transition-all">
                        <MessageCircle size={14} /> Ответить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-zinc-400">Нет вопросов</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {answerId !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAnswerId(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Ответить на вопрос</h3>
              <button onClick={() => setAnswerId(null)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500">Вопрос</label>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  {items.find(i => i.id === answerId)?.question || ''}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Ваш ответ</label>
                <textarea value={answerText} onChange={e => setAnswerText(e.target.value)} rows={4}
                  className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mt-1" />
              </div>
              <button onClick={submitAnswer}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-700 active:scale-[0.97] transition-all">
                Отправить ответ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
