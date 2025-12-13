import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from './locales/en.json';
import viTranslations from './locales/vi.json';

i18n
  .use(LanguageDetector) // Tự động detect từ browser/localStorage
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      vi: { translation: viTranslations }
    },
    fallbackLng: 'en', // Mặc định tiếng Anh nếu thiếu translation
    interpolation: { 
      escapeValue: false // React đã tự escape
    },
    detection: {
      // Lưu vào localStorage với key 'i18nextLng'
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;

