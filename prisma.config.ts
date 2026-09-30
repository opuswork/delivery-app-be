import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Optional here so `prisma generate` (postinstall) works in CI/build
    // environments without a database; migrate/seed still fail clearly if unset.
    url: process.env.DATABASE_URL,
  },
});
