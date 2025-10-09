import { NextRequest } from 'next/server';

// Tipi per la validazione
export interface ValidationRule {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'email' | 'url';
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    min?: number;
    max?: number;
    custom?: (value: any) => boolean | string;
}

export interface ValidationSchema {
    [key: string]: ValidationRule;
}

export interface ValidationResult {
    isValid: boolean;
    errors: { [key: string]: string };
}

// Rate limiting configuration
const RATE_LIMITS = {
    login: { requests: 5, window: 5 * 60 * 1000 }, // 5 richieste per 5 minuti
    api: { requests: 100, window: 60 * 1000 }, // 100 richieste per minuto
    sensitive: { requests: 10, window: 5 * 60 * 1000 }, // 10 richieste per 5 minuti
};

// In-memory storage per rate limiting (in produzione usare Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Valida un oggetto contro uno schema
 */
export function validateData(data: any, schema: ValidationSchema): ValidationResult {
    const errors: { [key: string]: string } = {};
    let isValid = true;

    for (const [field, rule] of Object.entries(schema)) {
        const value = data[field];

        // Check required
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors[field] = `${field} is required`;
            isValid = false;
            continue;
        }

        // Skip validation if field is not required and empty
        if (!rule.required && (value === undefined || value === null || value === '')) {
            continue;
        }

        // Type validation
        if (rule.type) {
            const typeError = validateType(value, rule.type, field);
            if (typeError) {
                errors[field] = typeError;
                isValid = false;
                continue;
            }
        }

        // Length validation for strings
        if (typeof value === 'string') {
            if (rule.minLength && value.length < rule.minLength) {
                errors[field] = `${field} must be at least ${rule.minLength} characters`;
                isValid = false;
                continue;
            }

            if (rule.maxLength && value.length > rule.maxLength) {
                errors[field] = `${field} must not exceed ${rule.maxLength} characters`;
                isValid = false;
                continue;
            }
        }

        // Numeric validation
        if (typeof value === 'number') {
            if (rule.min !== undefined && value < rule.min) {
                errors[field] = `${field} must be at least ${rule.min}`;
                isValid = false;
                continue;
            }

            if (rule.max !== undefined && value > rule.max) {
                errors[field] = `${field} must not exceed ${rule.max}`;
                isValid = false;
                continue;
            }
        }

        // Pattern validation
        if (rule.pattern && typeof value === 'string') {
            if (!rule.pattern.test(value)) {
                errors[field] = `${field} has invalid format`;
                isValid = false;
                continue;
            }
        }

        // Custom validation
        if (rule.custom) {
            const customResult = rule.custom(value);
            if (customResult !== true) {
                errors[field] = typeof customResult === 'string' ? customResult : `${field} is invalid`;
                isValid = false;
                continue;
            }
        }
    }

    return { isValid, errors };
}

/**
 * Valida il tipo di un valore
 */
function validateType(value: any, type: string, field: string): string | null {
    switch (type) {
        case 'string':
            if (typeof value !== 'string') {
                return `${field} must be a string`;
            }
            break;

        case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
                return `${field} must be a valid number`;
            }
            break;

        case 'boolean':
            if (typeof value !== 'boolean') {
                return `${field} must be a boolean`;
            }
            break;

        case 'email':
            if (typeof value !== 'string' || !isValidEmail(value)) {
                return `${field} must be a valid email address`;
            }
            break;

        case 'url':
            if (typeof value !== 'string' || !isValidUrl(value)) {
                return `${field} must be a valid URL`;
            }
            break;

        default:
            return null;
    }

    return null;
}

/**
 * Valida un indirizzo email
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valida un URL
 */
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Rate limiting per IP
 */
export function checkRateLimit(
    request: NextRequest,
    type: keyof typeof RATE_LIMITS = 'api'
): { allowed: boolean; error?: string } {
    const ip = getClientIP(request);
    const config = RATE_LIMITS[type];
    const key = `${type}:${ip}`;
    const now = Date.now();

    // Ottieni o crea record per questo IP
    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
        // Nuovo periodo o primo accesso
        record = {
            count: 1,
            resetTime: now + config.window,
        };
        rateLimitStore.set(key, record);
        return { allowed: true };
    }

    if (record.count >= config.requests) {
        const resetIn = Math.ceil((record.resetTime - now) / 1000);
        return {
            allowed: false,
            error: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
        };
    }

    // Incrementa contatore
    record.count++;
    rateLimitStore.set(key, record);

    return { allowed: true };
}

/**
 * Ottiene l'IP del client
 */
export function getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    if (realIP) {
        return realIP.trim();
    }

    return 'unknown';
}

/**
 * Sanitizza input per prevenire XSS
 */
export function sanitizeInput(input: any): any {
    if (typeof input === 'string') {
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    if (Array.isArray(input)) {
        return input.map(sanitizeInput);
    }

    if (typeof input === 'object' && input !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }

    return input;
}

/**
 * Valida headers per sicurezza
 */
export function validateSecurityHeaders(request: NextRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Controlla Content-Type per richieste POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            errors.push('Invalid or missing Content-Type header');
        }
    }

    // Controlla User-Agent
    const userAgent = request.headers.get('user-agent');
    if (!userAgent || userAgent.length < 10) {
        errors.push('Invalid or missing User-Agent');
    }

    // Controlla headers sospetti
    const suspiciousHeaders = ['x-forwarded-host', 'x-forwarded-server'];
    for (const header of suspiciousHeaders) {
        if (request.headers.get(header)) {
            errors.push(`Suspicious header detected: ${header}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Schema di validazione per login
 */
export const LoginSchema: ValidationSchema = {
    username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 150,
        pattern: /^[a-zA-Z0-9_@.-]+$/,
    },
    password: {
        required: true,
        type: 'string',
        minLength: 8,
        maxLength: 128,
    },
};

/**
 * Schema di validazione per site
 */
export const SiteSchema: ValidationSchema = {
    name: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 255,
        pattern: /^[a-zA-Z0-9\s._-]+$/,
    },
    site_type: {
        required: true,
        type: 'string',
        custom: (value) =>
            ['bridge', 'building', 'tunnel', 'dam', 'tower', 'pipeline', 'other'].includes(value) ||
            'Invalid site type',
    },
    latitude: {
        required: true,
        type: 'number',
        min: -90,
        max: 90,
    },
    longitude: {
        required: true,
        type: 'number',
        min: -180,
        max: 180,
    },
    customer_name: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 255,
    },
    description: {
        required: false,
        type: 'string',
        maxLength: 1000,
    },
    is_active: {
        required: false,
        type: 'boolean',
    },
};

/**
 * Cleanup periodico del rate limit store
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (now > record.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000); // Cleanup ogni 5 minuti