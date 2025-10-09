# 🤝 Guida Contribuzione

Benvenuto nella guida per contribuire al progetto BFG. Questa documentazione ti aiuterà a iniziare rapidamente e seguire le best practices del team.

## 🚀 Come Iniziare

### 1. Setup Iniziale

```bash
# Fork del repository (se esterno)
git clone https://github.com/TUO_USERNAME/bfg.git
cd bfg

# Setup ambiente di sviluppo
cp backend/example.env backend/.env
cp frontend/example.env.local frontend/.env.local

# Avvio con Docker
docker compose up --build
```

### 2. Verifica Setup

- Frontend: http://localhost:3000
- Backend: http://localhost:8000/developers-admin/
- Login con credenziali di test

## 📝 Tipi di Contribuzione

### 🐛 Bug Reports

Usa il template issue per segnalare bug:

```markdown
## 🐛 Descrizione Bug
Descrizione chiara e concisa del problema.

## 🔄 Passi per Riprodurre
1. Vai a '...'
2. Clicca su '...'
3. Scrolla fino a '...'
4. Vedi l'errore

## ✅ Comportamento Atteso
Cosa dovrebbe succedere normalmente.

## 📱 Ambiente
- OS: [e.g. Ubuntu 22.04]
- Browser: [e.g. Chrome 118]
- Versione: [e.g. 1.2.0]

## 📎 Screenshot/Logs
Aggiungi screenshot o log se utili.
```

### ✨ Feature Requests

Template per nuove funzionalità:

```markdown
## 🎯 Problema/Necessità
Descrivi il problema che questa feature risolverebbe.

## 💡 Soluzione Proposta
Descrizione chiara della funzionalità desiderata.

## 🔄 Alternative Considerate
Altre soluzioni che hai considerato.

## 📋 Acceptance Criteria
- [ ] Criterio 1
- [ ] Criterio 2
- [ ] Criterio 3
```

### 🔌 Plugin Development

Per sviluppare nuovi plugin:

1. **Leggi la [Plugin System Guide](plugin-system.md)**
2. **Crea branch**: `git checkout -b plugin/nome-plugin`
3. **Implementa seguendo gli standard**
4. **Testa con tutti i permessi utente**
5. **Documenta il plugin**

### 📚 Documentazione

Contributi alla documentazione sono sempre benvenuti:

- Correzioni typo e grammatica
- Miglioramenti chiarezza
- Nuove guide e tutorial
- Traduzione in altre lingue

## 🔄 Workflow Contribuzione

### 1. Preparazione

```bash
# Aggiorna il tuo fork (se applicabile)
git remote add upstream https://github.com/ASDEAhardware/bfg.git
git fetch upstream
git checkout main
git merge upstream/main

# Crea branch feature
git checkout -b feature/nome-feature
```

### 2. Sviluppo

```bash
# Fai le tue modifiche
# ...

# Test locale
docker compose up --build
npm run lint        # Se sviluppo locale
npm run typecheck   # Se sviluppo locale

# Commit incrementali
git add .
git commit -m "feat: aggiunge funzionalità X"
```

### 3. Pull Request

```bash
# Push del branch
git push origin feature/nome-feature

# Crea PR su GitHub
# Usa il template PR del progetto
```

### 4. Review Process

1. **Automated Checks**: Build, lint, tests
2. **Code Review**: Team review del codice
3. **Testing**: Verifica funzionale
4. **Approval**: Approvazione finale
5. **Merge**: Integrazione nel main branch

## 📏 Standard di Codice

### Frontend (TypeScript/React)

#### Naming Conventions

```typescript
// Componenti: PascalCase
export function UserProfile() { }

// Hook: camelCase con prefisso "use"
export function useUserData() { }

// Costanti: UPPER_SNAKE_CASE
const API_BASE_URL = "http://localhost:8000"

// File: camelCase o kebab-case
userProfile.tsx
user-profile.tsx  // Preferito per pagine
```

#### Component Structure

```typescript
"use client"
import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  title: string
  data?: any[]
}

export function MyComponent({ title, data = [] }: Props) {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Effect logic
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Component content */}
      </CardContent>
    </Card>
  )
}
```

#### TypeScript Best Practices

```typescript
// Definisci interfacce per props e state
interface UserState {
  user: User | null
  loading: boolean
  error: string | null
}

// Usa union types per state management
type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Generic types per riutilizzabilità
interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

// Evita any, usa unknown se necessario
function processData(data: unknown): string {
  if (typeof data === 'string') {
    return data.toUpperCase()
  }
  return String(data)
}
```

### Backend (Python/Django)

#### Code Style

```python
# Segui PEP 8
from django.contrib.auth.models import AbstractUser
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response


class User(AbstractUser):
    """Extended user model with additional fields."""

    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'auth_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff']
        read_only_fields = ['id', 'is_staff']


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User CRUD operations."""

    queryset = User.objects.all()
    serializer_class = UserSerializer

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user info."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
```

#### Error Handling

```python
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """Custom exception handler with logging."""

    response = exception_handler(exc, context)

    if response is not None:
        logger.error(f"API Error: {exc} - Context: {context}")

        custom_response_data = {
            'error': True,
            'message': str(exc),
            'status_code': response.status_code
        }
        response.data = custom_response_data

    return response
```

### Database

#### Migration Best Practices

```python
# Sempre specificare reverse operation
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('myapp', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='phone',
            field=models.CharField(max_length=20, blank=True, null=True),
        ),
        # Aggiungi reverse operation se necessario
        migrations.RunSQL(
            "UPDATE auth_user SET phone = '' WHERE phone IS NULL;",
            reverse_sql="UPDATE auth_user SET phone = NULL WHERE phone = '';"
        ),
    ]
```

## 🧪 Testing

### Frontend Testing

```typescript
// Component testing con Jest/Testing Library
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders with title', () => {
    render(<MyComponent title="Test Title" />)

    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const user = userEvent.setup()
    render(<MyComponent title="Test" />)

    const button = screen.getByRole('button', { name: /click me/i })
    await user.click(button)

    expect(screen.getByText('Clicked!')).toBeInTheDocument()
  })
})
```

### Backend Testing

```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class UserAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def test_get_user_info(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/auth/user/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')

    def test_unauthorized_access(self):
        response = self.client.get('/api/auth/user/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
```

### Plugin Testing

```typescript
// Plugin testing
describe('DataLogger Plugin', () => {
  it('registers correctly', () => {
    const plugin = dataloggerPlugin

    expect(plugin.metadata.id).toBe('datalogger')
    expect(plugin.enabled).toBe(true)
    expect(plugin.routes).toHaveLength(1)
  })

  it('respects permissions', () => {
    const guestPermissions = { role: 'guest' as const }
    const staffPermissions = { role: 'staff' as const }

    // Plugin richiede staff permissions
    expect(hasPluginAccess(dataloggerPlugin, guestPermissions)).toBe(false)
    expect(hasPluginAccess(dataloggerPlugin, staffPermissions)).toBe(true)
  })
})
```

## 📋 Checklist Pre-Commit

### ✅ Codice

- [ ] Codice compila senza errori
- [ ] Eslint passa senza warnings
- [ ] TypeScript types corretti
- [ ] No console.log in produzione
- [ ] Gestione errori implementata

### ✅ Testing

- [ ] Test esistenti ancora passano
- [ ] Nuovi test per nuove funzionalità
- [ ] Test edge cases coperti
- [ ] Coverage non diminuisce

### ✅ Documentazione

- [ ] README aggiornato se necessario
- [ ] Documentazione API aggiornata
- [ ] Plugin documentato (se applicabile)
- [ ] Changelog aggiornato per feature importanti

### ✅ Security

- [ ] No credenziali hardcoded
- [ ] Input validation implementata
- [ ] Autorizzazione verificata
- [ ] HTTPS enforced (produzione)

## 🔄 Review Guidelines

### Per i Contributor

#### Preparazione PR

```markdown
## 📝 Descrizione
Descrizione chiara di cosa fa questa PR.

## 🔄 Tipo di Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## ✅ Testing
- [ ] Test passano localmente
- [ ] Nuovi test aggiunti
- [ ] Testato manualmente

## 📸 Screenshots
Se UI changes, aggiungi screenshot.
```

#### Durante Review

- **Rispondi rapidamente** ai commenti
- **Spiega le decisioni** architetturali
- **Accetta feedback** costruttivo
- **Richiedi chiarimenti** se necessario

### Per i Reviewer

#### Cosa Guardare

1. **Funzionalità**: Fa quello che dice?
2. **Codice Quality**: Leggibile e manutenibile?
3. **Performance**: Introduce bottleneck?
4. **Security**: Vulnerabilità potenziali?
5. **Tests**: Coverage adeguata?

#### Come Dare Feedback

```markdown
# ✅ Buono
Questa implementazione è pulita e ben strutturata.

# 💡 Suggerimento
Considera di usare useMemo qui per ottimizzare performance:
```typescript
const expensiveValue = useMemo(() =>
  heavyCalculation(data), [data]
)
```

# 🚨 Problema
Questo può causare memory leak. Aggiungi cleanup:
```typescript
useEffect(() => {
  const interval = setInterval(...)
  return () => clearInterval(interval)  // ← Aggiungi questo
}, [])
```
```

## 🆘 Getting Help

### Canali di Supporto

- **GitHub Issues**: Bug reports e feature requests
- **Discussions**: Domande generali e discussioni
- **Documentation**: Consulta docs prima di chiedere
- **Team**: Contatta direttamente per urgent issues

### Debug Common Issues

#### Build Errors

```bash
# Pulisci e ribuilda
docker compose down -v
docker compose up --build

# Controlla logs
docker compose logs frontend
docker compose logs backend
```

#### Plugin Not Loading

```typescript
// Verifica registrazione
console.log(pluginRegistry.plugins)

// Verifica permessi
const userPermissions = getUserPermissions(userData)
console.log('User permissions:', userPermissions)

// Verifica rotte
const routes = pluginRegistry.getAllPluginRoutes(userPermissions)
console.log('Available routes:', routes)
```

#### Database Issues

```bash
# Reset database
docker compose down -v
docker compose up -d db
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

## 🎉 Riconoscimenti

Tutti i contributi sono riconosciuti:

- **Contributor**: Menzionati nel CONTRIBUTORS.md
- **Major Features**: Crediti nel changelog
- **Documentation**: Riconoscimento nelle docs

## 📚 Risorse Aggiuntive

- **[Setup Development](setup-development.md)** - Configurazione ambiente
- **[Plugin System](plugin-system.md)** - Guida plugin
- **[Architecture](architecture.md)** - Panoramica architettura
- **[Pull Request Process](../guides/pull-request-process.md)** - Processo PR

---

*Grazie per contribuire al progetto BFG! Ogni contributo, grande o piccolo, è prezioso per la comunità.*