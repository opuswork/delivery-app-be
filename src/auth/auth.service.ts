import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import type { JwtPayload } from '../common/types/auth.types';
import {
  toUserResponse,
  UserResponseDto,
} from '../users/dto/user-response.dto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

export const BCRYPT_COST = 12;

/** Compared against when the login ID is unknown, so response time does not reveal it. */
const DUMMY_HASH = bcrypt.hashSync('00000000', BCRYPT_COST);

export const INVALID_CREDENTIALS = '아이디 또는 비밀번호가 올바르지 않습니다.';

export interface LoginResult {
  accessToken: string;
  user: UserResponseDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login({ loginId, password }: LoginDto): Promise<LoginResult> {
    const candidates = await this.usersService.findByLoginId(loginId);
    let user: (typeof candidates)[number] | undefined;
    if (candidates.length === 0) {
      await bcrypt.compare(password, DUMMY_HASH);
    }
    for (const candidate of candidates) {
      if (await bcrypt.compare(password, candidate.password)) {
        user = candidate;
        break;
      }
    }
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const payload: JwtPayload = { sub: user.id, loginId: user.loginId };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, user: toUserResponse(user) };
  }
}
