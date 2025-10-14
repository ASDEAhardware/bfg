import { NextRequest, NextResponse } from "next/server";
import { apiServer } from "@/lib/axios-server";
import { cookies } from "next/headers";
import { AxiosError } from "axios";

/**
 * Gestisce il rinnovo dell'Access Token utilizzando il Refresh Token HttpOnly.
 * Implementa la Refresh Token Rotation (RTR) propagando l'header Set-Cookie da Django.
 */
export async function POST(request: NextRequest) {
    // 1. Estrai il Refresh Token dal cookie in arrivo dal client
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (!refreshToken) {
        console.warn("DEBUG: Refresh Token non trovato nel cookie store.");
        return NextResponse.json({ error: 'Refresh token non trovato' }, { status: 401 });
    }

    try {
        // 2. Chiamata Server-to-Server a Django

        const backendResponse = await apiServer.post(
            "api/v1/user/token/refresh/",
            {},
            {
                headers: {
                    // Inoltriamo il cookie di refresh al backend affinché possa validarlo
                    'Cookie': `refresh_token=${refreshToken}`
                }
            }
        );

        const { access } = backendResponse.data;

        // 3. Crea la risposta di successo per il client browser
        const response = NextResponse.json({ message: "Token refreshed" }, { status: 200 });

        // 4. LOGICA CRITICA: IMPOSTAZIONE ESPLICITA DEL REFRESH TOKEN TRAMITE cookies.set()
        // Abbandoniamo la propagazione stringa manuale e usiamo il metodo robusto di Next.js.
        const setCookieHeaders = backendResponse.headers['set-cookie'];

        const REFRESH_TOKEN_MAX_AGE_SECONDS = 604800; // 7 giorni (corrisponde a Django setting)

        if (setCookieHeaders) {

            const newCookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

            for (const cookie of newCookies) {
                if (cookie.startsWith('refresh_token=')) {
                    // Estraiamo solo il valore del token dalla prima parte della stringa (prima del ';')
                    const tokenValue = cookie.split(';')[0].substring('refresh_token='.length);

                    // Utilizziamo response.cookies.set() per forzare il salvataggio corretto
                    response.cookies.set('refresh_token', tokenValue, {
                        httpOnly: true, // Essenziale per sicurezza
                        secure: process.env.NODE_ENV === "production", // False in Dev HTTP
                        maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
                        path: "/", // Forza il path root
                        sameSite: "lax",
                    });

                    // Poiché il refresh token è stato gestito, usciamo dal loop.
                    break;
                }
            }
        } else {
            console.warn("DEBUG: Header 'Set-Cookie' NON PRESENTE nella risposta di Django. Questo è l'errore.");
        }

        // 5. Imposta (o sovrascrivi) l'Access Token (visibile a JS)
        // Corretto per essere non-Secure in sviluppo. Sincronizzato a 5 minuti
        response.cookies.set("access_token", access, {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 15, // 5 minuti
            path: "/",
            sameSite: "lax",
        });

        return response;

    } catch (error: unknown) {

        // 6. TIPIZZAZIONE E GESTIONE DEGLI ERRORI (AxiosError)
        if (error instanceof AxiosError) {

            const status = error.response?.status || 500;

            // Se il refresh fallisce (401), puliamo i cookie per forzare il logout lato client
            if (status === 401) {
                console.error("DEBUG: Refresh Token Fallito (401). Pulizia cookies in corso. VECCHIO token usato.");
                const cookieStore = await cookies();
                cookieStore.delete("refresh_token");
                cookieStore.delete("access_token");

                return new NextResponse(
                    JSON.stringify(error.response?.data || { message: "Authentication required" }),
                    { status: 401 }
                );
            }

            console.error(`DEBUG: Errore di refresh con status ${status}.`);
            return new NextResponse(
                JSON.stringify(error.response?.data || { message: "An error occurred during refresh" }),
                { status: status }
            );

        } else {
            // Gestione di errori non-Axios inaspettati
            console.error("Errore non previsto nel refresh token:", error);
            return new NextResponse(
                JSON.stringify({ message: "An unexpected error occurred" }),
                { status: 500 }
            );
        }
    }
}
