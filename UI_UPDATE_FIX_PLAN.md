# Piano di Correzione: Aggiornamento UI in Tempo Reale

Questo documento descrive la correzione per il problema di aggiornamento della UI che non rifletteva lo stato reale delle connessioni MQTT dopo un'operazione di Start/Stop, nonostante l'implementazione WebSocket.

---

### Problema Riscontrato

Dopo aver cliccato su Start/Stop, la UI mostrava correttamente lo stato di caricamento ottimistico, ma rimaneva bloccata su tale stato (o sull'ultimo stato noto) anche dopo che il backend aveva completato l'operazione e inviato l'aggiornamento via WebSocket. L'aggiornamento effettivo avveniva solo dopo un refresh manuale della pagina (F5).

### Causa del Problema

Il problema risiede nel modo in cui il frontend gestiva l'aggiornamento della cache di `react-query` tramite il WebSocket. L'uso di `queryClient.setQueryData` con una logica condizionale (`if (oldData) { ... } return oldData;`) non garantiva un aggiornamento robusto della cache, specialmente se i dati non erano già presenti o erano stati invalidati/garbage collected da `react-query`.

### Soluzione Proposta: `queryClient.invalidateQueries`

La soluzione più robusta e idiomatica con `react-query` per gli aggiornamenti in tempo reale è utilizzare `queryClient.invalidateQueries`. Invece di tentare di manipolare manualmente la cache, `invalidateQueries` dice a `react-query` che i dati per una specifica chiave di query sono obsoleti e devono essere ri-fetchati dal backend. `react-query` si occuperà automaticamente di eseguire nuovamente la `queryFn` associata a quella chiave, garantendo che la UI visualizzi sempre i dati più freschi.

---

### Fase 1: Modifica `useMqttStatusSocket.ts`

**Obiettivo**: Sostituire l'aggiornamento manuale della cache con l'invalidazione delle query.

1.  **File da modificare**: `frontend/src/hooks/useMqttStatusSocket.ts`
2.  **Modifica**: All'interno del blocco `ws.current.onmessage`, sostituire le chiamate a `queryClient.setQueryData` con `queryClient.invalidateQueries` per le `queryKey` `['mqttConnectionStatus', site_id]` e `['dataloggers', site_id]`.

    **Codice da sostituire (all'interno di `onmessage`):**
    ```typescript
    // Aggiorna lo stato della connessione MQTT per il sito specifico
    queryClient.setQueryData(['mqttConnectionStatus', site_id], (oldData: any) => {
      if (oldData) {
        return { ...oldData, status, is_enabled };
      }
      return oldData; // Se non c'è oldData, non facciamo nulla per ora
    });

    // Aggiorna lo stato is_online per i datalogger associati a quel sito
    queryClient.setQueryData(['dataloggers', site_id], (oldData: any) => {
      if (oldData && Array.isArray(oldData.dataloggers)) {
        return {
          ...oldData,
          dataloggers: oldData.dataloggers.map((d: any) =>
            d.site_id === site_id ? { ...d, is_online: is_enabled } : d
          ),
        };
      }
      return oldData;
    });
    ```

    **Con questo codice:**
    ```typescript
    // Invalida la query per lo stato della connessione MQTT per il sito specifico
    // Questo farà sì che react-query esegua un refetch dell'API
    queryClient.invalidateQueries({ queryKey: ['mqttConnectionStatus', site_id] });

    // Invalida anche la query per i datalogger, dato che is_online potrebbe essere cambiato
    queryClient.invalidateQueries({ queryKey: ['dataloggers', site_id] });
    ```

---

### Fase 2: Verifica e Test

1.  **Ricostruire e Riavviare**: Dopo aver applicato la modifica, sarà necessario ricostruire l'immagine Docker del frontend e riavviare i container (`podman-compose up --build`).
2.  **Testare il Flusso**: Verificare che al click di Start/Stop, la UI mostri lo stato di caricamento e poi si aggiorni automaticamente allo stato corretto (connesso/disconnesso) non appena il WebSocket invia l'aggiornamento, senza bisogno di refresh manuali.

Questo piano garantirà che la UI si aggiorni sempre con i dati più freschi provenienti dal backend, risolvendo il problema di UX riscontrato.
