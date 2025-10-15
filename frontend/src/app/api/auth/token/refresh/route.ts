import { NextRequest, NextResponse } from "next/server";
import { apiServer } from "@/lib/axios-server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
    const refreshToken = (await cookies()).get('refresh_token')?.value;

    if (!refreshToken) {
        return NextResponse.json({ error: 'Refresh token non trovato' }, { status: 401 });
    }
        
    try {
        // Il serverAxios è configurato per parlare con il backend Docker
        const backendResponse = await apiServer.post(
            "api/v1/user/token/refresh/",
            {}, // Il corpo della richiesta ora è vuoto
            {
                headers: {
                    // Inoltriamo il cookie di refresh al backend
                    'Cookie': `refresh_token=${refreshToken}`
                }
            } // Il refresh token viene inviato automaticamente come cookie http-only
        );

        const { access } = backendResponse.data;

        // Crea una risposta di successo
        const response = NextResponse.json({ message: "Token refreshed" }, { status: 200 });

        // 1. Inoltra il nuovo refresh_token (HttpOnly) dal backend al browser
        // Questo gestisce la rotazione dei refresh token
        const newRefreshTokenCookie = backendResponse.headers['set-cookie']?.[0];
        if (newRefreshTokenCookie) {
            response.headers.append('Set-Cookie', newRefreshTokenCookie);
        }

        // 2. Imposta il nuovo access token come cookie nel browser
        response.cookies.set("access_token", access, {
            httpOnly: false, // Accessibile da JS
            secure: process.env.NODE_ENV !== "development",
            maxAge: 60 * 15, // 15 minuti (aumentato da 5)
            path: "/",
            sameSite: "lax",
        });

        return response;

    } catch (error: any) {
        // Se il backend restituisce un errore (es. refresh token scaduto),
        // inoltra l'errore al client.
        return new NextResponse(
            JSON.stringify(error.response?.data || { message: "An error occurred" }),
            { status: error.response?.status || 500 }
        );
    }
}
