# Regole di Versionamento

Il nostro progetto segue le linee guida del **Versionamento Semantico** (SemVer).

## Formato della Versione
Le versioni sono nel formato `MAJOR.MINOR.PATCH` dove:
* **MAJOR**: incrementato per modifiche non retrocompatibili (ad esempio come le API).
* **MINOR**: incrementato per l'aggiunta di funzionalità in modo retrocompatibile.
* **PATCH**: incrementato per bug fix retrocompatibili.

## Changelog
Tutte le modifiche significative devono essere documentate nel file `CHANGELOG.md` nella directory root del progetto. Ogni voce del changelog deve seguire la struttura:
* `Added`: per nuove funzionalità.
* `Changed`: per modifiche a funzionalità esistenti.
* `Fixed`: per correzioni di bug.
* `Removed`: per funzionalità rimosse.
* `Security`: in caso di vulnerabilità.
* `Deprecated`: per funzionalità che verranno presto rimosse.

## TIPS
Tag su Git: Ogni volta che rilasci una nuova versione, è una buona idea creare un tag su Git (`git tag -a vX.Y.Z`). Questo segna un punto specifico nella storia del tuo codice e rende facile tornare a quella versione in qualsiasi momento.