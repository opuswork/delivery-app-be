import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CreateDeliveryDto } from './create-delivery.dto';

const parse = (body: object) => {
  const dto = plainToInstance(CreateDeliveryDto, body);
  return { dto, errors: validateSync(dto) };
};

describe('CreateDeliveryDto', () => {
  const base = {
    delivery_date: '2026-10-07',
    company_name: ' 홈플러스 ',
    badge_color: '#b41dc4',
  };

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

  it('stores the colour in upper case', () => {
    const { dto, errors } = parse(base);
    expect(errors).toEqual([]);
    expect(dto.badge_color).toBe('#B41DC4');
  });

  it('defaults an omitted colour to empty', () => {
    const { dto, errors } = parse({ ...base, badge_color: undefined });
    expect(errors).toEqual([]);
    expect(dto.badge_color).toBe('');
  });

  it.each(['빨강', '#12345', 'red'])('rejects the colour %s', (badge_color) => {
    const { errors } = parse({ ...base, badge_color });
    expect(errors.map((e) => e.property)).toEqual(['badge_color']);
  });

  it('still accepts a 납품종류 from older clients', () => {
    expect(parse({ ...base, delivery_type: '간장' }).errors).toEqual([]);
  });
});
