/**
 * Imports users from a tab-separated file:
 *   loginId <TAB> password <TAB> fullName <TAB> churchName
 *
 * - Users whose loginId already exists in the database are skipped.
 * - loginIds that appear more than once in the file (different people
 *   sharing the middle 4 phone digits) are NOT imported; they are written to
 *   <file>.conflicts.tsv for a manual decision.
 * - Passwords are stored as bcrypt hashes only.
 *
 * The data file contains personal data: keep it in be/data/ (git-ignored).
 *
 *   npm run import:users -- data/users-import.tsv            # import
 *   npm run import:users -- data/users-import.tsv --dry-run  # report only
 */
import 'dotenv/config';

import { readFileSync, writeFileSync } from 'node:fs';

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
  const byId = new Map<string, Row[]>();
  for (const row of rows)
    byId.set(row.loginId, [...(byId.get(row.loginId) ?? []), row]);
  const conflicts = [...byId.values()]
    .filter((group) => group.length > 1)
    .flat();
  const unique = [...byId.values()]
    .filter((group) => group.length === 1)
    .flat();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const existing = new Set(
      (
        await prisma.user.findMany({
          where: { loginId: { in: [...byId.keys()] } },
          select: { loginId: true },
        })
      ).map((user) => user.loginId),
    );
    const toInsert = unique.filter((row) => !existing.has(row.loginId));
    const skipped = unique.filter((row) => existing.has(row.loginId));

    console.log(`Database: ${new URL(url).host}`);
    console.log(`Rows in file:                 ${rows.length}`);
    console.log(`Already in database (skipped): ${skipped.length}`);
    skipped.forEach((r) =>
      console.log(`  - ${r.loginId} ${r.fullName} (${r.churchName})`),
    );
    console.log(`Shared loginIds (held back):   ${conflicts.length} rows`);
    console.log(`To insert:                     ${toInsert.length}`);

    if (conflicts.length > 0) {
      const report = `${path}.conflicts.tsv`;
      writeFileSync(
        report,
        conflicts
          .map((r) =>
            [
              r.loginId,
              r.password,
              r.fullName,
              r.churchName,
              `line ${r.line}`,
            ].join('\t'),
          )
          .join('\n') + '\n',
      );
      console.log(`Conflicts written to ${report}`);
    }
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
    // skipDuplicates also covers users created while this script was running.
    const { count } = await prisma.user.createMany({
      data,
      skipDuplicates: true,
    });
    console.log(`Inserted: ${count}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
