import { createContext, useContext, useState, useEffect } from 'react';
import { translations, getAvailableLanguages, isLanguageSupported } from '../translations.js';

// Create translation context
const TranslationContext = createContext();

/**
 * Translation Provider Component
 */
export const TranslationProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('lv');

  // Load saved language preference on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferred-language');
    if (savedLanguage && isLanguageSupported(savedLanguage)) {
      setCurrentLanguage(savedLanguage);
    } else {
      // Try to detect browser language
      const browserLang = navigator.language.split('-')[0];
      if (isLanguageSupported(browserLang)) {
        setCurrentLanguage(browserLang);
      }
    }
  }, []);

  // Save language preference when it changes
  useEffect(() => {
    localStorage.setItem('preferred-language', currentLanguage);
  }, [currentLanguage]);

  /**
   * Change the current language
   */
  const changeLanguage = (newLanguage) => {
    if (isLanguageSupported(newLanguage)) {
      setCurrentLanguage(newLanguage);
    } else {
      console.warn(`Language "${newLanguage}" is not supported. Available languages:`, getAvailableLanguages());
    }
  };

  /**
   * Translate a key with optional interpolation values
   * @param {string} key - Translation key (e.g., 'nav.search.title')
   * @param {object} values - Values for interpolation (e.g., {count: 5, filename: 'data.json'})
   * @returns {string} Translated text
   */
  const translate = (key, values = {}) => {
    // Get translation for current language, fallback to English
    const currentTranslations = translations[currentLanguage] || translations.en;
    let text = currentTranslations[key];

    // If not found in current language, try English
    if (!text && currentLanguage !== 'en') {
      text = translations.en[key];
    }

    // If still not found, return the key itself as fallback
    if (!text) {
      console.warn(`Translation missing for key: "${key}" in language: "${currentLanguage}"`);
      return key;
    }

    // Perform interpolation
    if (values && typeof values === 'object') {
      Object.keys(values).forEach(placeholder => {
        const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
        text = text.replace(regex, values[placeholder]);
      });
    }

    return text;
  };

  const contextValue = {
    currentLanguage,
    changeLanguage,
    translate,
    availableLanguages: getAvailableLanguages()
  };

  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
};

/**
 * Hook to use translation context
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTranslation = () => {
  const context = useContext(TranslationContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }

  return context;
};

/**
 * Shorthand hook for just the translate function
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTranslate = () => {
  const { translate } = useTranslation();
  return translate;
};
