import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';
import { apiServer } from './lib/axios-server';

// Interfaccia per il payload del token per includere ruoli
interface TokenPayload extends jose.JWTPayload {
    is_staff: boolean;
    is_superuser: boolean;
}


// Cache per la chiave pubblica per evitare chiamate API ripetute
let publicKey: jose.CryptoKey | null = null;

async function getPublicKey(): Promise<jose.CryptoKey> {
    if (publicKey) {
        return publicKey;
    }
    try {
        const response = await apiServer.get('/api/v1/core/auth/public-key/', {
            headers: { 'x-api-key': process.env.API_KEY! }
        });
        const data = response.data;
        if (!data.public_key) {
            throw new Error("Public key not found in API response.");
        }
        publicKey = await jose.importSPKI(data.public_key, 'RS256');
        return publicKey;
    } catch (error) {
        console.error("Error fetching or importing public key:", error);
        throw error;
    }
}

async function validateToken(token: string, key: jose.CryptoKey): Promise<jose.JWTVerifyResult<TokenPayload> | null> {
    try {
        return await jose.jwtVerify<TokenPayload>(token, key, { algorithms: ['RS256'] });
    } catch (e) {
        console.log("Access token validation failed. It might be expired.");
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const loginUrl = new URL('/login', request.url);

    const accessToken = request.cookies.get('access_token')?.value;
    const refreshToken = request.cookies.get('refresh_token')?.value;

    const isAuthRoute = ['/login', '/register', '/reset-password'].some(p => pathname.startsWith(p));
    const isProtectedRoute = !isAuthRoute && pathname !== '/';

    // Se l'utente è su una rotta di autenticazione
    if (isAuthRoute) {
        if (refreshToken) {
            // Se ha un refresh token, è già loggato, quindi lo mandiamo alla dashboard
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.next();
    }

    // Redirect dalla rotta radice
    if (pathname === '/') {
        return NextResponse.redirect(new URL(refreshToken ? '/dashboard' : '/login', request.url));
    }

    if (isProtectedRoute) {
        if (!refreshToken) {
            // Nessun refresh token, l'utente non è autenticato
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('access_token');
            response.cookies.delete('refresh_token');
            return response;
        }

        let pubKey: jose.CryptoKey;
        try {
            pubKey = await getPublicKey();
        } catch (error) {
            console.error("Could not retrieve public key, redirecting to login.");
            return NextResponse.redirect(loginUrl);
        }

        const isAccessTokenValid = accessToken ? await validateToken(accessToken, pubKey) : null;

        if (isAccessTokenValid) {
            // L'access token è valido, controlliamo i permessi per le rotte specifiche
            const { is_staff, is_superuser } = isAccessTokenValid.payload;
            if (pathname.startsWith('/staff-admin') && !is_staff && !is_superuser) {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
            if (pathname.startsWith('/system') && !is_superuser) {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
            return NextResponse.next();
        }

        // L'access token non è valido o assente, ma c'è un refresh token.
        // Invece di fare il refresh qui, lasciamo che la richiesta vada al client.
        // La pagina caricherà uno stato "loading" e l'intercettore di Axios gestirà il refresh.
        // Questo previene il reindirizzamento anomalo.
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/',
        '/login',
        '/register',
        '/reset-password/:path*',
        '/dashboard/:path*',
        '/settings/:path*',
        '/profile/:path*',
        '/staff-admin/:path*',
        '/system/:path*',
        '/devices/:path*',
    ],
};