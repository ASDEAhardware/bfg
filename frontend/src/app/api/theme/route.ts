
import { apiServer } from "@/lib/axios-server";
import axios from "axios";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
    const accessToken = (await cookies()).get('access_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ error: 'Token not found in cookies' }, { status: 401 });
    }

    try {
        // Legge il body della richiesta in entrata dal frontend
        const payload = await request.json();

        // Inoltra la richiesta PATCH al backend Django
        const djangoResponse = await apiServer.patch('api/v1/user/theme-preferences/', payload, {
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