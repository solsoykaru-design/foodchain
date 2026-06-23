import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, User, ArrowRight, Clock, Eye, Tag, Search, ChevronRight, Play, FileText, Video, BookOpen } from 'lucide-react';

interface Post {
  id: string;
  category: string;
  type: 'article' | 'video' | 'case';
  title: string;
  excerpt: string;
  image: string;
  date: string;
  readTime: string;
  author: string;
  tags: string[];
}

const posts: Post[] = [
  {
    id: '1', category: 'Кейс', type: 'case',
    title: 'Как сеть кофеен CoffeeLab увеличила средний чек на 23% с FoodChain',
    excerpt: 'История внедрения: от хаоса в заказах до полной автоматизации за 2 недели.',
    image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=450&fit=crop',
    date: '15 мая 2024', readTime: '8 мин', author: 'Иван Петров', tags: ['кейс', 'кофейня', 'автоматизация'],
  },
  {
    id: '2', category: 'Видео', type: 'video',
    title: 'Обзор админ-панели FoodChain: полное управление рестораном',
    excerpt: 'Пошаговый разбор всех разделов админ-панели: меню, склад, заказы, финансы.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
    date: '10 мая 2024', readTime: '12 мин', author: 'Анна Смирнова', tags: ['видео', 'админ-панель', 'обзор'],
  },
  {
    id: '3', category: 'Статья', type: 'article',
    title: '10 способов сократить фудкост с помощью автоматизации',
    excerpt: 'Практические советы по контролю продуктов, списанию и прогнозированию закупок.',
    image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&h=450&fit=crop',
    date: '5 мая 2024', readTime: '6 мин', author: 'Михаил Орлов', tags: ['фудкост', 'склад', 'оптимизация'],
  },
  {
    id: '4', category: 'Новость', type: 'article',
    title: 'FoodChain запускает AI-прогнозы спроса на блюда',
    excerpt: 'Новый модуль искусственного интеллекта помогает прогнозировать популярность блюд и оптимизировать закупки.',
    image: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=450&fit=crop',
    date: '28 апреля 2024', readTime: '4 мин', author: 'Елена Козлова', tags: ['AI', 'новости', 'обновление'],
  },
  {
    id: '5', category: 'Статья', type: 'article',
    title: 'Как открыть ресторан с нуля: чек-лист на 2024 год',
    excerpt: 'Полный список шагов: от поиска помещения до запуска доставки. С советами от экспертов FoodChain.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=450&fit=crop',
    date: '20 апреля 2024', readTime: '10 мин', author: 'Сергей Волков', tags: ['открытие', 'чек-лист', 'бизнес'],
  },
  {
    id: '6', category: 'Видео', type: 'video',
    title: 'Интеграция FoodChain с Яндекс.Еда и Delivery Club',
    excerpt: 'Настройка агрегаторов доставки за 15 минут. Полный гайд с демонстрацией.',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=450&fit=crop',
    date: '15 апреля 2024', readTime: '7 мин', author: 'Анна Смирнова', tags: ['видео', 'интеграция', 'агрегаторы'],
  },
  {
    id: '7', category: 'Кейс', type: 'case',
    title: 'Ресторан «Терраса»: автоматизация зала и кухни за 1 неделю',
    excerpt: 'Как ресторан на 80 посадочных мест перешёл на FoodChain и сократил время обслуживания на 30%.',
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=450&fit=crop',
    date: '8 апреля 2024', readTime: '9 мин', author: 'Мария Новикова', tags: ['кейс', 'ресторан', 'зал'],
  },
  {
    id: '8', category: 'Статья', type: 'article',
    title: 'Программа лояльности: стратегии для ресторанов',
    excerpt: 'Как настроить эффективную программу лояльности, которая увеличит повторные заказы на 40%.',
    image: 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&h=450&fit=crop',
    date: '1 апреля 2024', readTime: '5 мин', author: 'Мария Новикова', tags: ['лояльность', 'маркетинг', 'гости'],
  },
];

const categories = ['Все', 'Статья', 'Видео', 'Кейс', 'Новость'];

export function Blog() {
  const [activeCategory, setActiveCategory] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = posts.filter((post) => {
    const matchCat = activeCategory === 'Все' || post.category === activeCategory;
    const matchSearch = !searchQuery || post.title.toLowerCase().includes(searchQuery.toLowerCase()) || post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-20 sm:pb-28 sm:pt-28">
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_top_right,_rgba(0,180,216,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_bottom_left,_rgba(0,150,200,0.06),transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-cyan-500/20">
            Блог
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Блог FoodChain
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            Новости, кейсы, видео-уроки и статьи об автоматизации ресторанного бизнеса
          </p>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="sticky top-20 z-30 border-y border-white/5 bg-[#0a1628]/95 backdrop-blur-xl px-4 py-4">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text" placeholder="Поиск статей..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat} onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition ${
                  activeCategory === cat
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/[0.05] text-slate-400 border border-white/5 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((post) => (
              <Link
                key={post.id} to="#"
                className="group rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:bg-white/[0.05] hover:-translate-y-1"
              >
                <div className="relative overflow-hidden">
                  <img src={post.image} alt={post.title} className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    {post.type === 'video' && (
                      <span className="flex items-center gap-1 rounded-full bg-rose-500/80 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                        <Video className="h-3 w-3" />Видео
                      </span>
                    )}
                    {post.type === 'case' && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/80 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                        <FileText className="h-3 w-3" />Кейс
                      </span>
                    )}
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/80 backdrop-blur-sm">
                      {post.category}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{post.date}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.readTime}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-cyan-400 transition-colors leading-snug">{post.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 line-clamp-2 leading-relaxed">{post.excerpt}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <User className="h-3 w-3" />
                    {post.author}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span key={tag} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-500">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-20">
              <Search className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">Ничего не найдено</p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="border-t border-white/5 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Подпишитесь на новости</h2>
          <p className="mt-3 text-sm text-slate-400">Будьте в курсе новых статей, кейсов и обновлений FoodChain</p>
          <form className="mt-8 flex gap-3">
            <input type="email" placeholder="your@email.ru" className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition" />
            <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105">
              Подписаться
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
