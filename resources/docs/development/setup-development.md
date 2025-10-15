# 🛠️ Setup Ambiente di Sviluppo

Guida completa per configurare l'ambiente di sviluppo locale del progetto BFG.

## 📋 Prerequisiti

### Software Richiesto

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **npm** >= 9.0.0 (incluso con Node.js)
- **Docker** >= 24.0.0 ([Download](https://www.docker.com/))
- **Docker Compose** >= 2.0.0
- **Git** ([Download](https://git-scm.com/))

### Verifica Installazione

```bash
node --version    # >= 18.0.0
npm --version     # >= 9.0.0
docker --version  # >= 24.0.0
docker compose version  # >= 2.0.0
git --version
```

## 🚀 Setup Rapido

### 1. Clone del Repository

```bash
git clone https://github.com/ASDEAhardware/bfg.git
cd bfg
```

### 2. Configurazione Environment

```bash
# Backend
cp backend/example.env backend/.env

# Frontend
cp frontend/example.env.local frontend/.env.local
```

### 3. Avvio con Docker

```bash
# Avvio completo (backend + frontend + database)
docker compose up --build

# Avvio in background
docker compose up -d --build
```

### 4. Accesso all'Applicazione

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Admin Django**: http://localhost:8000/admin

## 🔧 Setup Dettagliato

### Configurazione Backend

#### 1. Environment Variables

```bash
# backend/.env
DEBUG=True
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://bfg_user:bfg_password@db:5432/bfg_db
ALLOWED_HOSTS=localhost,127.0.0.1,frontend
CORS_ALLOWED_ORIGINS=http://localhost:3000

# JWT Settings
JWT_PRIVATE_KEY=path/to/private.pem
JWT_PUBLIC_KEY=path/to/public.pem
JWT_ALGORITHM=RS256

# Database
POSTGRES_DB=bfg_db
POSTGRES_USER=bfg_user
POSTGRES_PASSWORD=bfg_password
```

#### 2. Generazione Chiavi JWT

```bash
# Genera coppia di chiavi RSA
openssl genrsa -out backend/keys/private.pem 2048
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem

# Aggiorna .env con i percorsi corretti
JWT_PRIVATE_KEY=keys/private.pem
JWT_PUBLIC_KEY=keys/public.pem
```

### Configurazione Frontend

#### 1. Environment Variables

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=BFG Dashboard
NEXT_PUBLIC_VERSION=1.2.0

# Internal API (BFF)
INTERNAL_API_URL=http://backend:8000
JWT_PUBLIC_KEY_URL=http://backend:8000/api/auth/public-key/
```

#### 2. Installazione Dipendenze (Opzionale)

```bash
cd frontend
npm install
```

## 🐳 Comandi Docker Utili

### Gestione Container

```bash
# Avvio servizi
docker compose up                    # Avvio con logs
docker compose up -d                 # Avvio in background
docker compose up --build            # Rebuild e avvio

# Stop e cleanup
docker compose down                  # Stop container
docker compose down -v              # Stop + rimuovi volumi
docker compose down --rmi all       # Stop + rimuovi immagini

# Logs
docker compose logs                  # Tutti i logs
docker compose logs frontend        # Logs frontend
docker compose logs backend         # Logs backend
docker compose logs -f              # Seguire logs in real-time
```

### Gestione Database

```bash
# Accesso al database
docker compose exec db psql -U bfg_user -d bfg_db

# Backup database
docker compose exec db pg_dump -U bfg_user bfg_db > backup.sql

# Restore database
cat backup.sql | docker compose exec -T db psql -U bfg_user -d bfg_db

# Reset database
docker compose down -v
docker compose up -d db
docker compose exec backend python manage.py migrate
```

### Comandi Backend Django

```bash
# Migrazioni
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate

# Creazione superuser
docker compose exec backend python manage.py createsuperuser

# Shell Django
docker compose exec backend python manage.py shell

# Collezione file statici
docker compose exec backend python manage.py collectstatic
```

## 💻 Sviluppo Locale (Senza Docker)

### Setup Backend

```bash
cd backend

# Ambiente virtuale Python
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Installazione dipendenze
pip install -r requirements.txt

# Database locale (PostgreSQL richiesto)
createdb bfg_db
python manage.py migrate

# Avvio server
python manage.py runserver 8000
```

### Setup Frontend

```bash
cd frontend

# Installazione dipendenze
npm install

# Avvio server sviluppo
npm run dev

# Build produzione
npm run build
npm start
```

## 🔍 Debugging e Testing

### Debug Backend

```bash
# Logs dettagliati
DEBUG=True python manage.py runserver

# Test
python manage.py test

# Coverage
coverage run --source='.' manage.py test
coverage report
coverage html
```

### Debug Frontend

```bash
# Modalità sviluppo con debug
npm run dev

# Analisi bundle
npm run build
npm run analyze  # Se configurato

# Test (se configurati)
npm test
npm run test:watch
```

### Debug Container

```bash
# Accesso shell container
docker compose exec backend bash
docker compose exec frontend sh

# Inspect container
docker inspect bfg-backend-1
docker inspect bfg-frontend-1

# Monitoraggio risorse
docker stats
```

## 🛠️ Configurazione IDE

### VSCode

#### Estensioni Consigliate

```json
// .vscode/extensions.json
{
  \"recommendations\": [
    \"ms-python.python\",
    \"bradlc.vscode-tailwindcss\",
    \"ms-vscode.vscode-typescript-next\",
    \"esbenp.prettier-vscode\",
    \"ms-python.flake8\",
    \"ms-vscode.vscode-docker\"
  ]
}
```

#### Settings

```json
// .vscode/settings.json
{
  \"python.defaultInterpreterPath\": \"./backend/venv/bin/python\",
  \"typescript.preferences.importModuleSpecifier\": \"relative\",
  \"tailwindCSS.experimental.classRegex\": [
    [\"cva\\\\(([^)]*)\\\\)\", \"[\\\"'`]([^\\\"'`]*).*?[\\\"'`]\"],
    [\"cx\\\\(([^)]*)\\\\)\", \"(?:'|\\\")([^']*)(?:'|\\\")\"]
  ],
  \"files.associations\": {
    \"*.css\": \"tailwindcss\"
  }
}
```

### Debugging Config

```json
// .vscode/launch.json
{
  \"version\": \"0.2.0\",
  \"configurations\": [
    {
      \"name\": \"Django\",
      \"type\": \"python\",
      \"request\": \"launch\",
      \"program\": \"${workspaceFolder}/backend/manage.py\",
      \"args\": [\"runserver\"],
      \"django\": true,
      \"cwd\": \"${workspaceFolder}/backend\"
    },
    {
      \"name\": \"Next.js\",
      \"type\": \"node\",
      \"request\": \"launch\",
      \"program\": \"${workspaceFolder}/frontend/node_modules/.bin/next\",
      \"args\": [\"dev\"],
      \"cwd\": \"${workspaceFolder}/frontend\"
    }
  ]
}
```

## 🚀 Workflow di Sviluppo

### 1. Nuovo Feature

```bash
# 1. Aggiorna main
git checkout main
git pull origin main

# 2. Crea branch feature
git checkout -b feature/nome-feature

# 3. Sviluppo
# ... modifiche codice ...

# 4. Test locale
docker compose up --build
npm run dev  # se locale

# 5. Commit e push
git add .
git commit -m \"feat: descrizione feature\"
git push origin feature/nome-feature

# 6. Crea Pull Request
```

### 2. Bug Fix

```bash
# 1. Crea branch da main
git checkout -b fix/descrizione-bug

# 2. Identifica e correggi bug
# ... debug e fix ...

# 3. Test fix
# ... verifica risoluzione ...

# 4. Commit e PR
git add .
git commit -m \"fix: descrizione fix\"
git push origin fix/descrizione-bug
```

### 3. Nuovo Plugin

```bash
# 1. Crea branch plugin
git checkout -b plugin/nome-plugin

# 2. Crea struttura plugin
mkdir -p frontend/src/plugins/nome-plugin

# 3. Implementa plugin seguendo la guida
# Vedi: docs/development/plugin-system.md

# 4. Test e integrazione
# ... test plugin ...

# 5. Commit e PR
git add .
git commit -m \"plugin: aggiunge plugin nome-plugin\"
git push origin plugin/nome-plugin
```

## 🔧 Troubleshooting

### Problemi Comuni

#### Port già in uso

```bash
# Trova processo che usa la porta
lsof -i :3000  # Frontend
lsof -i :8000  # Backend

# Uccidi processo
kill -9 <PID>

# Oppure usa porte diverse
NEXT_PORT=3001 npm run dev
```

#### Database connection error

```bash
# Verifica container database
docker compose ps

# Riavvia database
docker compose restart db

# Controlla logs
docker compose logs db
```

#### Frontend non raggiunge backend

```bash
# Verifica network Docker
docker network ls
docker network inspect bfg_default

# Controlla variabili ambiente
docker compose exec frontend env | grep API
```

#### Permission denied

```bash
# Fix permessi file
sudo chown -R $USER:$USER .

# Fix permessi container
docker compose exec backend chown -R app:app /app
```

### Log Debugging

```bash
# Logs dettagliati tutti i servizi
docker compose logs -f

# Logs specifici per errori
docker compose logs backend | grep ERROR
docker compose logs frontend | grep error

# Debug con volume mount
docker compose -f docker-compose.yml -f docker-compose.debug.yml up
```

## 📚 Risorse Aggiuntive

- **[Documentazione Django](https://docs.djangoproject.com/)**
- **[Documentazione Next.js](https://nextjs.org/docs)**
- **[Docker Compose Reference](https://docs.docker.com/compose/)**
- **[Sistema Plugin](plugin-system.md)** - Guida creazione plugin
- **[Pull Request Process](../guides/pull-request-process.md)** - Processo contribuzione

---

*Per supporto o domande sull'ambiente di sviluppo, contatta il team di sviluppo.*