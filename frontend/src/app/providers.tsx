'use client';
//Qui puoi raggruppare tutti i provider client-side di alto livello mantenendo il file layout.tsx pulito e semplice.

import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query'; // Importa il provider di React Query
import { queryClient } from '@/lib/queryClient'; // istanza di QueryClient
import { ThemeProvider } from "@/components/theme-provider"
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
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
    );
}
