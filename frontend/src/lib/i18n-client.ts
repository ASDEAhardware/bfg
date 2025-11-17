'use client'

import { defaultLocale, locales } from '@/i18n.config'

export type Locale = 'en' | 'it'

export const getMessagesForLocale = async (locale: Locale) => {
  try {
    // Prova a importare il file della lingua richiesta
    return (await import(`../../messages/${locale}.json`)).default
  } catch (error) {
    // Se fallisce (es. lingua non trovata), usa l'inglese come fallback
    console.error(`Messages for locale "${locale}" not found. Falling back to "en".`, error)
    return (await import('../../messages/en.json')).default
  }
}
