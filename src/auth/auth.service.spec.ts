import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service';
import {
  AuthService,
  hashDeviceKey,
  INVALID_CREDENTIALS,
} from './auth.service';

describe('AuthService', () => {
  const deviceKey = 'k'.repeat(43);
  const deviceUser: User = {
    id: 7,
    deviceKeyHash: hashDeviceKey(deviceKey),
    loginId: null,
    password: null,
    fullName: '',
    churchName: 'joongang',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let findOrCreateByDeviceKeyHash: jest.Mock;
  let signAsync: jest.Mock;
  let adminPasswordHash: string | undefined;
  let service: AuthService;

  beforeEach(() => {
    findOrCreateByDeviceKeyHash = jest.fn().mockResolvedValue(deviceUser);
    signAsync = jest.fn().mockResolvedValue('signed.jwt.token');
    adminPasswordHash = undefined;
    service = new AuthService(
      { findOrCreateByDeviceKeyHash } as unknown as UsersService,
      { signAsync } as unknown as JwtService,
      { get: () => adminPasswordHash } as unknown as ConfigService,
    );
  });

  describe('authenticateDevice', () => {
    it("signs a token for the device's account", async () => {
      const result = await service.authenticateDevice({ deviceKey });

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
      expect(signAsync).toHaveBeenCalledWith({ sub: 7 });
    });

    it('looks the account up by a SHA-256 of the key, never the key itself', async () => {
      await service.authenticateDevice({ deviceKey });

      const [hash] = findOrCreateByDeviceKeyHash.mock.calls[0] as [string];
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).not.toContain(deviceKey);
    });
  });

  describe('adminLogin', () => {
    const adminPassword = 'dashboard-secret';

    it('signs an admin token when ADMIN_PASSWORD_HASH matches', async () => {
      adminPasswordHash = bcrypt.hashSync(adminPassword, 4);

      const result = await service.adminLogin({
        loginId: 'admin',
        password: adminPassword,
      });

      expect(signAsync).toHaveBeenCalledWith({
        sub: 0,
        role: 'admin',
      });
      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
    });

    it.each([
      ['a wrong password', 'admin', 'wrong-password'],
      ['another login ID', 'root', adminPassword],
    ])('rejects %s', async (_case, loginId, password) => {
      adminPasswordHash = bcrypt.hashSync(adminPassword, 4);

      await expect(service.adminLogin({ loginId, password })).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('is disabled when ADMIN_PASSWORD_HASH is not set', async () => {
      await expect(
        service.adminLogin({ loginId: 'admin', password: '00000000' }),
      ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS));
      expect(signAsync).not.toHaveBeenCalled();
    });
  });
});
