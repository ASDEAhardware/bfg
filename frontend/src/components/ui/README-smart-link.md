# 🔗 Smart Link System

## 📖 Overview
Il sistema Smart Link sostituisce automaticamente tutti i Link di Next.js con navigazione intelligente basata sul contesto delle modalità attive (Tab/Grid/Normal).

## 🚀 Come Usare

### ✅ Importazione Corretta
```typescript
// ✅ GIUSTO - Usa sempre questo import
import { Link } from '@/components/ui/link'

// ❌ SBAGLIATO - Non usare più questo
import Link from 'next/link'
```

### 🎯 Utilizzo Standard
```typescript
// Navigazione automaticamente intelligente
<Link href="/dashboard">Dashboard</Link>
<Link href="/settings" title="Impostazioni">Settings</Link>
```

### 🔧 Opzioni Avanzate
```typescript
// Forzare navigazione normale (senza intelligenza)
<Link href="/external" forceNormalNavigation>
  Link esterno
</Link>

// Con callback custom
<Link
  href="/dashboard"
  onClick={(e) => console.log('Custom logic')}
>
  Dashboard
</Link>
```

## 🧠 Comportamento Intelligente

### 📋 **Solo Tab Mode:**
- **Azione**: Apre in nuova scheda
- **UX**: Mantiene contesto corrente

### 🔲 **Grid Mode Attivo:**
- **Azione**: Chiude grid/tab → Full-screen
- **UX**: Focus completo su nuova pagina

### 🎯 **Normal Mode:**
- **Azione**: Navigazione standard
- **UX**: Comportamento classico Next.js

## ⚙️ Configurazione Globale

### 📝 File: `/lib/smart-link-global.ts`
```typescript
export const SMART_LINK_CONFIG = {
  // URL che NON usano navigazione intelligente
  excludePatterns: [
    /^https?:\/\//, // Link esterni
    /^mailto:/,     // Email
    /^tel:/,        // Telefono
  ],

  // Titoli di fallback per URL specifici
  fallbackTitles: {
    '/version': 'Changelog',
    '/settings': 'Impostazioni',
    // Aggiungi nuovi mapping qui
  }
}
```

## 🔄 Migrazione Existing Code

### 1. **Replace Import (Automatico)**
```bash
# Trova e sostituisci tutti gli import
find . -name "*.tsx" -exec sed -i 's/import Link from "next\/link"/import { Link } from "@\/components\/ui\/link"/g' {} +
```

### 2. **Verifica Props**
Il Smart Link accetta tutte le props di Next.js Link + alcune extra:
- `forceNormalNavigation?: boolean`
- `title?: string` (per titoli schede migliori)

## 🎯 Vantaggi

- ✅ **Zero Refactoring**: Drop-in replacement
- ✅ **Automatico**: Tutti i nuovi link sono smart
- ✅ **Configurabile**: Override globale facile
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Backward Compatible**: Supporta tutti i pattern esistenti

## 🚨 Note Importanti

1. **Link Esterni**: Automaticamente esclusi dalla navigazione intelligente
2. **Custom onClick**: Sempre rispettato, navigazione intelligente solo se non preventDefault
3. **Fallback Sicuri**: Sistema robusto per determinare titoli delle schede
4. **Performance**: Zero overhead aggiuntivo

## 🔍 Debugging

Per verificare il comportamento:
```typescript
// Aggiungi log temporaneo nel smart-link.tsx
console.log('Smart navigation:', { url, linkTitle, mode })
```