import { Building2 } from 'lucide-react';

export default function WarehousesPage() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
          <Building2 size={22} className="text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Склады</h1>
          <p className="text-sm text-zinc-500">Управление складами и местами хранения</p>
        </div>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 text-center">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">Страница "Склады" — в разработке</p>
      </div>
    </div>
  );
}
