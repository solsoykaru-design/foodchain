import { useState, useEffect } from 'react';
import * as api from '../api';
import { addToast } from '../ToastContext';
import { MessageSquare, Star, User, Reply, X, Image as ImageIcon, Search, ThumbsUp, ThumbsDown } from 'lucide-react';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [showPhoto, setShowPhoto] = useState<string | null>(null);

  const load = async () => {
    try {
      const [r, p] = await Promise.all([api.getAllReviews(), api.getReviewPhotos()]);
      setReviews(r);
      setPhotos(p);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const sendReply = async (id: number) => {
    if (!replyText[id]?.trim()) return;
    try {
      await api.replyToReview(id, replyText[id]);
      setReplyText(prev => ({ ...prev, [id]: '' }));
      load();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const filtered = reviews.filter((r: any) =>
    r.userName?.toLowerCase().includes(search.toLowerCase()) ||
    r.text?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Отзывы</h2>
          <p className="text-sm text-zinc-500 mt-1">Всего: {reviews.length}</p>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по отзывам..." className="border-2 border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
        </div>
      </div>

      {photos.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2"><ImageIcon size={16} /> Фото от гостей</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {photos.map((p: any, i: number) => (
              <button key={i} onClick={() => setShowPhoto(p.url)} className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 hover:ring-2 ring-blue-500">
                <img src={p.url} alt="Фото отзыва" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-100 dark:border-zinc-800">
            <MessageSquare size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <p className="text-zinc-500">Нет отзывов</p>
          </div>
        ) : filtered.map((r: any) => (
          <div key={r.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                  {r.userName?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <button onClick={() => alert(`Клиент: ${r.userName}\nID: ${r.userId}`)} className="font-semibold text-zinc-900 dark:text-white hover:text-blue-500">{r.userName}</button>
                  <p className="text-[10px] text-zinc-400">{r.dishName || 'Блюдо'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < r.rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-300 dark:text-zinc-600'} />
                ))}
              </div>
            </div>

            <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">{r.text}</p>

            {r.photoUrl && (
              <button onClick={() => setShowPhoto(r.photoUrl)} className="mb-2">
                <img src={r.photoUrl} alt="Фото" className="w-20 h-20 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700 hover:ring-2 ring-blue-500" />
              </button>
            )}

            <div className="flex items-center gap-3 text-[10px] text-zinc-400 mb-3">
              <span>{new Date(r.createdAt).toLocaleDateString('ru')}</span>
              <span className={`px-1.5 py-0.5 rounded-full ${r.isVisible ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{r.isVisible ? 'Опубликован' : 'Скрыт'}</span>
            </div>

            {r.reply && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-3 border-l-4 border-blue-500">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Ответ администратора:</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{r.reply}</p>
              </div>
            )}

            <div className="flex gap-2 items-center pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <input value={replyText[r.id] || ''} onChange={e => setReplyText({...replyText, [r.id]: e.target.value})} placeholder="Написать ответ..." className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
              <button onClick={() => sendReply(r.id)} className="bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-600 active:scale-[0.97]"><Reply size={14} className="inline" /> Ответить</button>
            </div>
          </div>
        ))}
      </div>

      {showPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowPhoto(null)}>
          <img src={showPhoto} alt="Фото" className="max-w-full max-h-full rounded-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
