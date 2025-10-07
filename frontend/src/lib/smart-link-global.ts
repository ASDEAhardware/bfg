// File per configurare il comportamento globale dei link
// Questo file può essere importato nel _app.tsx o nel layout principale per configurazioni globali

export const SMART_LINK_CONFIG = {
  // Disabilita la navigazione intelligente per specifici pattern URL
  excludePatterns: [
    /^https?:\/\//, // Link esterni
    /^mailto:/, // Email
    /^tel:/, // Telefono
  ],

  // Titoli di fallback per URL specifici
  fallbackTitles: {
    '/version': 'Changelog',
    '/settings': 'Impostazioni',
    '/profile': 'Profilo',
    '/dashboard': 'Dashboard',
  } as Record<string, string>
}

// Utility per determinare se un URL deve usare navigazione normale
export function shouldUseNormalNavigation(url: string): boolean {
  return SMART_LINK_CONFIG.excludePatterns.some(pattern => pattern.test(url))
}

// Utility per ottenere un titolo di fallback
export function getFallbackTitle(url: string): string | undefined {
  return SMART_LINK_CONFIG.fallbackTitles[url]
}