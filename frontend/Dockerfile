# ---------- STAGE 1: BUILD ----------
FROM node:22.11.0-alpine AS builder

WORKDIR /app

# Copia solo file necessari per installare le dipendenze
COPY package*.json ./

# Installa tutte le dipendenze (incluso dev)
RUN npm install

# Copia il resto del codice
COPY . .

# Build dell'app in modalità produzione
# RUN npm run build

