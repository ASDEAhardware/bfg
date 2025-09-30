import { NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";
import { apiServer } from "@/lib/axios-server";


export async function GET(){
    try{

        const cookieStore = await cookies()
        const accessToken = cookieStore.get('access_token')?.value;

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Access token mancante' },
                { status: 401 }
            );
        }

        const response = await apiServer.get('api/v1/user/user/', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        return NextResponse.json(response.data, { status: 200 });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            return NextResponse.json(
                { error: error.response?.data || 'Errore da Django' },
                { status: error.response?.status || 500 }
            );
        }
        // Gestione di altri tipi di errore
        return NextResponse.json(
            { error: 'Errore sconosciuto' },
            { status: 500 }
        );
    }
}
    