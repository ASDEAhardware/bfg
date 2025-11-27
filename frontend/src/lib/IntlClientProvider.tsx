'use client';

import { NextIntlClientProvider } from 'next-intl';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useLocaleStore } from '@/store/localeStore';
import { getMessagesForLocale, Locale } from './i18n';
import Cookies from 'js-cookie';

interface IntlClientProviderProps {
  children: ReactNode;
  serverIsAuthenticated: boolean;
  serverLocale: string;
  serverMessages: any;
}

const PUBLIC_ROUTES = ['/login', '/register', '/reset-password'];

export function IntlClientProvider({
  children,
  serverIsAuthenticated,
  serverLocale,
  serverMessages,
}: IntlClientProviderProps) {
  const pathname = usePathname();

  const [activeMessages, setActiveMessages] = useState(serverMessages);
  const [activeLocale, setActiveLocale] = useState(serverLocale);
  const clientLocale = useLocaleStore((state) => state.locale);

  useEffect(() => {
    if (clientLocale !== activeLocale) {
      const loadMessages = async () => {
        const newMessages = await getMessagesForLocale(clientLocale as Locale);
        setActiveMessages(newMessages);
        setActiveLocale(clientLocale);
      };
      loadMessages();
    }
  }, [clientLocale, activeLocale]);

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Per evitare schermate nere dopo il login, controlliamo l'autenticazione
  // sia tramite il valore fornito dal server (per il primo caricamento)
  // sia leggendo direttamente il cookie sul client (per le navigazioni client-side).
  const hasClientToken = !!Cookies.get('refresh_token');
  const canRenderChildren = isPublicRoute || serverIsAuthenticated || hasClientToken;

  return (
    <NextIntlClientProvider locale={activeLocale} messages={activeMessages}>
      {canRenderChildren ? children : null}
    </NextIntlClientProvider>
  );
}
