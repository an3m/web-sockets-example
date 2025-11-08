//interfaces for auth module

export interface JwtPayload {
    sub: string;
    username: string;
    iat?: number;
    exp?: number;
}

export interface LoginResponse {
    access_token: string;
    user: {
        id: string;
        email: string;
        username: string;
        avatar?: string;
    };
}

