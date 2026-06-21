import { Phone, Mail, MapPin, Clock, Instagram, Youtube } from 'lucide-react';
import { useWebsite } from '../WebsiteApp';

export default function Footer() {
  const ctx = useWebsite();
  const brand = ctx.branding?.site || {};
  const s = ctx.siteSettings || {};
  const storeName = ctx.branding?.common?.restaurantName || 'Ресторан';
  const logoUrl = s.images?.logoHorizontal || ctx.branding?.common?.logoUrl || '';

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-8 w-auto" />
            ) : (
              <div className="w-8 h-8 bg-[var(--color-primary)] rounded-lg flex items-center justify-center text-white font-bold text-sm">F</div>
            )}
            <span className="font-bold text-white text-lg">{storeName}</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">Вкусная еда с доставкой. Работаем для вас каждый день!</p>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-3">Меню</h4>
          <ul className="space-y-2 text-sm">
            <li><button onClick={() => ctx.setPage('menu')} className="hover:text-white transition-colors">Меню</button></li>
            <li><button onClick={() => { ctx.setPage('home'); }} className="hover:text-white transition-colors">Акции</button></li>
            <li><button onClick={() => ctx.setPage('about')} className="hover:text-white transition-colors">О нас</button></li>
            <li><button onClick={() => ctx.setPage('about')} className="hover:text-white transition-colors">Контакты</button></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-3">Контакты</h4>
          <ul className="space-y-2 text-sm">
            {brand.phone && (
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-[var(--color-primary)] shrink-0" />
                <a href={`tel:${brand.phone}`} className="hover:text-white transition-colors">{brand.phone}</a>
              </li>
            )}
            {brand.email && (
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-[var(--color-primary)] shrink-0" />
                <a href={`mailto:${brand.email}`} className="hover:text-white transition-colors">{brand.email}</a>
              </li>
            )}
            {brand.address && (
              <li className="flex items-center gap-2">
                <MapPin size={14} className="text-[var(--color-primary)] shrink-0" />
                <span>{brand.address}</span>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-3">Часы работы</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Clock size={14} className="text-[var(--color-primary)] shrink-0" />
              <span>Пн-Пт: 09:00 - 23:00</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock size={14} className="text-[var(--color-primary)] shrink-0" />
              <span>Сб-Вс: 10:00 - 01:00</span>
            </li>
          </ul>
          <h4 className="font-semibold text-white mt-5 mb-3">Мы в соцсетях</h4>
          <div className="flex gap-3">
            <a href={brand.social?.instagram || '#'} target="_blank" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
              <Instagram size={18} />
            </a>
            <a href={brand.social?.vk || '#'} target="_blank" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
              <Youtube size={18} />
            </a>
            <a href={brand.social?.telegram || '#'} target="_blank" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} {storeName}. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
