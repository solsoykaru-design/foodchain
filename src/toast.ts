export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

type Listener = (toast: ToastMessage) => void;

let listeners: Listener[] = [];
let nextId = 0;

export function addToast(message: string, type: ToastType = 'info') {
  const toast: ToastMessage = { id: ++nextId, message, type };
  for (const fn of listeners) fn(toast);
}

export function subscribe(fn: Listener) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
