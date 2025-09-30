import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { apiServer } from '@/lib/axios-server';



export async function POST(request: Request) {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    const response = NextResponse.json({ message: "Logout effettuato con successo" });

    if (refreshToken) {
        try {
            // Inoltra la richiesta di logout a Django usando Axios
            await apiServer.post('api/v1/user/logout/', { refresh: refreshToken });
        } catch (error) {
            // Gestisce gli errori specifici di Axios.
            if (axios.isAxiosError(error)) {
                // Se c'è un errore nella risposta di Django (es. 401),
                // lo logghiamo ma procediamo comunque con il logout lato client.
                console.error("Errore da Django durante la chiamata di logout:", error.response?.data);
            } else {
                console.error("Errore sconosciuto durante la chiamata di logout:", error);
            }
            // Nonostante l'errore, procediamo con la pulizia dei cookie lato client
        }
    }

    // Indipendentemente dal successo della chiamata a Django,
    // eliminiamo i cookie per forzare il logout lato client.
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');

    return response;
}
    