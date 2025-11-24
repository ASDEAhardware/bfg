'use client'

import { NextIntlClientProvider } from 'next-intl'
import { ReactNode, useEffect, useState } from 'react'
import { getMessagesForLocale } from './i18n-client'
import { useLocaleStore } from '@/store/localeStore'
import { usePageLoaderStore } from '@/store/loaderStore'

type Messages = Record<string, any>

interface IntlClientProviderProps {
  children: ReactNode
}

export function IntlClientProvider({ children }: IntlClientProviderProps) {
  // Leggiamo la lingua corrente dal nuovo store Zustand
  const locale = useLocaleStore((state) => state.locale)
  
  // Stato per memorizzare i messaggi caricati
  const [messages, setMessages] = useState<Messages | null>(null)

  // Azioni per mostrare/nascondere lo spinner di caricamento globale
  const showLoader = usePageLoaderStore((state) => state.show)
  const hideLoader = usePageLoaderStore((state) => state.hide)

  useEffect(() => {
    const loadMessages = async () => {
      // Se non ci sono messaggi (primo caricamento) o se la lingua cambia,
      // non mostriamo lo spinner globale, ma quello del provider.
      // Lo spinner globale è solo per il cambio di lingua esplicito.
      if (messages) {
        showLoader()
      }
      
      const loadedMessages = await getMessagesForLocale(locale)
      setMessages(loadedMessages)

      // Nascondiamo lo spinner solo dopo che i nuovi messaggi sono stati caricati
      if (messages) {
        hideLoader()
      }
    }

    loadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]) // L'effetto si riattiva solo se la 'locale' dallo store cambia.

  // Se i messaggi non sono ancora stati caricati (es. al primo avvio),
  // mostriamo un semplice testo di caricamento.
  if (!messages) {
    return <div>Loading translations...</div>
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
