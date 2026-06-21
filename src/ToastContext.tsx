import { useState, useEffect, ReactNode } from 'react';
import { addToast as globalAddToast, subscribe, ToastType } from './toast';

export { addToast } from './toast';
export type { ToastType } from './toast';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsub = subscribe((t) => {
      const duration = t.type === 'error' ? 0 : t.type === 'warning' ? 7000 : 4000;
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { ...t, id, duration }]);
      if (duration > 0) {
        setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), duration);
      }
    });
    return unsub;
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${COLORS[t.type]} text-white rounded-xl shadow-xl flex items-start gap-2.5 px-4 py-3 animate-slide-in`}
        >
          <span className="text-base font-bold mt-0.5 flex-shrink-0">{ICONS[t.type]}</span>
          <p className="text-sm font-medium flex-1 whitespace-pre-wrap">{t.message}</p>
          {t.duration === 0 && (
            <button onClick={() => remove(t.id)} className="text-white/70 hover:text-white flex-shrink-0 mt-0.5 text-sm font-bold">✕</button>
          )}
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
