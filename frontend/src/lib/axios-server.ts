import axios from "axios";

// Nome del servizio Django definito in docker-compose.yml
const DJANGO_SERVICE_NAME = "backend"; 
const DJANGO_PORT = "8000";

// Questa istanza è comoda in quanto oltre ad una gestione centralizzata dell'URL
// utile anche perchè imposta automaticamente l'header content-type
const apiServer = axios.create({
    // Utilizziamo il nome del servizio Docker come hostname
    baseURL: `http://${DJANGO_SERVICE_NAME}:${DJANGO_PORT}/`,
    // withCredentials: true, È un'impostazione per i soli browser, nelle chiamate server to server, i token vanno estratti e inoltrati manualmente a meno che non crei un wrapper
});


export { apiServer };
    
    