# 🚀 Guida Deployment

Documentazione completa per il deploy del progetto BFG in ambienti di produzione.

## 📋 Indice

- [Panoramica](#panoramica)
- [Ambiente di Produzione](#ambiente-di-produzione)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring e Logging](#monitoring-e-logging)
- [Backup e Recovery](#backup-e-recovery)
- [Troubleshooting](#troubleshooting)

## 🌟 Panoramica

BFG supporta diversi metodi di deployment:

- **Docker Compose**: Per ambienti single-node
- **Kubernetes**: Per ambienti scalabili
- **Serverless**: Next.js su Vercel/Netlify + Backend su servizi cloud

### Architettura Produzione

```mermaid
graph TB
    LB[Load Balancer] --> Frontend[Next.js Frontend]
    LB --> Backend[Django Backend]
    Backend --> DB[(PostgreSQL)]
    Backend --> Cache[(Redis)]
    Backend --> Storage[File Storage]

    subgraph "Monitoring"
        M1[Prometheus]
        M2[Grafana]
        M3[AlertManager]
    end

    Frontend --> M1
    Backend --> M1
```

## 🏭 Ambiente di Produzione

### Requisiti Sistema

#### Hardware Minimo

```yaml
CPU: 2 cores (4 cores consigliati)
RAM: 4GB (8GB consigliati)
Storage: 50GB SSD
Network: 100Mbps
```

#### Hardware Consigliato

```yaml
CPU: 4+ cores
RAM: 16GB+
Storage: 100GB+ NVMe SSD
Network: 1Gbps
Database: Separato con storage dedicato
```

#### Software

```yaml
OS: Ubuntu 22.04 LTS / CentOS 8+ / RHEL 8+
Docker: 24.0+
Docker Compose: 2.0+
Nginx: 1.20+ (come reverse proxy)
SSL/TLS: Let's Encrypt / Certificato valido
```

### Preparazione Server

#### 1. Update Sistema

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin nginx certbot

# CentOS/RHEL
sudo dnf update -y
sudo dnf install -y docker docker-compose nginx certbot
```

#### 2. Configurazione Docker

```bash
# Avvia e abilita Docker
sudo systemctl start docker
sudo systemctl enable docker

# Aggiungi utente al gruppo docker
sudo usermod -aG docker $USER
newgrp docker

# Verifica installazione
docker --version
docker compose version
```

#### 3. Configurazione Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 🐳 Docker Deployment

### 1. Preparazione Codice

```bash
# Clone repository
git clone https://github.com/ASDEAhardware/bfg.git
cd bfg

# Checkout versione stabile
git checkout v1.2.0  # Sostituisci con versione desiderata
```

### 2. Configurazione Environment

#### Backend (.env)

```bash
# backend/.env
DEBUG=False
SECRET_KEY=your-super-secret-production-key-here
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://bfg_user:super_secure_password@db:5432/bfg_db

# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_ALLOW_CREDENTIALS=True

# JWT
JWT_PRIVATE_KEY=keys/private.pem
JWT_PUBLIC_KEY=keys/public.pem
JWT_ALGORITHM=RS256

# Database
POSTGRES_DB=bfg_db
POSTGRES_USER=bfg_user
POSTGRES_PASSWORD=super_secure_password

# Email (opzionale)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Storage (opzionale)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_STORAGE_BUCKET_NAME=your-bucket
```

#### Frontend (.env.local)

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=https://yourdomain.com
NEXT_PUBLIC_APP_NAME=BFG Production
NEXT_PUBLIC_VERSION=1.2.0

# Internal
INTERNAL_API_URL=http://backend:8000
JWT_PUBLIC_KEY_URL=http://backend:8000/api/auth/public-key/

# Analytics (opzionale)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_HOTJAR_ID=1234567
```

### 3. Docker Compose Produzione

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    environment:
      - DEBUG=False
    env_file:
      - ./backend/.env
    depends_on:
      - db
      - redis
    volumes:
      - static_volume:/app/staticfiles
      - media_volume:/app/media
      - ./backend/keys:/app/keys:ro
    networks:
      - bfg_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    env_file:
      - ./frontend/.env.local
    depends_on:
      - backend
    networks:
      - bfg_network

  db:
    image: postgres:15
    restart: unless-stopped
    env_file:
      - ./backend/.env
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - bfg_network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - bfg_network

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - static_volume:/static:ro
      - media_volume:/media:ro
      - certbot_volume:/etc/letsencrypt:ro
    depends_on:
      - frontend
      - backend
    networks:
      - bfg_network

  certbot:
    image: certbot/certbot
    volumes:
      - certbot_volume:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email your-email@domain.com --agree-tos --no-eff-email -d yourdomain.com -d www.yourdomain.com

volumes:
  postgres_data:
  redis_data:
  static_volume:
  media_volume:
  certbot_volume:
  certbot_www:

networks:
  bfg_network:
    driver: bridge
```

### 4. Configurazione Nginx

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:8000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL Configuration
        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;

        # Security Headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";

        # API Routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Admin Routes
        location /admin/ {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static Files
        location /static/ {
            alias /static/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location /media/ {
            alias /media/;
            expires 1y;
            add_header Cache-Control "public";
        }

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket support (se necessario)
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

### 5. Deploy

```bash
# Genera chiavi JWT
mkdir -p backend/keys
openssl genrsa -out backend/keys/private.pem 2048
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem

# Build e avvio
docker compose -f docker-compose.prod.yml up -d --build

# Inizializzazione database
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# Generazione certificati SSL
docker compose -f docker-compose.prod.yml run --rm certbot

# Riavvio Nginx con SSL
docker compose -f docker-compose.prod.yml restart nginx
```

### 6. Verifica Deploy

```bash
# Status servizi
docker compose -f docker-compose.prod.yml ps

# Logs
docker compose -f docker-compose.prod.yml logs -f

# Test endpoints
curl -k https://yourdomain.com/api/health/
curl -k https://yourdomain.com

# Test SSL
curl -I https://yourdomain.com
```

## ☸️ Kubernetes Deployment

### 1. Namespace e ConfigMaps

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: bfg-production

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: bfg-config
  namespace: bfg-production
data:
  DEBUG: "False"
  ALLOWED_HOSTS: "yourdomain.com,www.yourdomain.com"
  CORS_ALLOWED_ORIGINS: "https://yourdomain.com"
  POSTGRES_DB: "bfg_db"
  POSTGRES_USER: "bfg_user"
```

### 2. Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: bfg-secrets
  namespace: bfg-production
type: Opaque
stringData:
  SECRET_KEY: "your-super-secret-production-key"
  POSTGRES_PASSWORD: "super_secure_password"
  DATABASE_URL: "postgresql://bfg_user:super_secure_password@postgres:5432/bfg_db"
  JWT_PRIVATE_KEY: |
    -----BEGIN RSA PRIVATE KEY-----
    [your private key content]
    -----END RSA PRIVATE KEY-----
  JWT_PUBLIC_KEY: |
    -----BEGIN PUBLIC KEY-----
    [your public key content]
    -----END PUBLIC KEY-----
```

### 3. Database Deployment

```yaml
# k8s/postgres.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: bfg-production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: bfg-config
              key: POSTGRES_DB
        - name: POSTGRES_USER
          valueFrom:
            configMapKeyRef:
              name: bfg-config
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: bfg-secrets
              key: POSTGRES_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        ports:
        - containerPort: 5432
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: bfg-production
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: bfg-production
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
```

### 4. Backend Deployment

```yaml
# k8s/backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: bfg-production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/bfg-backend:latest
        envFrom:
        - configMapRef:
            name: bfg-config
        - secretRef:
            name: bfg-secrets
        ports:
        - containerPort: 8000
        livenessProbe:
          httpGet:
            path: /api/health/
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health/
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: bfg-production
spec:
  selector:
    app: backend
  ports:
  - port: 8000
    targetPort: 8000
```

### 5. Frontend Deployment

```yaml
# k8s/frontend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: bfg-production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/bfg-frontend:latest
        env:
        - name: NEXT_PUBLIC_API_URL
          value: "https://yourdomain.com"
        - name: INTERNAL_API_URL
          value: "http://backend:8000"
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: bfg-production
spec:
  selector:
    app: frontend
  ports:
  - port: 3000
    targetPort: 3000
```

### 6. Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: bfg-ingress
  namespace: bfg-production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - yourdomain.com
    - www.yourdomain.com
    secretName: bfg-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      - path: /admin
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 3000
```

### 7. Deploy su Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml

# Verifica deploy
kubectl get pods -n bfg-production
kubectl get services -n bfg-production
kubectl get ingress -n bfg-production

# Initialize database
kubectl exec -it deployment/backend -n bfg-production -- python manage.py migrate
kubectl exec -it deployment/backend -n bfg-production -- python manage.py createsuperuser
```

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install frontend dependencies
      run: |
        cd frontend
        npm ci

    - name: Lint frontend
      run: |
        cd frontend
        npm run lint

    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'

    - name: Install backend dependencies
      run: |
        cd backend
        pip install -r requirements.txt

    - name: Test backend
      run: |
        cd backend
        python manage.py test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Build Docker images
      run: |
        docker build -t ${{ secrets.REGISTRY }}/bfg-backend:${{ github.ref_name }} -f backend/Dockerfile.prod backend/
        docker build -t ${{ secrets.REGISTRY }}/bfg-frontend:${{ github.ref_name }} -f frontend/Dockerfile.prod frontend/

    - name: Push to registry
      run: |
        echo ${{ secrets.REGISTRY_PASSWORD }} | docker login ${{ secrets.REGISTRY }} -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin
        docker push ${{ secrets.REGISTRY }}/bfg-backend:${{ github.ref_name }}
        docker push ${{ secrets.REGISTRY }}/bfg-frontend:${{ github.ref_name }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - name: Deploy to production
      run: |
        ssh ${{ secrets.PRODUCTION_HOST }} "
          cd /opt/bfg &&
          git pull origin main &&
          git checkout ${{ github.ref_name }} &&
          docker compose -f docker-compose.prod.yml pull &&
          docker compose -f docker-compose.prod.yml up -d &&
          docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate &&
          docker compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput
        "
```

## 📊 Monitoring e Logging

### Prometheus + Grafana

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'django'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

### Logging Configuration

```yaml
# Django logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(levelname)s %(asctime)s %(module)s %(message)s'
        }
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/app/logs/django.log',
            'maxBytes': 1024*1024*10,  # 10MB
            'backupCount': 5,
            'formatter': 'json',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
}
```

## 💾 Backup e Recovery

### Database Backup

```bash
#!/bin/bash
# scripts/backup-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${TIMESTAMP}.sql"

# Backup database
docker compose exec -T db pg_dump -U bfg_user bfg_db > "./backups/${BACKUP_FILE}"

# Compress backup
gzip "./backups/${BACKUP_FILE}"

# Upload to S3 (optional)
aws s3 cp "./backups/${BACKUP_FILE}.gz" "s3://your-backup-bucket/database/"

# Cleanup old backups (keep last 7 days)
find ./backups -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

### Automated Backups

```yaml
# Cron job
0 2 * * * /opt/bfg/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

### Recovery Procedure

```bash
#!/bin/bash
# scripts/restore-db.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

# Stop services
docker compose down

# Start only database
docker compose up -d db

# Wait for database
sleep 10

# Restore backup
gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql -U bfg_user -d bfg_db

# Start all services
docker compose up -d

echo "Database restored from: $BACKUP_FILE"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check database status
docker compose ps db

# Check database logs
docker compose logs db

# Test connection
docker compose exec backend python manage.py dbshell

# Reset database connection
docker compose restart db backend
```

#### 2. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text -noout

# Renew certificate
docker compose run --rm certbot renew

# Reload nginx
docker compose restart nginx
```

#### 3. Memory Issues

```bash
# Check memory usage
docker stats

# Increase container limits
# In docker-compose.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

#### 4. Plugin Loading Issues

```bash
# Check plugin registration
docker compose exec frontend node -e "
const { pluginRegistry } = require('./src/plugins');
console.log(Array.from(pluginRegistry.plugins.keys()));
"

# Check permissions
# Verify user permissions in browser console
console.log(getUserPermissions(userData));
```

### Performance Optimization

#### 1. Database Optimization

```sql
-- Add indexes for better performance
CREATE INDEX idx_auth_user_email ON auth_user(email);
CREATE INDEX idx_auth_user_username ON auth_user(username);
CREATE INDEX idx_auth_user_is_staff ON auth_user(is_staff);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM auth_user WHERE email = 'user@example.com';
```

#### 2. Frontend Optimization

```javascript
// Enable gzip compression in next.config.js
module.exports = {
  compress: true,
  poweredByHeader: false,

  // Image optimization
  images: {
    domains: ['yourdomain.com'],
    formats: ['image/webp'],
  },

  // Bundle analyzer
  analyzer: {
    enabled: process.env.ANALYZE === 'true',
  }
}
```

#### 3. Nginx Optimization

```nginx
# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

# Enable caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Health Checks

```bash
#!/bin/bash
# scripts/health-check.sh

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com)
if [ "$FRONTEND_STATUS" != "200" ]; then
    echo "Frontend unhealthy: $FRONTEND_STATUS"
    exit 1
fi

# Check backend API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/api/health/)
if [ "$API_STATUS" != "200" ]; then
    echo "Backend API unhealthy: $API_STATUS"
    exit 1
fi

# Check database
DB_STATUS=$(docker compose exec -T backend python manage.py dbshell -c "SELECT 1;" 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "Database unhealthy"
    exit 1
fi

echo "All services healthy"
```

---

*Per supporto aggiuntivo sul deployment, consulta la documentazione specifica del tuo provider cloud o contatta il team di sviluppo.*