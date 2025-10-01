import { api } from '@/lib/axios';
import { LoginCredentials, ConfirmResetPayload, ChangePasswordPayload } from '@/types';
import { User } from '@/types/user';

/**
 * Esegue il login dell'utente.
 * @param credentials - Oggetto con username e password.
 * @returns I dati dell'utente.
 */
export const login = async (credentials: LoginCredentials): Promise<User> => {
    const response = await api.post<User>('/auth/login/', credentials);
    return response.data;
};

/**
 * Esegue il logout dell'utente.
 * Invia una richiesta al backend per invalidare il refresh token (se HttpOnly).
 */
export const logout = async (): Promise<void> => {
    // Il backend dovrebbe invalidare il cookie di sessione/token.
    await api.post('/auth/logout/');
};

/**
 * Richiede un reset della password per un'email.
 * @param email - L'email dell'utente.
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
    await api.post('/auth/password-reset/', { email });
};

/**
 * Conferma il reset della password con il nuovo token.
 * @param payload - Dati per la conferma del reset.
 */
export const confirmPasswordReset = async (payload: ConfirmResetPayload): Promise<void> => {
    await api.post('/auth/password-reset/confirm/', payload);
};

/**
 * Cambia la password dell'utente autenticato.
 * @param payload - Dati per il cambio password.
 */
export const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
    await api.post('/auth/password-change/', payload);
};

/**
 * Recupera i dati dell'utente attualmente autenticato.
 * @returns I dati dell'utente.
 */
export const getMe = async (): Promise<User> => {
    const response = await api.get<User>('/auth/user/');
    return response.data;
};
    