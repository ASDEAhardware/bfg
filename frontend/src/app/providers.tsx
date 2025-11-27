'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ThemeProvider } from "@/components/theme-provider";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { initializePlugins } from '@/plugins';
import { IntlClientProvider } from '@/lib/IntlClientProvider';

interface ProvidersProps {
    children: ReactNode;
    serverIsAuthenticated: boolean;
    serverLocale: string;
    serverMessages: any;
}

export function Providers({ children, serverIsAuthenticated, serverLocale, serverMessages }: ProvidersProps) {
    useEffect(() => {
        initializePlugins();
    }, []);

    return (
        <IntlClientProvider
            serverIsAuthenticated={serverIsAuthenticated}
            serverLocale={serverLocale}
            serverMessages={serverMessages}
        >
            <QueryClientProvider client={queryClient}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                    storageKey="theme"
                >
                    {children}
                </ThemeProvider>
                <ReactQueryDevtools initialIsOpen={false} />
            </QueryClientProvider>
        </IntlClientProvider>
    );
}
