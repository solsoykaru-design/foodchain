import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-[#0d1b2a] text-slate-400 mt-auto border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-16">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-cyan-500/20">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="font-bold text-white text-lg">Food<span className="text-cyan-400">Chain</span></span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500 max-w-xs">
              Полный комплект инструментов для автоматизации ресторанного бизнеса. Принимайте заказы, управляйте персоналом и анализируйте продажи.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-4">Продукт</h4>
            <div className="space-y-3 text-sm">
              <Link to="/features" className="block text-slate-500 hover:text-cyan-400 transition">Возможности</Link>
              <Link to="/pricing" className="block text-slate-500 hover:text-cyan-400 transition">Цены</Link>
              <Link to="/" className="block text-slate-500 hover:text-cyan-400 transition">Для ресторанов</Link>
              <Link to="/" className="block text-slate-500 hover:text-cyan-400 transition">Для доставки</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-4">Компания</h4>
            <div className="space-y-3 text-sm">
              <Link to="/about" className="block text-slate-500 hover:text-cyan-400 transition">О нас</Link>
              <Link to="/contact" className="block text-slate-500 hover:text-cyan-400 transition">Контакты</Link>
              <a href="#" className="block text-slate-500 hover:text-cyan-400 transition">Блог</a>
              <a href="#" className="block text-slate-500 hover:text-cyan-400 transition">Партнёрам</a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-4">Поддержка</h4>
            <div className="space-y-3 text-sm">
              <a href="#" className="block text-slate-500 hover:text-cyan-400 transition">Документация</a>
              <a href="#" className="block text-slate-500 hover:text-cyan-400 transition">API</a>
              <a href="mailto:support@foodchain.ru" className="block text-slate-500 hover:text-cyan-400 transition">support@foodchain.ru</a>
              <a href="tel:+78001234567" className="block text-slate-500 hover:text-cyan-400 transition">8 (800) 123-45-67</a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} FoodChain / MIRUZ. Все права защищены.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <a href="#" className="hover:text-cyan-400 transition">Политика конфиденциальности</a>
            <a href="#" className="hover:text-cyan-400 transition">Условия использования</a>
            <a href="#" className="hover:text-cyan-400 transition">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
