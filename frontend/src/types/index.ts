// File index.ts per esportare centralmente i tipi
export type LoginCredentials = {
    username: string,
    password: string
}

export type ConfirmResetPayload = {
    uid: string;
    token: string;
    new_password1: string;
    new_password2: string;
}

export type ChangePasswordPayload = {
    old_password: string;
    new_password1: string;
    new_password2: string;
}

export type SiteType = 'bridge' | 'building' | 'tunnel' | 'dam' | 'tower' | 'pipeline' | 'other';

export type Site = {
    id: number;
    name: string;
    site_type: SiteType;
    latitude: string;
    longitude: string;
    customer_name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export type SiteListItem = {
    id: number;
    name: string;
    customer_name: string;
    site_type: SiteType;
}

export type ThemeOption = "light" | "dark" | "system";