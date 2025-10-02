export type User = {
    pk: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    profile_image?: string; // Optional
    theme?: 'light' | 'dark' | 'system'; // Optional and specific values
    is_staff: boolean;
    is_superuser: boolean;
}