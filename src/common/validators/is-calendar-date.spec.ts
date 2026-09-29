import { isCalendarDate } from './is-calendar-date';

describe('isCalendarDate', () => {
  it.each(['2026-09-30', '2026-01-01', '2028-02-29', '2026-12-31'])(
    'accepts %s',
    (value) => expect(isCalendarDate(value)).toBe(true),
  );

  it.each([
    '2026-02-30',
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-9-30',
    '2026/09/30',
    '20260930',
    '',
    20260930,
    null,
  ])('rejects %p', (value) => expect(isCalendarDate(value)).toBe(false));
});
