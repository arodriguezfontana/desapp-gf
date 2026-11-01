import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  /** Identidad que el JwtAuthGuard adjunta a la request tras validar el JWT. */
  user: { userId: string };
}
