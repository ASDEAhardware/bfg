
import { NextResponse } from 'next/server';
import axios from 'axios';
import { apiServer } from "@/lib/axios-server";


export async function POST(request: Request) {
    try{
        const payload = await request.json();

        const djangoResponse = await apiServer.post('api/v1/user/password/reset/', payload);

        const response = NextResponse.json(djangoResponse.data);

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
    