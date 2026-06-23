import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context';
import GuestShell from './guest/GuestShell';
import AdminApp, { AdminAppWrapper } from './admin/AdminApp';
import CourierApp from './courier/CourierApp';
import { PhoneFrame, WindowsFrame } from './frames';
import { PriceProvider } from './PriceContext';

type AppMode = "guest" | "admin" | "courier";

function AppContent() {
  const { theme } = useApp();
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');
  const [mode, setMode] = useState<AppMode>('guest');
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [phoneScale, setPhoneScale] = useState(1);

  useEffect(() => {
    const onResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setPhoneScale(Math.min(1, (window.innerHeight - 48) / 870));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!isDesktop) {
    return (
      <PriceProvider>
      <div className={`${theme === 'dark' ? 'dark' : ''}`}>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors">
          {mode === 'guest' && <GuestShell />}
          {mode === 'admin' && <AdminAppWrapper />}
          {mode === 'courier' && <CourierApp />}

          <div className="fixed top-3 right-3 z-[200] flex gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
            <button onClick={() => setMode('guest')} className={`px-2 py-1 rounded text-[10px] font-bold shadow-lg transition-all ${mode === 'guest' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>Гость</button>
            <button onClick={() => setMode('admin')} className={`px-2 py-1 rounded text-[10px] font-bold shadow-lg transition-all ${mode === 'admin' ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>Админ</button>
            <button onClick={() => setMode('courier')} className={`px-2 py-1 rounded text-[10px] font-bold shadow-lg transition-all ${mode === 'courier' ? 'bg-green-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>Курьер</button>
          </div>
        </div>
      </div>
      </PriceProvider>
    );
  }

  if (mode === 'admin') {
    return (
      <PriceProvider>
      <div className={`${theme === 'dark' ? 'dark' : ''}`}>
        <WindowsFrame
          title="FoodChain Admin — панель управления сетью ресторанов"
          onClose={() => setMode('guest')}
          onOpenPhone={() => setMode('guest')}
          onOpenCourier={() => setMode('courier')}
        >
          <div className="min-h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
            <AdminAppWrapper />
          </div>
        </WindowsFrame>
      </div>
      </PriceProvider>
    );
  }

  return (
    <PriceProvider>
    <div className={`${theme === 'dark' ? 'dark' : ''}`}>
      <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
        <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px] transition-colors ${mode === 'guest' ? 'bg-orange-600/10' : 'bg-green-600/10'}`} />
        <div className={`absolute bottom-0 right-1/4 w-[450px] h-[450px] rounded-full blur-[120px] transition-colors ${mode === 'guest' ? 'bg-red-600/10' : 'bg-emerald-600/10'}`} />

        <div className="relative h-full flex items-center justify-center gap-12 px-8">
          <div style={{ transform: `scale(${phoneScale})`, transformOrigin: 'center' }}>
            <PhoneFrame platform={platform}>
              <div className="min-h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
                {mode === 'guest' ? <GuestShell /> : <CourierApp />}
              </div>
            </PhoneFrame>
          </div>

          <div className="hidden xl:flex flex-col gap-5 w-72">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg ${mode === 'guest' ? 'bg-gradient-to-br from-orange-500 to-red-500' : 'bg-gradient-to-br from-green-500 to-emerald-500'}`}>
                  {mode === 'guest' ? 'F' : 'C'}
                </div>
                <h1 className="text-white text-2xl font-extrabold tracking-tight">FoodChain {mode === 'courier' && 'Курьер'}</h1>
              </div>
              <p className="text-zinc-400 text-sm">Приложение для {mode === 'guest' ? 'гостей' : 'курьеров'}</p>
            </div>

            <div className="bg-zinc-800/60 backdrop-blur rounded-2xl p-1.5 flex gap-1.5 ring-1 ring-white/10">
              <button onClick={() => setPlatform('ios')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${platform === 'ios' ? 'bg-white text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>iPhone</button>
              <button onClick={() => setPlatform('android')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${platform === 'android' ? 'bg-green-500 text-white' : 'text-zinc-400 hover:text-white'}`}>🤖 Android</button>
            </div>

            {mode === 'guest' && (
              <button onClick={() => setMode('courier')} className="group bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl p-4 text-left shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl">🚴</div>
                  <div><p className="font-bold text-sm">Курьерское приложение</p><p className="text-white/60 text-xs">Для сотрудников службы доставки</p></div>
                  <span className="ml-auto text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all">→</span>
                </div>
              </button>
            )}

            {mode === 'courier' && (
              <button onClick={() => setMode('guest')} className="group bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-2xl p-4 text-left shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl">👤</div>
                  <div><p className="font-bold text-sm">Гостевое приложение</p><p className="text-white/60 text-xs">Вернуться к меню</p></div>
                  <span className="ml-auto text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all">→</span>
                </div>
              </button>
            )}

            <button onClick={() => setMode('admin')} className="group bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-4 text-left shadow-lg transition-all hover:scale-[1.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl">🖥️</div>
                <div><p className="font-bold text-sm">Открыть бэк-офис</p><p className="text-white/60 text-xs">Управление рестораном</p></div>
                <span className="ml-auto text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all">→</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
    </PriceProvider>
  );
}

export default function App() { return <AppProvider><AppContent /></AppProvider>; }
