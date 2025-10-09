import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { apiServer } from '@/lib/axios-server';
import {
    validateData,
    checkRateLimit,
    sanitizeInput,
    validateSecurityHeaders,
    LoginSchema
} from '@/lib/validation';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // 1. Rate limiting check
        const rateLimitResult = checkRateLimit(request, 'login');
        if (!rateLimitResult.allowed) {
            console.warn(`Login rate limit exceeded for IP: ${request.ip}`);
            return NextResponse.json(
                { error: rateLimitResult.error },
                { status: 429 }
            );
        }

        // 2. Security headers validation
        const headerValidation = validateSecurityHeaders(request);
        if (!headerValidation.valid) {
            console.warn(`Invalid security headers from IP ${request.ip}:`, headerValidation.errors);
            return NextResponse.json(
                { error: 'Invalid request headers' },
                { status: 400 }
            );
        }

        // 3. Parse and sanitize input
        const rawCredentials = await request.json();
        const credentials = sanitizeInput(rawCredentials);

        // 4. Validate input
        const validation = validateData(credentials, LoginSchema);
        if (!validation.isValid) {
            console.warn(`Login validation failed for IP ${request.ip}:`, validation.errors);
            return NextResponse.json(
                {
                    error: 'Validation failed',
                    details: validation.errors
                },
                { status: 400 }
            );
        }

        // Utilizza Axios per inoltrare la richiesta di login al backend Django.
        const djangoResponse = await apiServer.post('api/v1/user/login/', credentials);

        // Se il login ha successo, crea una nuova risposta per il client Next.js.
        const response = NextResponse.json(djangoResponse.data); //Restituisce un oggetto JSON contenente principalmente un HTTP status code
        // Axios memorizza i cookie in un array sotto l'header 'set-cookie'.
        // Memorizziamo in una variabile i cookies che otteniamo da django, accedendo all'header set-cookie che può contenere più elementi
        // (access_token e refresh_token), quindi spesso viene gestito come array
        const setCookieHeaders = djangoResponse.headers['set-cookie']; //contiene l'header della risposta http compresi i token

        if (setCookieHeaders) {
            // Iteriamo su ogni cookie ricevuto e lo appendiamo all'header di risposta che verrà inoltrato al client, dove verranno salvati nel browser
            setCookieHeaders.forEach(cookieString => {
                // Imposta ogni cookie direttamente usando il metodo di Next.js.
                // Questo inoltra i cookie così come sono arrivati da Django.
                response.headers.append('Set-Cookie', cookieString);
            });
        }

        // 6. Cookie validation
        if (!setCookieHeaders) {
            console.error("Missing Set-Cookie headers from Django backend");
            return NextResponse.json(
                { error: 'Authentication service error' },
                { status: 500 }
            );
        }

        // 7. Log successful login
        const duration = Date.now() - startTime;
        console.log(`✅ Successful login for ${credentials.username} in ${duration}ms`);

        // 8. Add security headers to response
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('X-XSS-Protection', '1; mode=block');

        return response;

    } catch (error) {
        const duration = Date.now() - startTime;

        if (axios.isAxiosError(error) && error.response) {
            // Log failed login attempt
            console.warn(`❌ Failed login attempt from IP ${request.ip} in ${duration}ms:`, {
                status: error.response.status,
                data: error.response.data
            });

            return NextResponse.json(
                {
                    error: 'Authentication failed',
                    message: error.response.data?.message || 'Invalid credentials'
                },
                { status: error.response.status }
            );
        }

        // Log unexpected errors
        console.error(`💥 Login error from IP ${request.ip} in ${duration}ms:`, error);

        return NextResponse.json(
            {
                error: 'Internal server error',
                message: 'Please try again later'
            },
            { status: 500 }
        );
    }
}
    