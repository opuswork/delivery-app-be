/**
 * Prints the bcrypt hash for the dashboard's "admin" login. Put the output in
 * ADMIN_PASSWORD_HASH (be/.env locally, Render → Environment in production).
 * The password itself is never stored anywhere.
 *
 *   npm run admin:hash
 */
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

import * as bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;
const MIN_LENGTH = 10;

/** Reads a line without echoing it to the terminal. */
function askHidden(question: string): Promise<string> {
  process.stdout.write(question);
  let muted = true;
  const output = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      muted = false;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  const password = await askHidden('New admin password: ');
  if (password.length < MIN_LENGTH || Buffer.byteLength(password) > 72) {
    throw new Error(`Use ${MIN_LENGTH}–72 characters.`);
  }
  if ((await askHidden('Repeat it: ')) !== password) {
    throw new Error('The passwords do not match.');
  }
  console.log(
    `\nADMIN_PASSWORD_HASH=${await bcrypt.hash(password, BCRYPT_COST)}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
