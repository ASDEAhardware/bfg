# 🔌 Sistema Plugin Modulare

Il sistema plugin di BFG permette di creare funzionalità modulari e sganciabili che possono essere facilmente aggiunte, rimosse e versionate indipendentemente dal core dell'applicazione.

## 📋 Indice

- [Panoramica](#panoramica)
- [Struttura Plugin](#struttura-plugin)
- [Creazione di un Plugin](#creazione-di-un-plugin)
- [Gestione Plugin](#gestione-plugin)
  - [Rimozione Plugin](#rimozione-plugin)
  - [Disabilitazione Temporanea](#disabilitazione-temporanea)
  - [Riattivazione Plugin](#riattivazione-plugin)
- [Gestione Permessi](#gestione-permessi)
- [Registrazione Plugin](#registrazione-plugin)
- [Routing Automatico](#routing-automatico)
- [Best Practices](#best-practices)
- [Esempi Completi](#esempi-completi)

## 🌟 Panoramica

Il sistema plugin è basato su:
- **Registry centrale** per gestione plugin
- **Routing automatico** basato sui plugin attivi
- **Sistema di permessi** integrato con autenticazione
- **Sidebar dinamica** che si aggiorna automaticamente
- **Lazy loading** per ottimizzazione performance

### Vantaggi

✅ **Modulare**: Ogni plugin è completamente indipendente
✅ **Sganciabile**: Facile rimozione senza impatti sul core
✅ **Versionabile**: Ogni plugin ha la sua versione
✅ **Scalabile**: Aggiunta di nuovi plugin senza modifiche al core
✅ **Sicuro**: Sistema di permessi integrato

## 🏗️ Struttura Plugin

```
src/plugins/
├── types.ts                    # Definizioni TypeScript
├── registry.ts                 # Registry centrale
├── index.ts                    # Inizializzazione
├── dashboard/                  # Plugin Dashboard
│   ├── index.ts               # Configurazione plugin
│   ├── DashboardPage.tsx      # Componente principale
│   └── components/            # Componenti specifici (opzionale)
└── datalogger/                # Plugin DataLogger
    ├── index.ts
    ├── DataLoggerPage.tsx
    └── components/
```

### Interfacce Principali

```typescript
interface Plugin {
  metadata: PluginMetadata        // Info plugin (id, nome, versione)
  routes: PluginRoute[]          // Rotte del plugin
  navItems: PluginNavItem[]      // Elementi sidebar
  permissions?: PluginPermission // Controllo accessi
  enabled: boolean               // Stato attivazione
  initialize?: () => void        // Funzione inizializzazione
  cleanup?: () => void           // Funzione pulizia
}
```

## 🛠️ Creazione di un Plugin

### 1. Creare la Struttura Directory

```bash
mkdir -p src/plugins/mio-plugin/components
```

### 2. Creare il Componente Principale

```typescript
// src/plugins/mio-plugin/MioPluginPage.tsx
"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MioPluginPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mio Plugin</h1>
        <p className="text-muted-foreground">Descrizione del plugin</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funzionalità Plugin</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Contenuto del plugin...</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 3. Creare la Configurazione Plugin

```typescript
// src/plugins/mio-plugin/index.ts
import { Plugin } from '../types'
import { Settings } from 'lucide-react'

export const mioPlugin: Plugin = {
  metadata: {
    id: 'mio-plugin',
    name: 'Mio Plugin',
    version: '1.0.0',
    description: 'Descrizione del mio plugin personalizzato',
    author: 'Il Mio Nome'
  },
  routes: [
    {
      path: '/mio-plugin',
      component: () => import('./MioPluginPage'),
      title: 'Mio Plugin'
    }
  ],
  navItems: [
    {
      title: 'Mio Plugin',
      url: '/mio-plugin',
      icon: Settings,
      description: 'Accedi al mio plugin'
    }
  ],
  permissions: {
    role: 'guest' // 'guest', 'staff', 'superuser'
  },
  enabled: true,
  initialize: () => {
    console.log('Mio Plugin inizializzato')
  }
}
```

### 4. Creare la Rotta Next.js

```typescript
// src/app/(private)/(guest)/mio-plugin/page.tsx
import { PluginRouteRenderer } from "@/components/PluginRouteRenderer";

export default function MioPluginPage() {
    return <PluginRouteRenderer />;
}
```

### 5. Registrare il Plugin

```typescript
// src/plugins/index.ts
import { mioPlugin } from './mio-plugin'

export function initializePlugins() {
  // ... altri plugin
  pluginRegistry.register(mioPlugin)
}
```

## 🔧 Gestione Plugin

### Rimozione Plugin

Per rimuovere completamente un plugin dal sistema:

#### 1. Disregistrazione dal Registry

```typescript
// src/plugins/index.ts
export function initializePlugins() {
  pluginRegistry.register(dashboardPlugin)
  // pluginRegistry.register(dataloggerPlugin) ← Commenta o rimuovi questa riga

  // Oppure rimuovi completamente l'import e la registrazione
  // import { dataloggerPlugin } from './datalogger' ← Rimuovi import
}
```

#### 2. Rimozione Files Plugin (Opzionale)

```bash
# Opzione A: Elimina directory completa
rm -rf src/plugins/mio-plugin/

# Opzione B: Mantieni codice per uso futuro
# Lascia i file sul filesystem ma non registrare il plugin
```

#### 3. Rimozione Rotte Next.js

```bash
# Rimuovi la pagina di routing corrispondente
rm -f src/app/(private)/(guest)/mio-plugin/page.tsx
# O la path appropriata per il tuo plugin
```

#### 4. Risultato della Rimozione

✅ **Plugin rimosso** dalla sidebar automaticamente
✅ **Rotta non più accessibile**
✅ **Nessun impatto** su altri plugin
✅ **Sistema continua** a funzionare normalmente

### Disabilitazione Temporanea

Per disabilitare temporaneamente un plugin senza rimuovere il codice:

#### Metodo 1: Flag Enabled

```typescript
// src/plugins/mio-plugin/index.ts
export const mioPlugin: Plugin = {
  metadata: {
    id: 'mio-plugin',
    name: 'Mio Plugin',
    version: '1.0.0',
    description: 'Plugin temporaneamente disabilitato'
  },
  // ... resto configurazione
  enabled: false  // ← Disabilita plugin
}
```

#### Metodo 2: Disabilitazione Condizionale

```typescript
// src/plugins/mio-plugin/index.ts
export const mioPlugin: Plugin = {
  // ... configurazione
  enabled: process.env.NODE_ENV === 'development', // Solo in development
  // oppure
  enabled: process.env.ENABLE_MIO_PLUGIN === 'true' // Controllo environment
}
```

#### Metodo 3: Disabilitazione per Ambiente

```typescript
// src/plugins/index.ts
export function initializePlugins() {
  pluginRegistry.register(dashboardPlugin)

  // Registra solo in development
  if (process.env.NODE_ENV === 'development') {
    pluginRegistry.register(dataloggerPlugin)
  }

  // Registra solo se variabile ambiente settata
  if (process.env.ENABLE_ADVANCED_PLUGINS === 'true') {
    pluginRegistry.register(advancedPlugin)
  }
}
```

### Riattivazione Plugin

Per riattivare un plugin precedentemente disabilitato:

#### 1. Riattivazione Semplice

```typescript
// src/plugins/index.ts
export function initializePlugins() {
  pluginRegistry.register(dashboardPlugin)
  pluginRegistry.register(dataloggerPlugin) // ← Decommmenta/aggiungi
}
```

#### 2. Riattivazione con Flag

```typescript
// src/plugins/mio-plugin/index.ts
export const mioPlugin: Plugin = {
  // ... configurazione
  enabled: true  // ← Cambia da false a true
}
```

#### 3. Verifica Riattivazione

```typescript
// Console browser per debug
console.log('Plugin registrati:', Array.from(pluginRegistry.plugins.keys()))
console.log('Plugin abilitati:', pluginRegistry.getEnabledPlugins().map(p => p.metadata.id))
```

### Plugin Management Utilities

#### Funzioni di Utility per Gestione Plugin

```typescript
// src/plugins/utils.ts
export function listEnabledPlugins(): string[] {
  return pluginRegistry.getEnabledPlugins().map(p => p.metadata.id)
}

export function isPluginEnabled(pluginId: string): boolean {
  const plugin = pluginRegistry.getPlugin(pluginId)
  return plugin ? plugin.enabled : false
}

export function getPluginInfo(pluginId: string) {
  const plugin = pluginRegistry.getPlugin(pluginId)
  return plugin ? {
    id: plugin.metadata.id,
    name: plugin.metadata.name,
    version: plugin.metadata.version,
    enabled: plugin.enabled,
    routesCount: plugin.routes.length,
    navItemsCount: plugin.navItems.length
  } : null
}

// Debug function per development
export function debugPluginSystem() {
  console.group('🔌 Plugin System Debug')
  console.log('Total plugins:', pluginRegistry.plugins.size)
  console.log('Enabled plugins:', listEnabledPlugins())

  pluginRegistry.plugins.forEach((plugin, id) => {
    console.group(`Plugin: ${id}`)
    console.log('Enabled:', plugin.enabled)
    console.log('Routes:', plugin.routes.length)
    console.log('Nav items:', plugin.navItems.length)
    console.log('Permissions:', plugin.permissions)
    console.groupEnd()
  })
  console.groupEnd()
}
```

#### Runtime Plugin Management (Avanzato)

```typescript
// src/hooks/usePluginManager.ts
export function usePluginManager() {
  const [enabledPlugins, setEnabledPlugins] = useState<string[]>([])

  const togglePlugin = useCallback((pluginId: string) => {
    const plugin = pluginRegistry.getPlugin(pluginId)
    if (plugin) {
      plugin.enabled = !plugin.enabled
      setEnabledPlugins(listEnabledPlugins())

      // Trigger re-render della sidebar
      window.dispatchEvent(new CustomEvent('plugin-state-changed'))
    }
  }, [])

  const enablePlugin = useCallback((pluginId: string) => {
    const plugin = pluginRegistry.getPlugin(pluginId)
    if (plugin) {
      plugin.enabled = true
      setEnabledPlugins(listEnabledPlugins())
      window.dispatchEvent(new CustomEvent('plugin-state-changed'))
    }
  }, [])

  const disablePlugin = useCallback((pluginId: string) => {
    const plugin = pluginRegistry.getPlugin(pluginId)
    if (plugin) {
      plugin.enabled = false
      setEnabledPlugins(listEnabledPlugins())
      window.dispatchEvent(new CustomEvent('plugin-state-changed'))
    }
  }, [])

  return {
    enabledPlugins,
    togglePlugin,
    enablePlugin,
    disablePlugin
  }
}
```

## 🔐 Gestione Permessi

Il sistema supporta tre livelli di permessi:

### Livelli Base

```typescript
// Accessibile a tutti gli utenti autenticati
permissions: { role: 'guest' }

// Solo per utenti staff
permissions: { role: 'staff' }

// Solo per superuser
permissions: { role: 'superuser' }
```

### Permessi Personalizzati

```typescript
// Permessi custom (per implementazioni future)
permissions: {
  role: 'staff',
  custom: ['can_read_logs', 'can_export_data']
}
```

Il sistema filtra automaticamente i plugin in base ai permessi dell'utente corrente.

## 📝 Registrazione Plugin

### Registry Automatico

Il registry gestisce automaticamente:
- **Registrazione** di nuovi plugin
- **Filtraggio** per permessi utente
- **Lazy loading** dei componenti
- **Gestione errori** durante il caricamento

### Metodi Principali

```typescript
// Registrare un plugin
pluginRegistry.register(mioPlugin)

// Ottenere plugin per utente
const userPlugins = pluginRegistry.getPluginsByPermission(userPermissions)

// Ottenere tutte le rotte
const routes = pluginRegistry.getAllPluginRoutes(userPermissions)

// Ottenere elementi nav
const navItems = pluginRegistry.getAllPluginNavItems(userPermissions)
```

## 🛣️ Routing Automatico

### PluginRouteRenderer

Il componente `PluginRouteRenderer` gestisce automaticamente:
- **Matching** delle rotte
- **Lazy loading** dei componenti
- **Gestione errori**
- **Stati di caricamento**

### Configurazione Rotte

```typescript
routes: [
  {
    path: '/mio-plugin',           // Percorso esatto
    component: () => import('./MioPluginPage'),
    title: 'Mio Plugin',
    exact: true                    // Match esatto (default: true)
  },
  {
    path: '/mio-plugin/sottosezione',
    component: () => import('./SottosezioneePage'),
    title: 'Sottosezione',
    exact: false                   // Match prefisso
  }
]
```

## 🎯 Best Practices

### 1. Naming Convention

```bash
# ID plugin: kebab-case
id: 'data-logger'

# Directory: kebab-case
src/plugins/data-logger/

# Componenti: PascalCase
DataLoggerPage.tsx

# Files: camelCase
dataLoggerUtils.ts
```

### 2. Struttura Consigliata

```
mio-plugin/
├── index.ts                    # Configurazione plugin
├── MioPluginPage.tsx          # Componente principale
├── components/                # Componenti riutilizzabili
│   ├── MioComponente.tsx
│   └── MioFormulario.tsx
├── hooks/                     # Custom hooks (se necessari)
│   └── useMioPlugin.ts
├── types.ts                   # Types specifici (se necessari)
└── utils.ts                   # Utility functions (se necessarie)
```

### 3. Gestione Stato

Per stato locale del plugin, usa:
- **useState/useReducer** per stato componente
- **Zustand** per stato condiviso (se necessario)
- **React Query** per stato server

```typescript
// Esempio stato plugin con Zustand
interface MioPluginState {
  isActive: boolean
  data: any[]
  setActive: (active: boolean) => void
}

const useMioPluginStore = create<MioPluginState>((set) => ({
  isActive: false,
  data: [],
  setActive: (active) => set({ isActive: active })
}))
```

### 4. Gestione Errori

```typescript
// Nel componente plugin
const [error, setError] = useState<string | null>(null)

try {
  // Operazioni plugin
} catch (err) {
  setError(`Errore in ${pluginName}: ${err.message}`)
  console.error(`Plugin ${pluginId} error:`, err)
}

// UI errore
{error && (
  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
    {error}
  </div>
)}
```

### 5. Performance

- **Lazy loading**: Sempre usare dynamic imports
- **Memoization**: Memorizza calcoli costosi
- **Cleanup**: Implementa funzioni di pulizia

```typescript
// Lazy loading
component: () => import('./MioPluginPage')

// Memoization
const expensiveData = useMemo(() => {
  return heavyCalculation(props.data)
}, [props.data])

// Cleanup
cleanup: () => {
  // Pulisci listeners, timers, etc.
  clearInterval(myInterval)
  eventEmitter.removeAllListeners()
}
```

## 📚 Esempi Completi

### Plugin Semplice

```typescript
// src/plugins/simple/SimplePage.tsx
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SimplePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plugin Semplice</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Contenuto del plugin semplice</p>
      </CardContent>
    </Card>
  );
}

// src/plugins/simple/index.ts
import { Plugin } from '../types'
import { Home } from 'lucide-react'

export const simplePlugin: Plugin = {
  metadata: {
    id: 'simple',
    name: 'Simple',
    version: '1.0.0',
    description: 'Un plugin di esempio semplice'
  },
  routes: [{
    path: '/simple',
    component: () => import('./SimplePage'),
    title: 'Simple'
  }],
  navItems: [{
    title: 'Simple',
    url: '/simple',
    icon: Home
  }],
  permissions: { role: 'guest' },
  enabled: true
}
```

### Plugin con Stato e API

```typescript
// src/plugins/advanced/AdvancedPage.tsx
"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdvancedPage() {
  const [counter, setCounter] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['advanced-data'],
    queryFn: async () => {
      const response = await fetch('/api/advanced-data');
      return response.json();
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Plugin Avanzato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p>Counter: {counter}</p>
              <Button onClick={() => setCounter(c => c + 1)}>
                Incrementa
              </Button>
            </div>

            <div>
              {isLoading && <p>Caricamento...</p>}
              {error && <p>Errore: {error.message}</p>}
              {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// src/plugins/advanced/index.ts
import { Plugin } from '../types'
import { Zap } from 'lucide-react'

export const advancedPlugin: Plugin = {
  metadata: {
    id: 'advanced',
    name: 'Advanced',
    version: '1.0.0',
    description: 'Plugin avanzato con stato e API'
  },
  routes: [{
    path: '/advanced',
    component: () => import('./AdvancedPage'),
    title: 'Advanced'
  }],
  navItems: [{
    title: 'Advanced',
    url: '/advanced',
    icon: Zap,
    description: 'Plugin con funzionalità avanzate'
  }],
  permissions: { role: 'staff' },
  enabled: true,
  initialize: () => {
    console.log('Advanced plugin inizializzato');
  },
  cleanup: () => {
    console.log('Advanced plugin terminato');
  }
}
```

## 🚀 Deploy e Produzione

### Configurazione Build

Il sistema plugin funziona automaticamente con il build di Next.js. Assicurati che:

1. Tutti i plugin siano registrati in `src/plugins/index.ts`
2. Le rotte Next.js esistano per ogni plugin
3. Non ci siano dipendenze circolari

### Abilitazione/Disabilitazione Plugin

```typescript
// Disabilitare temporaneamente un plugin
export const mioPlugin: Plugin = {
  // ... configurazione
  enabled: false  // Plugin disabilitato
}

// Abilitazione condizionale
export const mioPlugin: Plugin = {
  // ... configurazione
  enabled: process.env.NODE_ENV === 'development' // Solo in development
}
```

### Monitoraggio

```typescript
// Log inizializzazione plugin
initialize: () => {
  console.log(`Plugin ${metadata.name} v${metadata.version} inizializzato`)

  // In produzione, invio metriche
  if (process.env.NODE_ENV === 'production') {
    analytics.track('plugin_initialized', {
      pluginId: metadata.id,
      version: metadata.version
    })
  }
}
```

---

*Per domande o supporto sul sistema plugin, consulta la documentazione API o contatta il team di sviluppo.*