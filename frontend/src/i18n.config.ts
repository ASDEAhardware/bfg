export const defaultLocale: string = 'en';
export const locales: readonly string[] = ['en', 'it'] as const;
export type Locale = 'en' | 'it';