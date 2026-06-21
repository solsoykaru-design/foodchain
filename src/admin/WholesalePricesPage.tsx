import { Receipt } from 'lucide-react';

export default function WholesalePricesPage() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
          <Receipt size={22} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Оптовые прайс-листы</h1>
          <p className="text-sm text-zinc-500">Управление оптовыми ценами поставщиков</p>
        </div>
      </div>
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 text-center">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">Страница "Оптовые прайс-листы" — в разработке</p>
      </div>
    </div>
  );
}
