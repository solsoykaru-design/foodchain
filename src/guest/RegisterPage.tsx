import { useState } from 'react';
import { useApp } from '../context';

export default function RegisterPage({ onClose }: { onClose: () => void }) {
  const { registerUser } = useApp();
  const [step, setStep] = useState<'phone' | 'code' | 'profile'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-[300] bg-white dark:bg-zinc-950 p-4">
      {step === 'phone' && (
        <div className="mt-20">
          <h2 className="text-2xl font-bold mb-6 text-center">Ваш телефон</h2>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 000-00-00" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 mb-4 text-lg text-center text-zinc-900 dark:text-white bg-white dark:bg-zinc-800" />
          <button onClick={() => setStep('code')} className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl">Получить код</button>
        </div>
      )}
      {step === 'code' && (
        <div className="mt-20">
          <h2 className="text-2xl font-bold mb-6 text-center">Код из SMS</h2>
          <input type="number" value={code} onChange={e => setCode(e.target.value)} placeholder="1234" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 mb-4 text-lg text-center tracking-widest text-zinc-900 dark:text-white bg-white dark:bg-zinc-800" />
          <button onClick={() => setStep('profile')} className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl">Подтвердить</button>
          <p className="text-center text-zinc-400 mt-4 text-sm">Демо: введите любые 4 цифры</p>
        </div>
      )}
      {step === 'profile' && (
        <div className="mt-20">
          <h2 className="text-2xl font-bold mb-6 text-center">Как к вам обращаться?</h2>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Имя" className="w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 mb-4 text-lg text-center text-zinc-900 dark:text-white bg-white dark:bg-zinc-800" />
          <button onClick={() => { registerUser(name, phone, 'mobile_app'); onClose(); }} className="w-full bg-green-500 text-white font-bold py-4 rounded-xl">Завершить</button>
        </div>
      )}
    </div>
  );
}
