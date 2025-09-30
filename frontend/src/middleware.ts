import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';
import axios, { isAxiosError, AxiosResponse } from 'axios';

// Utilizziamo una cache in-memory per la chiave pubblica,
// così non dobbiamo fare una chiamata API ad ogni richiesta.
let publicKey: jose.CryptoKey | null = null;

// Tipizzazione della risposta della chiamata API per ottenere la chiave pubblica
interface PublicKeyResponse {
    public_key: string;
}

// Tipizzazione del payload del token JWT
interface TokenPayload extends jose.JWTPayload {
    is_staff: boolean;
    is_superuser: boolean;
}

async function getPublicKey(djangoApiUrl: string): Promise<jose.CryptoKey> {
    // 1. Aggiungi il controllo iniziale per la chiave pubblica
    if (publicKey) {
        return publicKey;
    }

    let response: AxiosResponse<PublicKeyResponse>;
    try {
        // 2. Esegui la chiamata API
        response = await axios.get<PublicKeyResponse>(`${djangoApiUrl}/api/v1/core/auth/public-key/`, {
            headers: {
                'x-api-key': process.env.API_KEY
            }
        });

        // 3. Controlla che la risposta contenga la chiave pubblica
        if (!response.data || !response.data.public_key) {
            throw new Error("La risposta dell' API non contiene la chiave pubblica.");
        }

        // 4. Importa la chiave pubblica e memorizzala
        publicKey = await jose.importSPKI(response.data.public_key, 'RS256'); // RS256 ???? 
        return publicKey;

    } catch (error) {
        // 5. Gestisci l'errore in modo più specifico
        if (isAxiosError(error)) {
            console.error("Si è verificato il seguente errore durante la chiamata API: ", error.status, error.message);
        } else {
            console.error("Si è verificato un errore inaspettato: ", error);
        }
        // 6. Rilancia l'errore per gestirlo a livello superiore
        throw error;
    }
}

// Funzione di validazione locale del token
// Anche qui, modifichiamo il tipo di 'key' in 'any'
async function validateToken(token: string, key: CryptoKey): Promise<jose.JWTVerifyResult<TokenPayload> | null> {
    try {
        const verificationResult = await jose.jwtVerify<TokenPayload>(token, key, {
            algorithms: ['RS256'],
        });
        return verificationResult;
    } catch (e) {
        console.log("Token non valido o scaduto, necessita di refresh.");
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const djangoApiUrl = process.env.DJANGO_API_URL || 'http://localhost:8000';
    const loginPage = '/login';

    const accessToken = request.cookies.get('access_token')?.value;
    const refreshToken = request.cookies.get('refresh_token')?.value;

    const protectedRoutes = ['/dashboard', '/change-password', '/settings', '/profile', '/staff-admin', '/system'];
    const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    const authRoutes = ['/login', '/register', '/reset-password'];
    const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    const staffRoutes = ['/staff-admin']
    const isStaffRoute = staffRoutes.some(route => request.nextUrl.pathname.startsWith(route));
    
    const superuserRoutes = ['/system'];
    const isSuperuserRoute = superuserRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    // Se l'utente non è autenticato e sta cercando di accedere a una rotta di autenticazione,
    // lasciagli continuare la navigazione.
    if (isAuthRoute && !refreshToken) {
        return NextResponse.next();
    }

    // Gestione della rotta radice ("/")
    if (request.nextUrl.pathname === '/') {
        // Se l'utente non è loggato (nessun refresh token), reindirizza a /login
        if (!refreshToken) {
            return NextResponse.redirect(new URL(loginPage, request.url));
        }
        // Se l'utente è loggato, reindirizza alla dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (isProtectedRoute) {
        // 1. Nessun token disponibile: reindirizza al login
        if (!accessToken && !refreshToken) {
            const response = NextResponse.redirect(new URL(loginPage, request.url));
            response.cookies.delete('refresh_token');
            response.cookies.delete('access_token');
            return response;
        }

        let pubKey: CryptoKey;
        try {
            pubKey = await getPublicKey(djangoApiUrl);
        } catch (error) {
            console.error(error);
            const response = NextResponse.redirect(new URL(loginPage, request.url));
            return response;
        }

        let payload: jose.JWTVerifyResult<TokenPayload> | null = null;
        if (accessToken) {
            payload = await validateToken(accessToken, pubKey);
        }

        if (!payload && refreshToken) {
            console.log("Access token scaduto, tento il refresh...");
            try {
                const refreshResponse = await axios.post(`${djangoApiUrl}/api/v1/user/token/refresh/`, {
                    refresh: refreshToken,
                });

                const newTokens = refreshResponse.data;
                const response = NextResponse.next();
                response.cookies.set('access_token', newTokens.access, {
                    path: '/',
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                });
                response.cookies.set('refresh_token', newTokens.refresh, {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                });

                payload = await validateToken(newTokens.access, pubKey);
                
                return response;
            } catch (error) {
                if (isAxiosError(error)) {
                    console.log(`Refresh token non valido o scaduto (status: ${error.response?.status}). Reindirizzamento al login.`);
                } else {
                    console.error("Errore imprevisto durante il refresh del token:", error);
                }
                
                const response = NextResponse.redirect(new URL(loginPage, request.url));
                response.cookies.delete('refresh_token');
                response.cookies.delete('access_token');
                return response;
            }
        }

        if (payload) {
            const { is_staff, is_superuser } = payload.payload;

            if (isStaffRoute && !is_staff && !is_superuser) {
                console.log("Accesso negato: utente non ha i permessi di staff.");
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            if (isSuperuserRoute && !is_superuser) {
                console.log("Accesso negato: l'utente non ha i permessi di superuser.");
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            return NextResponse.next();
        } else {
            const response = NextResponse.redirect(new URL(loginPage, request.url));
            response.cookies.delete('refresh_token');
            response.cookies.delete('access_token');
            return response;
        }
    }

    // Prosegui se la rotta non è protetta
    return NextResponse.next();
}

export const config = {
    // Il matcher deve includere tutte le rotte che il middleware deve intercettare.
    // Questo include sia le rotte protette che le rotte di autenticazione.
    matcher: ['/', '/login', '/reset-password', '/reset-password/:path*', '/dashboard', '/change-password', '/change-password:path*', '/dashboard/:path*', '/settings/:path*', '/profile/:path*', '/staff-admin/:path*', '/system/:path*'],
};
 
    