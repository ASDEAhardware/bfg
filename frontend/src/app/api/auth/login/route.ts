import { NextResponse } from 'next/server';
import axios from 'axios';
import { apiServer } from '@/lib/axios-server';


export async function POST(request: Request) {
    try {
        //Credenziali inserite dall'utente ottenute dalla richiesta utente e parsate in json()
        const credentials = await request.json(); // il metodo .json() legge il body della richiesta e ritorna una Promise che si risolve con il risultato dell'analisi di JSON come input per produrre un oggetto JavaScript.

        // Utilizza Axios per inoltrare la richiesta di login al backend Django.
        const djangoResponse = await apiServer.post('api/v1/user/login/', credentials);

        // Se il login ha successo, crea una nuova risposta per il client Next.js.
        const response = NextResponse.json(djangoResponse.data); //Restituisce un oggetto JSON contenente principalmente un HTTP status code
        // Axios memorizza i cookie in un array sotto l'header 'set-cookie'.
        // Memorizziamo in una variabile i cookies che otteniamo da django, accedendo all'header set-cookie che può contenere più elementi
        // (access_token e refresh_token), quindi spesso viene gestito come array
        const setCookieHeaders = djangoResponse.headers['set-cookie']; //contiene l'header della risposta http compresi i token

        if (setCookieHeaders) {
            // Iteriamo su ogni cookie ricevuto e lo appendiamo all'header di risposta che verrà inoltrato al client, dove verranno salvati nel browser
            setCookieHeaders.forEach(cookieString => {
                // Imposta ogni cookie direttamente usando il metodo di Next.js.
                // Questo inoltra i cookie così come sono arrivati da Django.
                response.headers.append('Set-Cookie', cookieString);
            });
        }

        // Se l'header dei cookie non è presente, c'è un problema nel backend
        if (!setCookieHeaders) {
            console.error("L'header 'Set-Cookie' non è presente nella risposta di Django. Controlla la configurazione dei cookie nel backend.");
        }

        return response;

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            // Se Axios ha un errore di risposta (es. 400 Bad Request),
            // inoltra l'errore al client.
            return new NextResponse(JSON.stringify(error.response.data), {
                status: error.response.status,
            });
        }

        console.error("Errore durante il login:", error);
        return new NextResponse(
            JSON.stringify({ error: 'Errore interno del server.' }),
            { status: 500 }
        );
    }
}
    