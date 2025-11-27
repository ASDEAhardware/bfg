import { defaultLocale } from '@/i18n.config';

export type Locale = 'en' | 'it';

/**
 * Questa funzione condivisa carica i messaggi di traduzione per una data lingua.
 * Può essere eseguita in sicurezza sia sul server che sul client.
 * @param locale La lingua per cui caricare i messaggi.
 * @returns Un oggetto contenente i messaggi di traduzione.
 */
export const getMessagesForLocale = async (locale: Locale) => {
  try {
    return (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    console.error(
      `Messages for locale "${locale}" not found. Falling back to "${defaultLocale}".`,
      error
    );
    return (await import(`../../messages/${defaultLocale}.json`)).default;
  }
};
