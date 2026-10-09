import { Injectable } from '@nestjs/common';

import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** A device's anonymous account; created the first time the app is opened. */
  findOrCreateByDeviceKeyHash(deviceKeyHash: string): Promise<User> {
    // A single INSERT … ON CONFLICT, so two requests at once cannot both create it.
    return this.prisma.user.upsert({
      where: { deviceKeyHash },
      create: { deviceKeyHash },
      update: {},
    });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
