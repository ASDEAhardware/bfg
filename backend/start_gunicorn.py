#!/usr/bin/env python
import os
import subprocess
import sys

# Calcola il numero di worker in base ai core della CPU
# Usa (os.cpu_count() or 2) per avere un fallback a 2 core se il valore non è determinabile
try:
    cores = os.cpu_count() or 2
    workers = (cores * 2) + 1
except NotImplementedError:
    workers = 5  # Fallback generico se os.cpu_count() non è implementato

# Comando base per Gunicorn
command = [
    "gunicorn",
    "config.wsgi:application",
    "--bind", "0.0.0.0:8000",
    "--workers", str(workers),
    "--timeout", "120",
    "--log-level", "info",
    "--log-file", "-",
]

print(f"\n[GUNICORN LAUNCHER] Detected {cores or 'N/A'} cores. Starting Gunicorn with {workers} workers...\n")
sys.stdout.flush()

# Sostituisce il processo corrente con Gunicorn
# In questo modo, i segnali di Supervisor (es. SIGTERM) arrivano direttamente a Gunicorn
try:
    os.execvp(command[0], command)
except FileNotFoundError:
    print("\n[GUNICORN LAUNCHER] Error: 'gunicorn' command not found.")
    print("Please ensure Gunicorn is installed in the environment.\n")
    sys.exit(1)
