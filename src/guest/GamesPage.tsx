import { useState, useEffect, useRef } from 'react';
import { Gamepad2, Trophy, Sparkles, Star, RefreshCw, ChevronRight, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import { useApp } from '../context';

const PHRASES = [
  'Кухня уже готовит...',
  'Шеф-повар одобряет...',
  'Доставляем удачу...',
  'Замешиваем тесто...',
  'Варим кофе...',
];

const WHEEL_SEGMENTS = [
  { label: '10 бонусов', color: '#22c55e', points: 10 },
  { label: 'Скидка 5%', color: '#3b82f6', points: 0 },
  { label: '25 бонусов', color: '#eab308', points: 25 },
  { label: 'Бесплатное блюдо', color: '#ec4899', points: 0 },
  { label: 'Попробуй ещё', color: '#8b5cf6', points: 0 },
  { label: '50 бонусов', color: '#f97316', points: 50 },
  { label: 'Скидка 15%', color: '#06b6d4', points: 0 },
  { label: '100 бонусов', color: '#ef4444', points: 100 },
];

const QUIZZES = [
  { q: 'Какое блюдо самое популярное в нашем меню?', options: ['Пицца Маргарита', 'Борщ', 'Цезарь', 'Том Ям'], correct: 0 },
  { q: 'В каком году открылся наш ресторан?', options: ['2018', '2019', '2020', '2021'], correct: 1 },
  { q: 'Какой ингредиент НЕ входит в состав Цезаря?', options: ['Курица', 'Анчоусы', 'Креветки', 'Пармезан'], correct: 2 },
  { q: 'Сколько грамм в стандартной порции пасты?', options: ['200г', '250г', '300г', '350г'], correct: 2 },
  { q: 'Какой соус подают к роллам "Филадельфия"?', options: ['Соевый', 'Спайс', 'Терияки', 'Унаги'], correct: 0 },
];

const CHALLENGES = [
  { id: 'orders_5', title: 'Постоянный гость', desc: 'Сделайте 5 заказов', icon: '🛵', max: 5 },
  { id: 'orders_10', title: 'Завсегдатай', desc: 'Сделайте 10 заказов', icon: '⭐', max: 10 },
  { id: 'reviews_3', title: 'Критик', desc: 'Оставьте 3 отзыва', icon: '✍️', max: 3 },
  { id: 'bonus_500', title: 'Бонус-хантер', desc: 'Накопите 500 бонусов', icon: '💰', max: 500 },
  { id: 'visit_7', title: '7 дней подряд', desc: 'Делайте заказы 7 дней подряд', icon: '📅', max: 7 },
];

const quizBgColors = ['from-purple-500 to-pink-500', 'from-blue-500 to-cyan-500', 'from-green-500 to-teal-500', 'from-orange-500 to-red-500', 'from-pink-500 to-rose-500'];

export default function GamesPage() {
  const { t } = useTranslation();
  const app = useApp();
  const [tab, setTab] = useState<'wheel' | 'quiz' | 'challenges'>('wheel');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [phrase, setPhrase] = useState(PHRASES[0]);
  const [currentQuiz, setCurrentQuiz] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState<number | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [lastPlayed, setLastPlayed] = useState<Record<string, number>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('foodchain_guest_user') || '{}');
      if (stored?.id || stored?.userId) setCurrentUser(stored);
    } catch {}
  }, []);

  useEffect(() => {
    loadChallenges();
  }, [currentUser]);

  const loadChallenges = async () => {
    const userId = currentUser?.id || currentUser?.userId || 0;
    if (!userId) { setChallenges([]); return; }
    try {
      const data = await api.getChallenges(userId);
      setChallenges(Array.isArray(data) ? data : []);
    } catch { setChallenges([]); }
  };

  const spinWheel = async () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    const idx = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    const segmentAngle = 360 / WHEEL_SEGMENTS.length;
    const fullSpins = 5 * 360;
    const target = fullSpins + (360 - idx * segmentAngle);
    setWheelRotation(prev => prev + target);
    const phrases = [...PHRASES];
    const interval = setInterval(() => {
      setPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
    }, 300);
    setTimeout(() => {
      clearInterval(interval);
      const seg = WHEEL_SEGMENTS[idx];
      setResult(seg);

      setSpinning(false);
      try {
        const userId = currentUser?.id || currentUser?.userId || 0;
        if (userId) api.playWheelOfFortune(userId, seg.points, seg.label);
      } catch {}
    }, 4000);
  };

  const answerQuiz = (answerIdx: number) => {
    if (quizAnswered !== null) return;
    setQuizAnswered(answerIdx);
    const correct = answerIdx === QUIZZES[currentQuiz].correct;
    setTimeout(() => {
      if (correct) setQuizScore(prev => prev + 10);
      if (currentQuiz < QUIZZES.length - 1) {
        setQuizAnswered(null);
        setCurrentQuiz(prev => prev + 1);
      } else {
        setQuizDone(true);
        if (correct) setQuizScore(prev => prev + 10);
        try {
          const userId = currentUser?.id || currentUser?.userId || 0;
          if (userId) api.submitQuizAnswer(userId, quizScore + (correct ? 10 : 0));
        } catch {}
      }
    }, 1200);
  };

  const resetQuiz = () => {
    setCurrentQuiz(0);
    setQuizScore(0);
    setQuizAnswered(null);
    setQuizDone(false);
  };

  const segmentSize = 360 / WHEEL_SEGMENTS.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Gamepad2 size={20} className="text-orange-500" />
          <h1 className="text-lg font-bold">Игры</h1>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-3 bg-zinc-900/50">
        {(['wheel', 'quiz', 'challenges'] as const).map(tt => (
          <button key={tt} onClick={() => setTab(tt)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === tt ? 'bg-orange-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >{tt === 'wheel' ? '🎡 Колесо' : tt === 'quiz' ? '🧠 Викторина' : '🏆 Челленджи'}</button>
        ))}
      </div>

      {tab === 'wheel' && (
        <div className="px-4 py-6 flex flex-col items-center">
          {/* Wheel */}
          <div className="relative w-72 h-72 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-zinc-800 overflow-hidden"
              style={{ transform: `rotate(${wheelRotation}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none' }}
            >
              {WHEEL_SEGMENTS.map((seg, i) => {
                const angle = i * segmentSize;
                return (
                  <div key={i} className="absolute inset-0" style={{ clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((angle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((angle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((angle + segmentSize - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((angle + segmentSize - 90) * Math.PI / 180)}%)`, backgroundColor: seg.color }}>
                    <span className="absolute text-[9px] font-bold text-white drop-shadow-lg"
                      style={{ transform: `rotate(${angle + segmentSize / 2}deg) translate(0, -60px)`, left: '50%', top: '50%', transformOrigin: 'center' }}>
                      {seg.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Center pointer */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-zinc-900 border-4 border-zinc-700 flex items-center justify-center z-10">
              <Sparkles size={20} className="text-yellow-500" />
            </div>
            {/* Top pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-2 z-10">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-yellow-500 drop-shadow-lg" />
            </div>
          </div>

          {spinning && (
            <p className="text-sm text-zinc-400 animate-pulse mb-4">{phrase}</p>
          )}

          {result && !spinning && (
            <div className="text-center mb-4 p-4 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
              <p className="text-2xl mb-1">🎉</p>
              <p className="font-bold text-lg">{result.label}</p>
              {result.points > 0 && <p className="text-sm text-yellow-400">+{result.points} баллов</p>}
            </div>
          )}

          <button onClick={spinWheel} disabled={spinning}
            className="px-8 py-3 rounded-2xl font-bold text-base bg-gradient-to-r from-orange-500 to-yellow-500 text-black disabled:opacity-50 transition transform active:scale-95 shadow-lg flex items-center gap-2"
          >
            {spinning ? <RefreshCw size={18} className="animate-spin" /> : <RotateCcw size={18} />}
            {spinning ? 'Вращается...' : 'Крутить!'}
          </button>
        </div>
      )}

      {tab === 'quiz' && (
        <div className="px-4 py-6">
          {quizDone ? (
            <div className="text-center py-12">
              <Trophy size={48} className="mx-auto mb-4 text-yellow-500" />
              <p className="text-xl font-bold mb-2">Викторина завершена!</p>
              <p className="text-3xl font-bold text-blue-500 mb-2">{quizScore} / {QUIZZES.length * 10} баллов</p>
              <p className="text-sm text-zinc-400 mb-6">
                {quizScore === QUIZZES.length * 10 ? 'Идеально! Ты знаток!' : quizScore >= QUIZZES.length * 5 ? 'Хороший результат!' : 'Попробуй ещё раз!'}
              </p>
              <button onClick={resetQuiz} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-500 text-white transition hover:bg-blue-600">
                Пройти заново
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-zinc-400">Вопрос {currentQuiz + 1} из {QUIZZES.length}</p>
                <p className="text-sm font-bold text-blue-500">{quizScore} баллов</p>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-6">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${((currentQuiz + 1) / QUIZZES.length) * 100}%` }} />
              </div>

              <div className={`rounded-2xl p-6 mb-6 bg-gradient-to-br ${quizBgColors[currentQuiz % quizBgColors.length]} bg-opacity-10`}>
                <p className="text-lg font-bold mb-6">{QUIZZES[currentQuiz].q}</p>
                <div className="space-y-3">
                  {QUIZZES[currentQuiz].options.map((opt, i) => {
                    const isSelected = quizAnswered === i;
                    const isCorrect = i === QUIZZES[currentQuiz].correct;
                    let bg = 'bg-zinc-800/80 hover:bg-zinc-700/80';
                    if (quizAnswered !== null) {
                      if (isCorrect) bg = 'bg-green-500/30 border-green-500';
                      else if (isSelected) bg = 'bg-red-500/30 border-red-500';
                    }
                    return (
                      <button key={i} onClick={() => answerQuiz(i)}
                        className={`w-full p-4 rounded-xl text-left text-sm font-medium transition-all border border-transparent ${bg} ${quizAnswered !== null ? 'cursor-default' : ''}`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${quizAnswered !== null && isCorrect ? 'bg-green-500' : quizAnswered === i ? 'bg-red-500' : 'bg-zinc-700'}`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                          {quizAnswered !== null && isCorrect && <CheckCircle2 size={16} className="text-green-500 ml-auto" />}
                          {quizAnswered !== null && isSelected && !isCorrect && <XCircle size={16} className="text-red-500 ml-auto" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'challenges' && (
        <div className="px-4 py-6 space-y-3">
          {!currentUser && (
            <div className="text-center py-12 text-zinc-400 text-sm">
              <p>Войдите в профиль, чтобы участвовать в челленджах</p>
            </div>
          )}
          {currentUser && challenges.length === 0 && (
            <div className="text-center py-12 text-zinc-400 text-sm">
              <p>Челленджи загружаются...</p>
            </div>
          )}
          {challenges.map((ch: any) => {
            const progress = Math.min(ch.progress || 0, ch.max);
            const pct = Math.round((progress / ch.max) * 100);
            const done = ch.completed || progress >= ch.max;
            return (
              <div key={ch.id} className={`rounded-2xl p-4 border ${done ? 'bg-green-500/10 border-green-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{ch.icon || '🎯'}</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{ch.title}</p>
                    <p className="text-xs text-zinc-400">{ch.desc}</p>
                  </div>
                  {done && <CheckCircle2 size={20} className="text-green-500" />}
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-zinc-500">{progress} / {ch.max}</p>
                  {done && ch.rewarded && <p className="text-xs text-green-400 font-bold">+{ch.reward_points} бонусов получено</p>}
                  {done && !ch.rewarded && <p className="text-xs text-yellow-400 font-bold">+{ch.reward_points} бонусов</p>}
                  {!done && <p className="text-xs text-zinc-600">+{ch.reward_points} бонусов</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


