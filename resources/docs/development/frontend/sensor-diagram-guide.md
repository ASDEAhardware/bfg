# Guida alla Configurazione Visuale dei Sensori (SensorDiagram)

Questo documento descrive l'architettura e il funzionamento del componente `SensorDiagram`, utilizzato per associare visivamente dei sensori alle porte di un dispositivo IoT.

---

## 1. Scopo e Funzionalità

Il sistema `SensorDiagram` permette all'utente di:
- Visualizzare un diagramma SVG di un dispositivo IoT con le sue porte di connessione.
- Assegnare un tipo di sensore a ciascuna porta tramite un menu a discesa.
- Vedere la configurazione corrente in modo intuitivo, con icone e nomi dei sensori.
- Mantenere la configurazione salvata localmente, in modo che persista tra le sessioni e i ricaricamenti della pagina.

---

## 2. Componenti Chiave

Il sistema è composto da quattro file principali che lavorano in sinergia:

1.  **`@/config/sensors.ts`**: Il file di configurazione centrale per tutti i tipi di sensore disponibili.
2.  **`@/store/sensorConfigStore.ts`**: Lo store Zustand che gestisce lo stato della configurazione e la sua persistenza.
3.  **`@/components/SensorDiagram.tsx`**: Il componente React principale che renderizza il diagramma e orchestra gli altri elementi.
4.  **`@/components/sensor-dropdown.tsx`**: Il componente UI per il singolo menu a discesa di selezione del sensore.

---

## 3. Flusso dei Dati e Gestione dello Stato

La logica di funzionamento si basa su uno stato globale gestito da Zustand, che viene salvato nel `localStorage` del browser.

### `sensorConfigStore.ts`

- **Tecnologia**: Zustand con il middleware `persist`.
- **Scopo**: Mantenere un oggetto `selectedSensors` che mappa l'ID di una porta (es. `"port-1"`) al nome del sensore selezionato (es. `"Sensore Temperatura"`).
- **Persistenza**: Grazie al middleware `persist`, lo stato dello store viene automaticamente salvato nel `localStorage` con la chiave `sensor-configuration-storage` a ogni modifica. Al caricamento dell'applicazione, lo stato viene ripristinato dal `localStorage`, garantendo la persistenza.
- **Azioni**:
    - `setSelectedSensor(portId, sensor)`: Associa un sensore a una porta.
    - `removeSensor(portId)`: Rimuove l'associazione per una data porta.

```typescript
// Struttura dello stato in localStorage
{
  "state": {
    "selectedSensors": {
      "port-1": "Sensore Temperatura",
      "port-4": "Sensore Umidità"
    }
  },
  "version": 0
}
```

---

## 4. Configurazione dei Tipi di Sensore (`sensors.ts`)

Questo è il file più importante per la manutenzione e l'espansione dei sensori.

- **Single Source of Truth**: Funge da unica fonte di verità per definire quali sensori sono disponibili nell'applicazione.
- **Struttura `SensorType`**: Definisce un'interfaccia per ogni sensore, che deve avere:
    - `name: string`: Il nome univoco del sensore.
    - `icon: LucideIcon`: Il componente icona importato da `lucide-react`.
- **`SENSOR_TYPES`**: Un array esportato che contiene gli oggetti di tutti i sensori disponibili. Questo array viene usato per popolare i menu a discesa.
- **`SENSOR_ICONS`**: Un oggetto (mappa) esportato per un accesso rapido all'icona di un sensore tramite il suo nome. È un'utilità per ottimizzare le ricerche.

### **Come aggiungere un nuovo sensore:**

Per aggiungere un nuovo tipo di sensore, è sufficiente modificare **solo questo file**:
1.  Importare la nuova icona da `lucide-react`.
2.  Aggiungere un nuovo oggetto all'array `SENSOR_TYPES` con il nome e l'icona del nuovo sensore.

```typescript
// Esempio di aggiunta di un sensore
import { ..., Barometer } from 'lucide-react';

export const SENSOR_TYPES: SensorType[] = [
  // ... altri sensori
  { name: "Sensore Luce", icon: Sun },
  { name: "Sensore Pressione Barometrica", icon: Barometer }, // Nuova aggiunta
];
```
Il resto dell'applicazione si adatterà automaticamente.

---

## 5. Componenti UI

### `SensorDiagram.tsx`

- È il componente "contenitore" che assembla l'intera interfaccia.
- Legge lo stato `selectedSensors` direttamente dallo store `useSensorConfigStore`.
- Itera sulla costante locale `PORTS` per renderizzare le linee, le etichette e i componenti `SensorDropdown` per ogni porta.
- Passa a `sensor-dropdown` i dati necessari: la lista di tutti i sensori (`SENSOR_TYPES`), il sensore attualmente selezionato per quella porta, e le funzioni per gestire la selezione/rimozione.

### `sensor-dropdown.tsx`

- Rappresenta il singolo menu a discesa.
- Riceve la lista di `SENSOR_TYPES` e la usa per renderizzare le opzioni nel menu.
- Se un sensore è selezionato (`selectedSensor` non è `null`), visualizza il pulsante con l'icona e il nome del sensore.
- **Logica Responsive**:
    - Su schermi piccoli (mobile), il pulsante del sensore selezionato mostra **solo l'icona**.
    - Su schermi più grandi (`sm` e superiori), mostra **icona e nome**.
- Quando un utente seleziona o rimuove un sensore, questo componente chiama le azioni appropriate (`setSelectedSensor`, `removeSensor`) fornite dallo store Zustand tramite props.

---

## 6. Componenti Correlati e Utilità

### `@/hooks/sensor/useIsMdUp.ts`

- **Scopo**: Questo è un custom hook che rileva se la larghezza del viewport è superiore o uguale al breakpoint `md` di Tailwind (768px).
- **Utilizzo**: Restituisce un booleano (`true` se lo schermo è >= 768px). Sebbene `SensorDiagram` attualmente utilizzi le classi responsive di Tailwind (`sm:`, `md:`, etc.) per il suo layout, questo hook è lo strumento da utilizzare qualora fosse necessaria una logica responsive più complessa direttamente in JavaScript (ad esempio, per modificare dinamicamente gli attributi di un componente React in base alla dimensione dello schermo).

---

## 7. Roadmap e Sviluppi Futuri

L'attuale implementazione basata su `localStorage` è una **soluzione temporanea focalizzata sul frontend**.

Il passo successivo, come da discussione iniziale, sarà sostituire la persistenza su `localStorage` con una **soluzione basata su API e database**. Lo store `useSensorConfigStore` verrà modificato per:
1.  Effettuare una chiamata `GET` al backend per caricare la configurazione all'avvio.
2.  Effettuare chiamate `POST`/`PUT` per salvare le modifiche sul server, probabilmente utilizzando una logica di "debounce" per non sovraccaricare il backend.

La struttura attuale è già predisposta per questa evoluzione, poiché la logica di stato è centralizzata e disaccoppiata dai componenti UI.