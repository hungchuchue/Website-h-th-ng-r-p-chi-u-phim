export type UserRole = 'user' | 'editor' | 'admin';

export interface AuthContext {
  userId: string;
  role: UserRole;
}

export interface AppJwtPayload {
  sub: string;
  role: UserRole;
  type: 'access';
}

export interface AdminLoginData {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      uid?: string;
    }
  }
}

export {};