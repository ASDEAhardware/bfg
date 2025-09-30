
import { NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';
import { apiServer } from "@/lib/axios-server";


export async function POST(request: Request){
    try {
        // console.log('HEADER DELLA RICHIESTA: ', request.headers);
        const payload = await request.json();

        //Leggi il cookie e inoltralo con la richiesta
        const accessToken = (await cookies()).get('access_token')?.value;

        if (!accessToken){
            return new NextResponse(JSON.stringify({error: 'Token non trovato nei cookie'}), {status: 401});
        }
        
        const djangoResponse = await apiServer.post('api/v1/user/password/change/', payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });


        //Risposta per il client 
        const response = NextResponse.json(djangoResponse.data);

        return response;
    } catch (error){
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
    