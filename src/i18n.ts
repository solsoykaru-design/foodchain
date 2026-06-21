import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';
import kk from './locales/kk.json';

const savedLang = localStorage.getItem('i18n_lang') || 'ru';

i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, en: { translation: en }, kk: { translation: kk } },
  lng: savedLang,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export function changeLanguage(lng: string) {
  localStorage.setItem('i18n_lang', lng);
  i18n.changeLanguage(lng);
}

export default i18n;
