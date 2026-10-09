import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { DeviceAuthDto } from './device-auth.dto';

function errorsFor(body: Record<string, unknown>): string[] {
  return validateSync(plainToInstance(DeviceAuthDto, body)).map(
    (e) => e.property,
  );
}

describe('DeviceAuthDto', () => {
  it('accepts a 32-byte base64url key', () => {
    expect(errorsFor({ deviceKey: 'aZ0-_'.repeat(9).slice(0, 43) })).toEqual(
      [],
    );
  });

  it.each([
    ['too short', 'a'.repeat(42)],
    ['too long', 'a'.repeat(129)],
    ['not base64url', `${'a'.repeat(42)}+`],
    ['empty', ''],
  ])('rejects a key that is %s', (_case, deviceKey) => {
    expect(errorsFor({ deviceKey })).toEqual(['deviceKey']);
  });
});
