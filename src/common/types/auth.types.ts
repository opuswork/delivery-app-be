import type { Request } from 'express';

/** Claims stored in the access token. */
export interface JwtPayload {
  sub: number;
  loginId: string;
}

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: number;
  loginId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
