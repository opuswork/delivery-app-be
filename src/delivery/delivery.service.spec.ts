import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { DeliveryService, monthRange } from './delivery.service';

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

describe('DeliveryService', () => {
  let findMany: jest.Mock;
  let create: jest.Mock;
  let updateMany: jest.Mock;
  let deleteMany: jest.Mock;
  let service: DeliveryService;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    create = jest.fn().mockResolvedValue({ delivery_number: 1 });
    updateMany = jest.fn().mockResolvedValue({ count: 0 });
    deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    service = new DeliveryService({
      deliveryRecord: {
        findMany,
        create,
        updateMany,
        deleteMany,
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
      memo: '1급진간장 1.8리터 10통',
    });

    const [[args]] = create.mock.calls as [[{ data: Record<string, unknown> }]];
    expect(args.data).toEqual({
      delivery_date: '2026-10-07',
      company_name: '홈플러스',
      memo: '1급진간장 1.8리터 10통',
      userid: 7,
    });
  });

  it('only updates records owned by the user', async () => {
    await expect(
      service.update(7, 3, {
        delivery_date: '2026-10-07',
        company_name: '홈플러스',
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
});
