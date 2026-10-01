import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { RepeatDeliveryDto } from './repeat-delivery.dto';

const errorsFor = (body: object) =>
  validateSync(plainToInstance(RepeatDeliveryDto, body)).map((e) => e.property);

describe('RepeatDeliveryDto', () => {
  const base = { company_name: '신선유통', delivery_type: '런' };

  it('accepts a list of dates', () => {
    expect(
      errorsFor({ ...base, delivery_dates: ['2026-10-07', '2026-10-14'] }),
    ).toEqual([]);
  });

  it.each([
    ['empty', []],
    ['duplicated', ['2026-10-07', '2026-10-07']],
    ['badly formatted', ['2026-10-7']],
    ['not a list', '2026-10-07'],
  ])('rejects %s dates', (_label, delivery_dates) => {
    expect(errorsFor({ ...base, delivery_dates })).toEqual(['delivery_dates']);
  });
});
