#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

# Wait for the database to be ready
echo "Waiting for database..."
python -c "
import os
import sys
import time
import psycopg2

retries = 15
delay = 5

for i in range(retries):
    try:
        conn = psycopg2.connect(
            dbname=os.environ.get('POSTGRES_DB'),
            user=os.environ.get('POSTGRES_USER'),
            password=os.environ.get('POSTGRES_PASSWORD'),
            host=os.environ.get('POSTGRES_HOST'),
            port=os.environ.get('POSTGRES_PORT'),
            connect_timeout=3
        )
        conn.close()
        print('Database is ready.')
        sys.exit(0)
    except psycopg2.OperationalError as e:
        print(f'Database not ready. Waiting {delay}s...')
        time.sleep(delay)

print('Database not available after multiple retries. Exiting.')
sys.exit(1)
"

# Run system checks
echo "Running system checks..."
python manage.py check

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

# Then exec the container's main process (what's set as CMD in the Dockerfile).
echo "Starting application..."
exec "$@"
