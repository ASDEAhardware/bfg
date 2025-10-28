import axios, { AxiosError } from "axios";
import { useAuthStore } from "@/store/authStore";

const api = axios.create({
    baseURL: '/api/',
    withCredentials: true,
});

// Variabile per tracciare se il token è in fase di refresh
let isRefreshing = false;
// Coda per le richieste fallite in attesa di un nuovo token
let failedQueue: { resolve: (value: unknown) => void; reject: (reason?: any) => void; }[] = [];

const processQueue = (error: AxiosError | null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            // Risolviamo la promessa senza un valore. Questo sbloccherà la coda
            // e permetterà al .then() nell'interceptor di rieseguire la richiesta originale.
            prom.resolve(undefined);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
        const originalRequest = error.config;
        if (!originalRequest) {
            return Promise.reject(error);
        }

        // Escludiamo gli endpoint di autenticazione per evitare loop o comportamenti indesiderati.
        const excludedPaths = ['/auth/login/', '/auth/token/refresh', '/auth/logout/'];
        if (
            error.response?.status === 401 &&
            originalRequest.url &&
            !excludedPaths.includes(originalRequest.url)
        ) {
            if (isRefreshing) {
                // Se un refresh è già in corso, accodiamo la richiesta
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => {
                    // Quando il refresh è finito, la richiesta viene rieseguita
                    return api(originalRequest);
                });
            }

            isRefreshing = true;
            useAuthStore.getState().setRefreshing(true);

            try {
                await api.post('/auth/token/refresh');
                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError as AxiosError);

                if ((refreshError as AxiosError).response?.status === 401) {
                    api.post('/auth/logout/').finally(() => {
                        useAuthStore.getState().clearUser();
                        window.location.href = '/login?sessionExpired=true';
                    });
                }

                return new Promise(() => {});
            } finally {
                isRefreshing = false;
                useAuthStore.getState().setRefreshing(false);
            }
        }

        return Promise.reject(error);
    }
);

export { api };