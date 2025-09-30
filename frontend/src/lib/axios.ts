import axios from "axios";

// Il client Axios viene configurato per inviare i cookie con le richieste.
// Non è più necessario leggere i token da Zustand.
const api = axios.create({
    baseURL: '/api/',
    withCredentials: true,
});

// L'interceptor di richiesta non deve più aggiungere l'header di autorizzazione,
// perché i cookie vengono inviati automaticamente dal browser.
// Questo intercettore ora può essere rimosso o utilizzato per altre logiche.
api.interceptors.request.use(
    (config) => {
        // Esempio di utilizzo: aggiungere un header diverso
        // config.headers["X-Custom-Header"] = "value";
        return config;
    },
    (error) => Promise.reject(error)
);

// L'interceptor di risposta gestisce solo i casi in cui l'autenticazione è fallita.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Se la risposta è 401 e la richiesta non è per il login,
        // significa che il middleware di Next.js non è riuscito a rinfrescare il token.
        // L'utente deve essere reindirizzato al login.
        if (error.response?.status === 401 && !originalRequest.url.includes('/user/login/')) {
            // Reindirizza l'utente alla pagina di login.
            // Dato che l'access e refresh token sono cookie, verranno puliti dal middleware
            // al reindirizzamento.
            window.location.href = "/";
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export { api };

