import { useState, useEffect } from 'react';
import { Gamepad2, Plus, Sparkles, Trophy, RefreshCw, Trash2, ToggleLeft, ToggleRight, BarChart3, Users, Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as api from '../api';
import { addToast } from '../ToastContext';

const GAME_TEMPLATES = [
  { type: 'wheel_of_fortune', name: 'Колесо удачи', desc: 'Гость вращает колесо и выигрывает скидку или бонус', icon: '🎡' },
  { type: 'quiz', name: 'Викторина', desc: 'Вопросы о ресторане и блюдах, за ответы — баллы', icon: '🧠' },
  { type: 'challenge', name: 'Челленджи', desc: 'Набор достижений: закажи 10 раз, приведи друга и т.д.', icon: '🏆' },
];

export default function GamificationPage() {
  const { t } = useTranslation();
  const [games, setGames] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'wheel_of_fortune', name: '', description: '', prize_description: '', cooldown_hours: 24, enabled: 1 });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [tab, setTab] = useState<'games' | 'stats' | 'leaderboard'>('games');

  useEffect(() => { loadGames(); loadStats(); loadLeaderboard(); }, []);

  const loadGames = async () => {
    try { setGames(await api.getGames()); } catch {}
  };
  const loadStats = async () => {
    try { setStats(await api.getGamificationStats()); } catch {}
  };
  const loadLeaderboard = async () => {
    try { setLeaderboard(await api.getGamificationLeaderboard()); } catch {}
  };

  const createGame = async () => {
    try {
      await api.createGame(form);
      addToast('Игра создана', 'success');
      setShowForm(false);
      setForm({ type: 'wheel_of_fortune', name: '', description: '', prize_description: '', cooldown_hours: 24, enabled: 1 });
      loadGames();
    } catch (e: any) { addToast('Ошибка: ' + e.message, 'error'); }
  };

  const toggleGame = async (id: number) => {
    try {
      await api.toggleGame(id);
      loadGames();
    } catch {}
  };

  const deleteGame = async (id: number) => {
    if (!confirm('Удалить игру?')) return;
    try {
      await api.deleteGame(id);
      addToast('Игра удалена', 'success');
      loadGames();
    } catch {}
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Gamepad2 size={24} /> Геймификация</h1>

      <div className="flex gap-2 mb-6">
        {(['games', 'stats', 'leaderboard'] as const).map(tt => (
          <button key={tt} onClick={() => setTab(tt)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === tt ? 'bg-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
          >{tt === 'games' ? 'Игры' : tt === 'stats' ? 'Статистика' : 'Лидерборд'}</button>
        ))}
      </div>

      {tab === 'games' && (
        <>
          <button onClick={() => setShowForm(!showForm)}
            className="mb-4 px-4 py-2.5 rounded-xl font-bold text-sm bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2 transition"
          ><Plus size={16} /> Создать игру</button>

          {showForm && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 mb-6 space-y-3">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm">
                {GAME_TEMPLATES.map(gt => <option key={gt.type} value={gt.type}>{gt.icon} {gt.name}</option>)}
              </select>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Название игры"
                className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Описание"
                rows={2} className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm resize-none" />
              <input value={form.prize_description} onChange={e => setForm({ ...form, prize_description: e.target.value })} placeholder="Призы (например: скидка 10%, 50 бонусов)"
                className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm" />
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-xs text-zinc-400 mb-1">Переодичность (часы)</p>
                  <input type="number" value={form.cooldown_hours} onChange={e => setForm({ ...form, cooldown_hours: parseInt(e.target.value) || 24 })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.enabled === 1} onChange={e => setForm({ ...form, enabled: e.target.checked ? 1 : 0 })} />
                    Активна
                  </label>
                </div>
              </div>
              <button onClick={createGame}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-green-500 hover:bg-green-600 text-white transition"
              ><Sparkles size={16} className="inline mr-1" /> Создать</button>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game: any) => {
              const gt = GAME_TEMPLATES.find(g => g.type === game.type);
              return (
                <div key={game.id} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-2xl mb-1">{gt?.icon || '🎮'}</p>
                      <p className="font-bold text-sm">{game.name}</p>
                      <p className="text-xs text-zinc-400">{gt?.desc || game.type}</p>
                    </div>
                    <button onClick={() => toggleGame(game.id)} className="p-1">
                      {game.enabled ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-zinc-400" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>{game.prize_description || '—'}</span>
                    <button onClick={() => deleteGame(game.id)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
            {games.length === 0 && !showForm && (
              <div className="col-span-full text-center py-12 text-zinc-400 text-sm">Игр пока нет. Создайте первую!</div>
            )}
          </div>
        </>
      )}

      {tab === 'stats' && stats && (
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
            <Users size={24} className="mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{stats.total_players || 0}</p>
            <p className="text-xs text-zinc-400">Игроков</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
            <Award size={24} className="mx-auto mb-2 text-yellow-500" />
            <p className="text-2xl font-bold">{stats.total_points || 0}</p>
            <p className="text-xs text-zinc-400">Всего баллов</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
            <BarChart3 size={24} className="mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">{stats.total_plays || 0}</p>
            <p className="text-xs text-zinc-400">Всего игр сыграно</p>
          </div>
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="font-bold flex items-center gap-2"><Trophy size={18} className="text-yellow-500" /> Лидерборд</h2>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {leaderboard.map((entry: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-zinc-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{entry.guest_name || 'Гость'}</span>
                <span className="font-bold text-blue-500">{entry.total_points} баллов</span>
                <span className="text-xs text-zinc-400">{entry.games_played} игр</span>
              </div>
            ))}
            {leaderboard.length === 0 && <p className="text-center py-8 text-zinc-400 text-sm">Пока нет участников</p>}
          </div>
        </div>
      )}
    </div>
  );
}
