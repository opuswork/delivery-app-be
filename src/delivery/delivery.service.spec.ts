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
  let transaction: jest.Mock;
  let service: DeliveryService;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    create = jest.fn().mockResolvedValue({ delivery_number: 1 });
    transaction = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));
    service = new DeliveryService({
      deliveryRecord: { findMany, create },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  it('saves every batch item as its own record in one transaction', async () => {
    await service.createBatch(7, {
      company_name: '신선유통',
      delivery_date: '2026-10-03',
      items: [
        { product_name: '깔끔한국간장', product_quantity: '3통' },
        { product_name: '생명물간장', product_quantity: '2박스' },
      ],
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    const datas = (create.mock.calls as [{ data: object }][]).map(
      ([args]) => args.data,
    );
    expect(datas).toEqual([
      {
        company_name: '신선유통',
        product_name: '깔끔한국간장',
        product_quantity: '3통',
        delivery_date: '2026-10-03',
        userid: 7,
      },
      {
        company_name: '신선유통',
        product_name: '생명물간장',
        product_quantity: '2박스',
        delivery_date: '2026-10-03',
        userid: 7,
      },
    ]);
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
      company_name: '하나마트',
      product_name: '1급진간장1.8L',
      product_quantity: '4통',
      delivery_date: '2026-09-30',
    });

    const [[args]] = create.mock.calls as [[{ data: Record<string, unknown> }]];
    expect(args.data).toEqual({
      company_name: '하나마트',
      product_name: '1급진간장1.8L',
      product_quantity: '4통',
      delivery_date: '2026-09-30',
      userid: 7,
    });
  });
});
