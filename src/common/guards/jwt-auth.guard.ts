import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AuthenticatedRequest, JwtPayload } from '../types/auth.types';

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/** Verifies the `Authorization: Bearer <jwt>` header; 401 when missing or invalid. */
export async function verifyBearerToken(
  jwtService: JwtService,
  request: AuthenticatedRequest,
): Promise<JwtPayload> {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) throw new UnauthorizedException('인증이 필요합니다.');
  try {
    return await jwtService.verifyAsync<JwtPayload>(token, {
      algorithms: ['HS256'],
    });
  } catch {
    throw new UnauthorizedException('인증이 만료되었거나 유효하지 않습니다.');
  }
}

/**
 * Member routes: verifies the token and attaches `request.user`.
 * Admin tokens are refused (the admin has no deliveries of their own).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = await verifyBearerToken(this.jwtService, request);
    if (payload.role === 'admin') {
      throw new ForbiddenException('관리자 계정으로는 사용할 수 없습니다.');
    }
    request.user = { id: payload.sub };
    return true;
  }
}
