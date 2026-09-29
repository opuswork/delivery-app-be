/**
 * Development seed: one user (from SEED_* env vars) plus a few sample
 * deliveries in the current month so the calendar badges are visible.
 * Run with `npm run prisma:seed`.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

import { PrismaClient } from '../src/generated/prisma/client.js';

const BCRYPT_COST = 12;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function dateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });

  const loginId = requireEnv('SEED_USER_LOGIN_ID');
  const password = requireEnv('SEED_USER_PASSWORD');
  if (!/^\d{4}$/.test(loginId) || !/^\d{8}$/.test(password)) {
    throw new Error(
      'SEED_USER_LOGIN_ID must be 4 digits and SEED_USER_PASSWORD 8 digits',
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await prisma.user.upsert({
      where: { loginId },
      update: { password: passwordHash },
      create: {
        loginId,
        password: passwordHash,
        fullName: requireEnv('SEED_USER_FULL_NAME'),
        churchName: process.env.SEED_USER_CHURCH_NAME || 'joongang',
      },
    });

    const existing = await prisma.deliveryRecord.count({
      where: { userid: user.id },
    });
    if (existing === 0) {
      const today = new Date();
      const tomorrow = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
      );
      await prisma.deliveryRecord.createMany({
        data: [
          {
            company_name: '하나마트',
            product_name: '1급진간장1.8L',
            product_quantity: '4통',
            delivery_date: dateKey(today),
            userid: user.id,
          },
          {
            company_name: '우리식당',
            product_name: '양조간장500ml',
            product_quantity: '10병',
            delivery_date: dateKey(today),
            userid: user.id,
          },
          {
            company_name: '하나마트',
            product_name: '국간장1.8L',
            product_quantity: '2통',
            delivery_date: dateKey(tomorrow),
            userid: user.id,
          },
        ],
      });
    }
    console.log(
      `Seeded user ${loginId} (id ${user.id}); deliveries before seed: ${existing}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
