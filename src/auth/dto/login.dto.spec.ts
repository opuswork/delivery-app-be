import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { LoginDto } from './login.dto';

function errorsFor(body: Record<string, unknown>): string[] {
  return validateSync(plainToInstance(LoginDto, body)).map((e) => e.property);
}

describe('LoginDto', () => {
  it('accepts a 4-digit ID and an 8-digit password', () => {
    expect(errorsFor({ loginId: '1234', password: '12345678' })).toEqual([]);
  });

  it.each([
    ['123', 'too short'],
    ['12345', 'too long'],
    ['12a4', 'non-digit'],
    ['01012345678', 'full phone number'],
  ])('rejects loginId %s (%s)', (loginId) => {
    expect(errorsFor({ loginId, password: '12345678' })).toEqual(['loginId']);
  });

  it.each([['1234567'], ['123456789'], ['1234567a'], ['']])(
    'rejects password %s',
    (password) => {
      expect(errorsFor({ loginId: '1234', password })).toEqual(['password']);
    },
  );

  it('rejects numeric (non-string) values', () => {
    expect(errorsFor({ loginId: 1234, password: 12345678 })).toEqual([
      'loginId',
      'password',
    ]);
  });
});
