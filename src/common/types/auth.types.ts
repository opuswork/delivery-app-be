import type { Request } from 'express';

/** Claims stored in the access token. */
export interface JwtPayload {
  /** User id; 0 for the admin, who has no account. */
  sub: number;
  /** Set only on admin tokens, which open the dashboard and nothing else. */
  role?: 'admin';
}

/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
