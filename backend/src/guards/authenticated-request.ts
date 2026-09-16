import { Request } from 'express';

/** Identidad que el JwtAuthGuard adjunta a la request tras validar el JWT. */
export interface AuthenticatedUser {
  userId: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
