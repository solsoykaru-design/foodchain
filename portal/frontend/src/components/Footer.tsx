import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-zinc-900 text-zinc-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-16">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm">FC</span>
              </div>
              <span className="font-bold text-white text-lg">FoodChain</span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-500 max-w-xs">
              Полный комплект инструментов для автоматизации ресторанного бизнеса. Принимайте заказы, управляйте персоналом и анализируйте продажи.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <a href="#" className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center hover:bg-zinc-700 transition text-zinc-400 hover:text-white">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center hover:bg-zinc-700 transition text-zinc-400 hover:text-white">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.441 16.892c-1.658.738-3.847.579-5.244-.192-1.562-.86-2.735-2.442-3.662-4.042-.928-1.6-1.279-3.345-1.126-4.87.022-.223.309-.318.477-.165.755.688 1.679 1.204 2.619 1.614.339.148.595-.224.414-.514-.214-.344-.45-.679-.602-1.065-.209-.534-.082-1.163.347-1.489.448-.34 1.608-.784 2.678-.35.911.371 1.554 1.532 1.689 2.411.134.879-.134 1.852-.613 2.517-.114.159-.351.072-.337-.11.038-.487.009-.981-.143-1.444-.237-.718-.823-1.285-1.568-1.232-1.133.08-1.616 1.782-1.065 2.872.141.279.33.541.5.813.187.299.092.683-.135.909-.673.67-1.75.797-2.631.469-.24-.09-.235-.417-.055-.541.425-.291.794-.669 1.076-1.113.368-.58.59-1.321.442-1.983-.175-.785-.876-1.324-1.646-1.48-1.477-.3-2.937.472-3.694 1.678-.757 1.206-.669 2.885.041 4.02 1.147 1.83 2.936 3.386 5.077 3.946 1.074.281 2.199.319 3.293.181.569-.072 1.15-.215 1.664-.481.317-.164.63-.408.799-.718.197-.362.108-.801-.196-1.022-.566-.41-1.584-.15-2.149.12z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 bg-zinc-800 rounded-lg flex items-center justify-center hover:bg-zinc-700 transition text-zinc-400 hover:text-white">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-4">Продукт</h4>
            <div className="space-y-3 text-sm">
              <Link to="/features" className="block text-zinc-500 hover:text-white transition">Возможности</Link>
              <Link to="/pricing" className="block text-zinc-500 hover:text-white transition">Цены</Link>
              <Link to="/" className="block text-zinc-500 hover:text-white transition">Для ресторанов</Link>
              <Link to="/" className="block text-zinc-500 hover:text-white transition">Для доставки</Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-4">Компания</h4>
            <div className="space-y-3 text-sm">
              <Link to="/about" className="block text-zinc-500 hover:text-white transition">О нас</Link>
              <Link to="/contact" className="block text-zinc-500 hover:text-white transition">Контакты</Link>
              <a href="#" className="block text-zinc-500 hover:text-white transition">Блог</a>
              <a href="#" className="block text-zinc-500 hover:text-white transition">Партнёрам</a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-4">Поддержка</h4>
            <div className="space-y-3 text-sm">
              <a href="#" className="block text-zinc-500 hover:text-white transition">Документация</a>
              <a href="#" className="block text-zinc-500 hover:text-white transition">API</a>
              <a href="mailto:support@foodchain.ru" className="block text-zinc-500 hover:text-white transition">support@foodchain.ru</a>
              <a href="tel:+78001234567" className="block text-zinc-500 hover:text-white transition">8 (800) 123-45-67</a>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} FoodChain. Все права защищены.
          </p>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <a href="#" className="hover:text-zinc-400 transition">Политика конфиденциальности</a>
            <a href="#" className="hover:text-zinc-400 transition">Условия использования</a>
            <a href="#" className="hover:text-zinc-400 transition">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}