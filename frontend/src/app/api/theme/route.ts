
import { apiServer } from "@/lib/axios-server";
import axios from "axios";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
    const accessToken = (await cookies()).get('access_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ error: 'Token non trovato nei cookie' }, { status: 401 });
    }

    try {
        // Legge il body della richiesta in entrata dal frontend
        const payload = await request.json();
        const { theme } = payload;

        // Inoltra la richiesta PUT al backend Django
        const djangoResponse = await apiServer.put('api/v1/user/theme-preferences/', payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        // Crea la risposta di successo
        const response = NextResponse.json(djangoResponse.data, { status: djangoResponse.status });

        return response;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            // Se Axios ha un errore di risposta, inoltra l'errore al client
            return NextResponse.json(error.response.data, {
                status: error.response.status,
            });
        }

        console.error("Errore durante l'aggiornamento del tema:", error);
        return NextResponse.json(
            { error: 'Errore interno del server.' },
            { status: 500 }
        );
    }
}
    
    