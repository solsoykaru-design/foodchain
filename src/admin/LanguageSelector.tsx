import { useTranslation } from 'react-i18next';
import { useApp } from '../context';

const LANGUAGES = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'kk', label: 'Қазақша', flag: '🇰🇿' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const { setLanguage } = useApp();

  return (
    <select
      value={i18n.language}
      onChange={(e) => setLanguage(e.target.value)}
      className="bg-transparent text-zinc-500 hover:text-blue-500 transition text-sm cursor-pointer outline-none border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5"
      title="Language"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.flag} {l.label}
        </option>
      ))}
    </select>
  );
}
