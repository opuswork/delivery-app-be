import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service';
import { AuthService, INVALID_CREDENTIALS } from './auth.service';

describe('AuthService', () => {
  const passwordHash = bcrypt.hashSync('12345678', 4);
  const user: User = {
    id: 1,
    loginId: '1234',
    password: passwordHash,
    fullName: '홍길동',
    churchName: 'joongang',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let findByLoginId: jest.Mock;
  let signAsync: jest.Mock;
  let service: AuthService;

  beforeEach(() => {
    findByLoginId = jest.fn();
    signAsync = jest.fn().mockResolvedValue('signed.jwt.token');
    service = new AuthService(
      { findByLoginId } as unknown as UsersService,
      { signAsync } as unknown as JwtService,
    );
  });

  it('returns a token and the public user on valid credentials', async () => {
    findByLoginId.mockResolvedValue([user]);

    const result = await service.login({
      loginId: '1234',
      password: '12345678',
    });

    expect(signAsync).toHaveBeenCalledWith({ sub: 1, loginId: '1234' });
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user).toEqual({
      id: 1,
      loginId: '1234',
      fullName: '홍길동',
      churchName: 'joongang',
    });
    expect(result.user).not.toHaveProperty('password');
  });

  it('rejects a wrong password with the generic message', async () => {
    findByLoginId.mockResolvedValue([user]);

    await expect(
      service.login({ loginId: '1234', password: '87654321' }),
    ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS));
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('rejects an unknown login ID with the same generic message', async () => {
    findByLoginId.mockResolvedValue([]);

    await expect(
      service.login({ loginId: '9999', password: '12345678' }),
    ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS));
  });

  it('picks the user whose password matches when the login ID is shared', async () => {
    const other: User = {
      ...user,
      id: 2,
      password: bcrypt.hashSync('12349999', 4),
      fullName: '김철수',
    };
    findByLoginId.mockResolvedValue([user, other]);

    const result = await service.login({
      loginId: '1234',
      password: '12349999',
    });

    expect(signAsync).toHaveBeenCalledWith({ sub: 2, loginId: '1234' });
    expect(result.user.fullName).toBe('김철수');
  });
});
