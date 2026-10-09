import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AuthenticatedRequest } from '../types/auth.types';
import { verifyBearerToken } from './jwt-auth.guard';

/** Admin routes: only tokens from the "admin" login are accepted. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = await verifyBearerToken(this.jwtService, request);
    if (payload.role !== 'admin') {
      throw new ForbiddenException('관리자만 볼 수 있습니다.');
    }
    return true;
  }
}
