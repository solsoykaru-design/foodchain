import { useApp } from '../context';

const SIZES = [
  { id: 'small' as const, label: 'A', hint: 'Мелкий' },
  { id: 'medium' as const, label: 'A', hint: 'Средний' },
  { id: 'large' as const, label: 'A', hint: 'Крупный' },
];

export default function FontSizeSelector() {
  const { fontSize, setFontSize } = useApp();

  const sizeMap = { small: '11px', medium: '14px', large: '17px' };

  return (
    <div className="flex items-center gap-0.5 ring-1 ring-zinc-300 dark:ring-zinc-600 bg-white dark:bg-zinc-800 rounded-lg p-0.5">
      {SIZES.map(s => {
        const active = fontSize === s.id;
        return (
          <button
            key={s.id}
            onClick={() => setFontSize(s.id)}
            title={s.hint}
            className={`px-2 py-1 rounded-md font-bold transition-all ${
              active
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
            }`}
            style={{ fontSize: sizeMap[s.id] }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
