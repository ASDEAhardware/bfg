import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";

// Configurazione API con security headers
const api = axios.create({
    baseURL: '/api/',
    withCredentials: true,
    timeout: 10000, // 10 secondi timeout
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // CSRF protection
    },
});

// Token refresh management
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Security: Rate limiting per richieste
const requestCounts = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT = 100; // richieste per minuto
const RATE_WINDOW = 60000; // 1 minuto

// Utility per rate limiting
const isRateLimited = (url: string): boolean => {
    const now = Date.now();
    const key = url.split('?')[0]; // Ignora query params
    const current = requestCounts.get(key) || { count: 0, timestamp: now };

    if (now - current.timestamp > RATE_WINDOW) {
        requestCounts.set(key, { count: 1, timestamp: now });
        return false;
    }

    if (current.count >= RATE_LIMIT) {
        console.warn(`Rate limit exceeded for ${key}`);
        return true;
    }

    requestCounts.set(key, { count: current.count + 1, timestamp: current.timestamp });
    return false;
};

// Gestione coda refresh
const subscribeTokenRefresh = (cb: (token: string) => void) => {
    refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
    refreshSubscribers.map(cb => cb(token));
    refreshSubscribers = [];
};

const onRefreshFailure = () => {
    refreshSubscribers = [];
    // Logout automatico
    useAuthStore.getState().clearUser();
    if (typeof window !== 'undefined') {
        window.location.href = '/login?sessionExpired=true';
    }
};

// Request interceptor per sicurezza e rate limiting
api.interceptors.request.use(
    (config) => {
        // Rate limiting check
        if (config.url && isRateLimited(config.url)) {
            throw new Error('Rate limit exceeded');
        }

        // Security headers
        config.headers = {
            ...config.headers,
            'X-Timestamp': Date.now().toString(),
        };

        return config;
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor migliorato
api.interceptors.response.use(
    (response) => {
        // Log successful responses in development
        if (process.env.NODE_ENV === 'development') {
            console.debug(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        }
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (!originalRequest) {
            console.error('No original request config available');
            return Promise.reject(error);
        }

        // Log errori per debugging
        console.error(`❌ ${originalRequest.method?.toUpperCase()} ${originalRequest.url} - ${error.response?.status}`, error.message);

        // Lista endpoint esclusi da auto-refresh
        const excludedPaths = ['/auth/login/', '/auth/token/refresh/', '/auth/logout/'];
        const isExcluded = excludedPaths.some(path => originalRequest.url?.includes(path));

        // Gestione 401 con token refresh automatico
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !isExcluded
        ) {
            if (isRefreshing) {
                // Se refresh già in corso, accoda la richiesta
                return new Promise((resolve, reject) => {
                    subscribeTokenRefresh((token: string) => {
                        originalRequest.headers = originalRequest.headers || {};
                        resolve(api(originalRequest));
                    });
                }).catch(() => {
                    return Promise.reject(error);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;
            useAuthStore.getState().setRefreshing(true);

            try {
                console.log('🔄 Attempting token refresh...');
                const refreshResponse = await api.post('/auth/token/refresh/');

                console.log('✅ Token refresh successful');
                onRefreshed('refreshed');

                // Retry richiesta originale
                return api(originalRequest);

            } catch (refreshError) {
                console.error('❌ Token refresh failed:', refreshError);
                onRefreshFailure();

                // Logout cleanup
                try {
                    await api.post('/auth/logout/');
                } catch (logoutError) {
                    console.error('Logout error during refresh failure:', logoutError);
                }

                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
                useAuthStore.getState().setRefreshing(false);
            }
        }

        // Gestione altri errori HTTP
        if (error.response) {
            switch (error.response.status) {
                case 403:
                    console.warn('Accesso negato - Permessi insufficienti');
                    break;
                case 404:
                    console.warn('Risorsa non trovata');
                    break;
                case 429:
                    console.warn('Troppe richieste - Rate limit superato');
                    break;
                case 500:
                    console.error('Errore interno del server');
                    break;
                default:
                    console.error(`Errore HTTP ${error.response.status}:`, error.message);
            }
        } else if (error.request) {
            console.error('Errore di rete - Nessuna risposta dal server');
        } else {
            console.error('Errore di configurazione richiesta:', error.message);
        }

        return Promise.reject(error);
    }
);

export { api };