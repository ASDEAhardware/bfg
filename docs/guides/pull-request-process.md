# 🔄 Processo Pull Request

Questa guida descrive il processo standard per le pull request nel progetto BFG.

## 📋 Template Pull Request

Quando crei una pull request, usa il seguente template:

### 🚀 Tipo di Modifica
- [ ] Bug Fix (correzione di un problema)
- [ ] Nuova Funzionalità (aggiunta di una feature)
- [ ] Refactoring (cambiamento del codice senza alterare la funzionalità)
- [ ] Chore (manutenzione, aggiornamento dipendenze)
- [ ] Plugin (aggiunta/modifica di un plugin)
- [ ] Documentazione (aggiornamenti alla documentazione)

---

### 📝 Descrizione del Lavoro

**Problema:**
[Descrivi brevemente il problema risolto. Se è legato a un'Issue, menzionala: `Risolve #123`]

**Soluzione:**
[Spiega la logica dietro le tue modifiche.]

#### Modifiche Dettagliate

- [Dettaglio 1]
- [Dettaglio 2]
- [Dettaglio 3]

---

### ✅ Lista di Controllo per la Revisione

- [ ] Ho eseguito un test locale del mio codice
- [ ] Il mio codice segue gli standard di stile del progetto
- [ ] La documentazione è stata aggiornata (se necessario)
- [ ] Non ci sono conflitti di merge
- [ ] I test passano tutti
- [ ] Ho testato sui browser principali (se frontend)
- [ ] Ho aggiornato il CHANGELOG se necessario

---

### 🧪 Come Testare (Passaggi per il Revisore)

1. Checkout del branch: `git checkout feature/nome-branch`
2. Installazione dipendenze: `npm install`
3. Avvio ambiente: `npm run dev`
4. Passi specifici per testare la feature:
   - Passo A...
   - Passo B...
   - Verifica il Risultato Atteso...

---

## 🔍 Processo di Review

### 1. Controlli Automatici
- ✅ Build passa
- ✅ Test unitari passano
- ✅ Lint e format check
- ✅ Controlli di sicurezza

### 2. Review Manuale
- **Codice**: Leggibilità, manutenibilità, performance
- **Architettura**: Coerenza con pattern esistenti
- **UI/UX**: Coerenza con design system (se frontend)
- **Sicurezza**: Controllo vulnerabilità e best practices

### 3. Testing
- **Funzionale**: La feature funziona come previsto
- **Regressione**: Non rompe funzionalità esistenti
- **Performance**: Non degrada le performance
- **Compatibilità**: Funziona su browser/ambienti target

## 📚 Linee Guida per i Contributor

### Prima di Aprire una PR

1. **Branch**: Crea un branch descrittivo
   ```bash
   git checkout -b feature/nome-feature
   git checkout -b fix/descrizione-bug
   git checkout -b plugin/nome-plugin
   ```

2. **Commit**: Usa commit message descrittivi
   ```bash
   git commit -m "feat: aggiunge sistema di notifiche real-time"
   git commit -m "fix: corregge validazione form login"
   git commit -m "plugin: aggiunge datalogger con export CSV"
   ```

3. **Test Locali**: Assicurati che tutto funzioni
   ```bash
   npm run dev    # Test sviluppo
   npm run build  # Test build
   npm run lint   # Test stile codice
   ```

### Durante la Review

- **Rispondi ai commenti** in modo costruttivo
- **Applica i suggerimenti** quando appropriato
- **Richiedi chiarimenti** se necessario
- **Mantieni la discussione** focalizzata e professionale

### Dopo l'Approvazione

1. **Squash commits** se richiesto
2. **Aggiorna il CHANGELOG** se è una feature/fix importante
3. **Merge** solo dopo tutti i controlli verdi

## 🚀 Best Practices

### Per i Contributor

- **Una feature per PR**: Mantieni le PR focalizzate
- **Descrizione chiara**: Spiega il "perché", non solo il "cosa"
- **Test inclusi**: Aggiungi test per nuove funzionalità
- **Documentazione**: Aggiorna docs se necessario

### Per i Reviewer

- **Review tempestiva**: Entro 24-48h quando possibile
- **Feedback costruttivo**: Suggerisci soluzioni, non solo problemi
- **Approva se soddisfatto**: Non trattenere PR per dettagli minori
- **Testa localmente**: Per feature complesse

## 🔧 Troubleshooting

### Conflitti di Merge

```bash
# Aggiorna il tuo branch
git checkout main
git pull origin main
git checkout tuo-branch
git rebase main

# Risolvi conflitti e continua
git add .
git rebase --continue
```

### Build Fallito

1. Controlla i log di build
2. Testa localmente: `npm run build`
3. Verifica dipendenze aggiornate: `npm install`
4. Controlla errori di lint: `npm run lint`

### Test Falliti

1. Esegui test localmente: `npm test`
2. Controlla modifiche ai test esistenti
3. Aggiungi test mancanti per nuove feature
4. Verifica mock e configurazioni test

---

*Per supporto o domande sul processo, contatta il team di sviluppo.*