# Testing Tab Site Isolation

Questo documento descrive come testare il sistema di isolamento dei contesti site per tab implementato.

## Test Cases

### Test 1: Basic Tab Isolation
1. **Setup**: Avvia l'applicazione e vai alla home page
2. **Verifica modalità normale**: Il SiteSelector globale dovrebbe essere visibile nell'header
3. **Attiva Tab Mode**: Click sul toggle "Tab Mode"
4. **Verifica header**: Il SiteSelector globale dovrebbe sparire e essere sostituito dal GlobalSiteIndicator
5. **Apri pagina datalogger**: Naviga a `/datalogger`
6. **Verifica tab header**: Dovrebbe mostrare il TabContextHeader con TabSiteSelector specifico per questa tab

### Test 2: Multiple Tab Independence
1. **Setup**: Con tab mode attivo, apri 3 tab della pagina `/datalogger`
2. **Verifica tab IDs**: Ogni tab dovrebbe avere un ID unico visibile nel diagnostics
3. **Test site selection**:
   - Tab 1: Seleziona Site A dal TabSiteSelector
   - Tab 2: Seleziona Site B dal TabSiteSelector
   - Tab 3: Lascia eredità dal global (nessuna selezione specifica)
4. **Verifica isolamento**: Ogni tab dovrebbe mostrare i datalogger del sito corrispondente
5. **Verifica persistenza**: Cambia tab avanti e indietro - ogni tab mantiene la sua selezione site

### Test 3: Grid Mode Isolation
1. **Setup**: Disattiva tab mode, attiva grid mode
2. **Crea sezioni**: Dividi la griglia in 2-3 sezioni
3. **Assegna pagine**: Assegna `/datalogger` a ogni sezione
4. **Test isolamento sezioni**: Ogni sezione dovrebbe avere il suo contesto site indipendente

### Test 4: Fallback to Global
1. **Setup**: Tab mode attivo con 2 tab datalogger
2. **Tab 1**: Seleziona un site specifico
3. **Tab 2**: Lascia eredità dal global
4. **Cambia global site**: Vai in normal mode e cambia il site globale
5. **Verifica comportamento**:
   - Tab 1: Dovrebbe mantenere il suo site specifico
   - Tab 2: Dovrebbe mostrare il nuovo site globale

### Test 5: Cleanup on Tab Close
1. **Setup**: Apri 3 tab datalogger con site diversi
2. **Verifica storage**: Controlla che i contesti siano memorizzati
3. **Chiudi tab**: Chiudi 2 tab
4. **Verifica cleanup**: I contesti delle tab chiuse dovrebbero essere rimossi dallo storage

## Test Page

È disponibile una pagina di test dedicata: `/test-tab-isolation`

Questa pagina mostra:
- Site corrente selezionato
- Tipo di contesto (global/tab)
- Diagnostics dettagliati
- Lista di tutti i site disponibili
- Istruzioni per il testing

## Expected Behavior

### Normal Mode (No tabs/grid)
- SiteSelector globale visibile in header
- Tutti i componenti usano lo stesso selectedSiteId

### Tab Mode
- SiteSelector globale nascosto
- GlobalSiteIndicator mostra informazioni stato
- Ogni tab ha TabContextHeader con proprio TabSiteSelector
- Ogni tab può avere selectedSiteId diverso e indipendente

### Grid Mode
- SiteSelector globale nascosto
- Ogni sezione grid ha contesto indipendente (implementazione futura)

### Tab + Grid Mode
- Combinazione dei comportamenti sopra

## Debugging

Per debug, controlla:

1. **React DevTools**: Verifica che i provider siano nidificati correttamente
2. **Local Storage**: Chiave `tab-site-storage` contiene i contesti delle tab
3. **Console logs**: Il sistema logga cleanup e errori
4. **Tab IDs**: Ogni tab ha un ID unico nel formato `url-timestamp`

## Note Implementation

- Il sistema usa `useUnifiedSiteContext()` invece di `useSiteContext()`
- Compatibilità backward: componenti esistenti continuano a funzionare
- Cleanup automatico: contesti vecchi vengono rimossi dopo 24 ore
- Persistenza: i contesti sopravvivono ai reload della pagina