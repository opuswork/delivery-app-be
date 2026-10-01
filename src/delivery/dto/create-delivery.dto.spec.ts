import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CreateDeliveryDto } from './create-delivery.dto';

const parse = (body: object) => {
  const dto = plainToInstance(CreateDeliveryDto, body);
  return { dto, errors: validateSync(dto) };
};

describe('CreateDeliveryDto', () => {
  const base = { delivery_date: '2026-10-07', company_name: ' 홈플러스 ' };

  it.each([
    ['omitted', {}],
    ['null', { memo: null }],
    ['blank', { memo: '   ' }],
  ])('treats a %s memo as empty', (_label, extra) => {
    const { dto, errors } = parse({ ...base, ...extra });
    expect(errors).toEqual([]);
    expect(dto.memo).toBe('');
    expect(dto.company_name).toBe('홈플러스');
  });

  it('requires 납품처', () => {
    expect(parse({ ...base, company_name: '  ' }).errors).toHaveLength(1);
  });
});
