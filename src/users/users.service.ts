import { Injectable } from '@nestjs/common';

import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Several people can share a login ID; their passwords differ. */
  findByLoginId(loginId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { loginId },
      orderBy: { id: 'asc' },
    });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
