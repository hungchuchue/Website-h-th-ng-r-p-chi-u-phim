// API login
export interface UserRow {
    id: number;
    email: string;
    password_hash: string;
    display_name: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin';
    admin_key: string;
    allowed_api_targets: string[];
    default_api_target: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface DataStoredInToken {
    id: number;
    email: string;
    role: string;
    admin_key: string;
    allowed_api_targets: string[];
    default_api_target: string;
}

export interface AuthTokenData {
    token: string;
    expires_in: number;
    user: {
        id: number;
        email: string;
        role: string;
        admin_key: string;
        api_target: string;
        allowed_api_targets: string[];
        default_api_target: string;
    };
}

export interface AuthUserResponse {
    id: number;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
    created_at: Date;
}
