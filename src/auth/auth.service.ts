import { createHash } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import type { JwtPayload } from '../common/types/auth.types';
import { UsersService } from '../users/users.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { DeviceAuthDto } from './dto/device-auth.dto';

export const BCRYPT_COST = 12;

/** Compared against when admin login is not set up, so response time does not reveal it. */
const DUMMY_HASH = bcrypt.hashSync('00000000', BCRYPT_COST);

export const INVALID_CREDENTIALS = '아이디 또는 비밀번호가 올바르지 않습니다.';

/** The dashboard login ID. */
export const ADMIN_LOGIN_ID = 'admin';

export interface TokenResult {
  accessToken: string;
}

/** The key is random and long, so a fast hash is enough (no bcrypt needed). */
export function hashDeviceKey(deviceKey: string): string {
  return createHash('sha256').update(deviceKey).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The app has no login: each installation sends its device key and gets a
   * token for its own anonymous account, created on first use.
   */
  async authenticateDevice({ deviceKey }: DeviceAuthDto): Promise<TokenResult> {
    const user = await this.usersService.findOrCreateByDeviceKeyHash(
      hashDeviceKey(deviceKey),
    );
    const payload: JwtPayload = { sub: user.id };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }

  /**
   * The admin password lives only as a bcrypt hash in ADMIN_PASSWORD_HASH;
   * without it, admin login always fails.
   */
  async adminLogin({ loginId, password }: AdminLoginDto): Promise<TokenResult> {
    const hash = this.config.get<string>('ADMIN_PASSWORD_HASH');
    // Always compare, so response time does not reveal whether admin is set up.
    const matches = await bcrypt.compare(password, hash || DUMMY_HASH);
    if (!hash || !matches || loginId !== ADMIN_LOGIN_ID) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const payload: JwtPayload = { sub: 0, role: 'admin' };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
