import { useState } from 'react';
import { useApp } from '../context';
import * as api from '../api';

export default function RegisterPage({ onClose }: { onClose: () => void }) {
  const { registerUser } = useApp();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'name'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneSubmit = async () => {
    if (phone.length < 5) return;
    setLoading(true);
    setError('');
    try {
      const normalized = phone.startsWith('+') ? phone : '+7' + phone.replace(/\D/g, '').slice(-10);
      await api.phoneLogin(normalized);
      setPhone(normalized);
      setStep('name');
    } catch (e: any) {
      if (e.message?.includes('fetch') || e.message?.includes('NetworkError')) {
        setStep('name');
      } else {
        setError(e.message || 'Ошибка');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    registerUser(name || 'Гость', phone, 'mobile_app');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-white dark:bg-zinc-950 p-4">
      {step === 'phone' && (
        <div className="mt-20">
          <h2 className="text-2xl font-bold mb-2 text-center">Ваш телефон</h2>
          <p className="text-sm text-zinc-500 mb-6 text-center">Введите номер для входа или регистрации</p>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 000-00-00" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 mb-4 text-lg text-center text-zinc-900 dark:text-white bg-white dark:bg-zinc-800" />
          {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
          <button onClick={handlePhoneSubmit} disabled={loading} className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl">Продолжить</button>
        </div>
      )}
      {step === 'name' && (
        <div className="mt-20">
          <h2 className="text-2xl font-bold mb-6 text-center">Как к вам обращаться?</h2>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Имя" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 mb-4 text-lg text-center text-zinc-900 dark:text-white bg-white dark:bg-zinc-800" />
          <button onClick={handleComplete} className="w-full bg-green-500 text-white font-bold py-4 rounded-xl">Завершить</button>
        </div>
      )}
    </div>
  );
}
