/**
 * Imports users from a tab-separated file:
 *   loginId <TAB> password <TAB> fullName <TAB> churchName
 *
 * - People may share a loginId (the middle 4 phone digits); the password
 *   (which ends in the last 4 digits) tells them apart.
 * - A row is skipped when a user with the same loginId and password is
 *   already in the database.
 * - Two rows with the same loginId AND password cannot be told apart at login,
 *   so the file is rejected.
 * - Passwords are stored as bcrypt hashes only.
 *
 * The data file contains personal data: keep it in be/data/ (git-ignored).
 *
 *   npm run import:users -- data/users-import.tsv            # import
 *   npm run import:users -- data/users-import.tsv --dry-run  # report only
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';

import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

import { PrismaClient } from '../src/generated/prisma/client.js';

const BCRYPT_COST = 12;

interface Row {
  line: number;
  loginId: string;
  password: string;
  fullName: string;
  churchName: string;
}

function parseFile(path: string): Row[] {
  const rows: Row[] = [];
  const problems: string[] = [];
  readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .forEach((text, index) => {
      if (!text.trim()) return;
      const [loginId = '', password = '', fullName = '', churchName = ''] = text
        .split('\t')
        .map((cell) => cell.trim());
      const line = index + 1;
      if (!/^\d{4}$/.test(loginId))
        problems.push(`line ${line}: loginId "${loginId}"`);
      else if (!/^\d{8}$/.test(password))
        problems.push(`line ${line}: password`);
      else if (!fullName || fullName.length > 50)
        problems.push(`line ${line}: fullName`);
      else if (!churchName || churchName.length > 100)
        problems.push(`line ${line}: churchName`);
      else rows.push({ line, loginId, password, fullName, churchName });
    });
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.loginId}\t${row.password}`;
    const first = seen.get(key);
    if (first !== undefined)
      problems.push(
        `line ${row.line}: same loginId and password as line ${first}`,
      );
    else seen.set(key, row.line);
  }
  if (problems.length > 0) {
    throw new Error(`Invalid rows (nothing imported):\n${problems.join('\n')}`);
  }
  return rows;
}

async function main() {
  const [path, flag] = process.argv.slice(2);
  if (!path) throw new Error('Usage: import-users <file.tsv> [--dry-run]');
  const dryRun = flag === '--dry-run';
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const rows = parseFile(path);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const hashesById = new Map<string, string[]>();
    for (const user of await prisma.user.findMany({
      where: { loginId: { in: [...new Set(rows.map((r) => r.loginId))] } },
      select: { loginId: true, password: true },
    }))
      hashesById.set(user.loginId, [
        ...(hashesById.get(user.loginId) ?? []),
        user.password,
      ]);

    const toInsert: Row[] = [];
    const skipped: Row[] = [];
    for (const row of rows) {
      let exists = false;
      for (const hash of hashesById.get(row.loginId) ?? [])
        if (await bcrypt.compare(row.password, hash)) {
          exists = true;
          break;
        }
      (exists ? skipped : toInsert).push(row);
    }

    console.log(`Database: ${new URL(url).host}`);
    console.log(`Rows in file:                 ${rows.length}`);
    console.log(`Already in database (skipped): ${skipped.length}`);
    console.log(`To insert:                     ${toInsert.length}`);
    toInsert.forEach((r) =>
      console.log(`  + ${r.loginId} ${r.fullName} (${r.churchName})`),
    );

    if (dryRun || toInsert.length === 0) {
      console.log(dryRun ? 'Dry run: nothing written.' : 'Nothing to insert.');
      return;
    }

    const data = [];
    for (const [index, row] of toInsert.entries()) {
      data.push({
        loginId: row.loginId,
        password: await bcrypt.hash(row.password, BCRYPT_COST),
        fullName: row.fullName,
        churchName: row.churchName,
      });
      if ((index + 1) % 100 === 0)
        console.log(`  hashed ${index + 1}/${toInsert.length}`);
    }
    const { count } = await prisma.user.createMany({ data });
    console.log(`Inserted: ${count}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
