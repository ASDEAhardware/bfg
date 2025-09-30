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

