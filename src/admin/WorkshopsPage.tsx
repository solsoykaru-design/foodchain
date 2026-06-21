import { Factory } from 'lucide-react';

export default function WorkshopsPage() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
          <Factory size={22} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Цеха</h1>
          <p className="text-sm text-zinc-500">Управление производственными цехами</p>
        </div>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 text-center">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">Страница "Цеха" — в разработке</p>
      </div>
    </div>
  );
}
