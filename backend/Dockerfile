# -------- STAGE 1: BUILDER --------
FROM python:3.13-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends     gcc libpq-dev     && rm -rf /var/lib/apt/lists/*

# Copia requirements
COPY requirements.txt .

# Installa le dipendenze in una directory separata, portabile
RUN pip install --upgrade pip && pip install --prefix=/install -r requirements.txt

# Copia tutto il codice nel builder
COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# -------- STAGE 2: RUNTIME --------
FROM python:3.13-slim AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copia i pacchetti Python installati
COPY --from=builder /install /usr/local

# Copia il progetto (codice, script, ecc.)
COPY . .

EXPOSE 8000

# Lasciare il comando di default, sarà sovrascritto da docker-compose
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "config.wsgi:application"]

