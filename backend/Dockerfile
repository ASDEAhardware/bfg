# -------- STAGE 1: BUILDER --------
FROM python:3.13-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

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

# Installa Supervisor e dipendenze runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    supervisor \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copia i pacchetti Python installati
COPY --from=builder /install /usr/local

# Copia il progetto (codice, script, ecc.)
COPY . .

# Copy and prepare the entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Crea directory per logs Supervisor
RUN mkdir -p /var/log/supervisor /var/log/mqtt

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]

# Default command: usa Supervisor per gestire gunicorn + mqtt service
CMD ["/usr/bin/supervisord", "-c", "/app/supervisord.conf", "-n"]

