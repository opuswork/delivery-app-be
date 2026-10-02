import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { DeliveryService, isRealDateKey, monthRange } from './delivery.service';

describe('monthRange', () => {
  it('covers exactly one month', () => {
    expect(monthRange('2026-09')).toEqual({
      gte: '2026-09-01',
      lt: '2026-10-01',
    });
  });

  it('rolls December over to the next year', () => {
    expect(monthRange('2026-12')).toEqual({
      gte: '2026-12-01',
      lt: '2027-01-01',
    });
  });
});

describe('isRealDateKey', () => {
  it.each(['2026-10-07', '2028-02-29'])('accepts %s', (date) => {
    expect(isRealDateKey(date)).toBe(true);
  });

  it.each(['2026-02-30', '2027-02-29', '2026-13-01'])('rejects %s', (date) => {
    expect(isRealDateKey(date)).toBe(false);
  });
});

describe('DeliveryService', () => {
  let findMany: jest.Mock;
  let create: jest.Mock;
  let updateMany: jest.Mock;
  let deleteMany: jest.Mock;
  let createMany: jest.Mock;
  let findFirst: jest.Mock;
  let service: DeliveryService;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    create = jest.fn().mockResolvedValue({ delivery_number: 1 });
    updateMany = jest.fn().mockResolvedValue({ count: 0 });
    deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    createMany = jest.fn().mockResolvedValue({ count: 2 });
    findFirst = jest.fn().mockResolvedValue(null);
    service = new DeliveryService({
      deliveryRecord: {
        findMany,
        create,
        updateMany,
        deleteMany,
        createMany,
        findFirst,
        findUniqueOrThrow: jest.fn(),
      },
    } as unknown as PrismaService);
  });

  it('lists only the given user’s records within the month', async () => {
    await service.listForMonth(7, '2026-09');

    const [[args]] = findMany.mock.calls as [
      [{ where: unknown; select: Record<string, boolean> }],
    ];
    expect(args.where).toEqual({
      userid: 7,
      delivery_date: { gte: '2026-09-01', lt: '2026-10-01' },
    });
    expect(args.select).not.toHaveProperty('userid');
  });

  it('creates the record for the authenticated user', async () => {
    await service.create(7, {
      delivery_date: '2026-10-07',
      company_name: '홈플러스',
      badge_color: '#413742',
      memo: '1급진간장 1.8리터 10통',
    });

    const [[args]] = create.mock.calls as [[{ data: Record<string, unknown> }]];
    expect(args.data).toEqual({
      delivery_date: '2026-10-07',
      company_name: '홈플러스',
      badge_color: '#413742',
      memo: '1급진간장 1.8리터 10통',
      userid: 7,
    });
  });

  it('only updates records owned by the user', async () => {
    await expect(
      service.update(7, 3, {
        delivery_date: '2026-10-07',
        company_name: '홈플러스',
        badge_color: '#B41DC4',
        memo: '',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const [[args]] = updateMany.mock.calls as [[{ where: unknown }]];
    expect(args.where).toEqual({ delivery_number: 3, userid: 7 });
  });

  it('only deletes records owned by the user', async () => {
    await expect(service.remove(7, 3)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const [[args]] = deleteMany.mock.calls as [[{ where: unknown }]];
    expect(args.where).toEqual({ delivery_number: 3, userid: 7 });
  });

  describe('repeat', () => {
    const content = {
      company_name: '신선유통',
      badge_color: '#1D84C4',
      memo: '',
    };

    it('creates the delivery on each date that does not already have it', async () => {
      findMany.mockResolvedValue([{ delivery_date: '2026-10-14' }]);

      const result = await service.repeat(7, {
        ...content,
        delivery_dates: ['2026-10-21', '2026-10-14', '2026-10-07'],
      });

      const [[query]] = findMany.mock.calls as [[{ where: unknown }]];
      expect(query.where).toEqual({
        userid: 7,
        delivery_date: { in: ['2026-10-21', '2026-10-14', '2026-10-07'] },
        ...content,
      });
      const [[args]] = createMany.mock.calls as [[{ data: unknown[] }]];
      expect(args.data).toEqual([
        { ...content, delivery_date: '2026-10-07', userid: 7 },
        { ...content, delivery_date: '2026-10-21', userid: 7 },
      ]);
      expect(result).toEqual({ created: 2, skipped_dates: ['2026-10-14'] });
    });

    it('rejects dates that do not exist without writing anything', async () => {
      await expect(
        service.repeat(7, {
          ...content,
          delivery_dates: ['2026-10-07', '2026-02-30'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createMany).not.toHaveBeenCalled();
    });
  });

  describe('선택수정', () => {
    it('lists the same 납품처 on every date for the owner', async () => {
      findFirst.mockResolvedValue({ company_name: '공신유통' });

      await service.listSameCompany(7, 3);

      const [[source]] = findFirst.mock.calls as [[{ where: unknown }]];
      expect(source.where).toEqual({ delivery_number: 3, userid: 7 });
      const [[args]] = findMany.mock.calls as [[{ where: unknown }]];
      expect(args.where).toEqual({ userid: 7, company_name: '공신유통' });
    });

    it('rejects a record of another user with 404', async () => {
      await expect(service.listSameCompany(7, 3)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(findMany).not.toHaveBeenCalled();
    });

    it('updates only the selected records owned by the user', async () => {
      updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkUpdate(7, {
        delivery_numbers: [3, 5],
        company_name: '공신유통',
        badge_color: '#B41DC4',
        memo: '수벌 30개',
      });

      const [[args]] = updateMany.mock.calls as [
        [{ where: unknown; data: unknown }],
      ];
      expect(args.where).toEqual({
        userid: 7,
        delivery_number: { in: [3, 5] },
      });
      expect(args.data).toEqual({
        company_name: '공신유통',
        badge_color: '#B41DC4',
        memo: '수벌 30개',
      });
      expect(result).toEqual({ updated: 2 });
    });
  });
});
