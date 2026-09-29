/**
 * End-to-end tests against the real PostgreSQL database from .env
 * (docker compose). Creates two throwaway users and removes them afterwards.
 */
import 'dotenv/config';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const USER_A = { loginId: '9871', password: '11112222' };
const USER_B = { loginId: '9872', password: '33334444' };

interface LoginBody {
  accessToken: string;
  user: Record<string, unknown>;
}

describe('Voice Delivery API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;

  const login = (body: object) =>
    request(app.getHttpServer()).post('/auth/login').send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    const loginIds = [USER_A.loginId, USER_B.loginId];
    await prisma.user.deleteMany({ where: { loginId: { in: loginIds } } });
    for (const u of [USER_A, USER_B]) {
      await prisma.user.create({
        data: {
          loginId: u.loginId,
          password: await bcrypt.hash(u.password, 4),
          fullName: `e2e-${u.loginId}`,
        },
      });
    }

    tokenA = ((await login(USER_A).expect(200)).body as LoginBody).accessToken;
    tokenB = ((await login(USER_B).expect(200)).body as LoginBody).accessToken;
  });

  afterAll(async () => {
    // Deliveries cascade with their users.
    await prisma?.user.deleteMany({
      where: { loginId: { in: [USER_A.loginId, USER_B.loginId] } },
    });
    await app?.close();
  });

  describe('POST /auth/login', () => {
    it('rejects malformed credentials with 400', async () => {
      const res = await login({ loginId: '01012345678', password: 'abc' });
      expect(res.status).toBe(400);
    });

    it('rejects a wrong password with 401', async () => {
      const res = await login({ ...USER_A, password: '99999999' });
      expect(res.status).toBe(401);
    });

    it('rate-limits repeated attempts with 429', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        statuses.push(
          (await login({ ...USER_B, password: '00000000' })).status,
        );
      }
      expect(statuses).toContain(429);
    });
  });

  describe('GET /users/me', () => {
    it('requires a token', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('rejects an invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer not.a.jwt')
        .expect(401);
    });

    it('returns the user without the password hash', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body).toMatchObject({
        loginId: USER_A.loginId,
        churchName: 'joongang',
      });
      expect(res.body).not.toHaveProperty('password');
    });
  });

  describe('/deliveries', () => {
    const record = {
      company_name: '하나마트',
      product_name: '1급진간장1.8L',
      product_quantity: '4통',
      delivery_date: '2026-09-29',
    };

    it('requires a token', async () => {
      await request(app.getHttpServer())
        .get('/deliveries?month=2026-09')
        .expect(401);
    });

    it('creates a record for the authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .post('/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(record)
        .expect(201);
      expect(res.body).toMatchObject(record);
      expect(
        typeof (res.body as { delivery_number: unknown }).delivery_number,
      ).toBe('number');
    });

    const invalidBodies: [string, Record<string, unknown>][] = [
      ['impossible date', { ...record, delivery_date: '2026-02-30' }],
      ['unparsed date', { ...record, delivery_date: '29일' }],
      ['empty company', { ...record, company_name: '' }],
      ['client-supplied userid', { ...record, userid: 1 }],
    ];

    it.each(invalidBodies)('rejects %s with 400', async (_label, body) => {
      await request(app.getHttpServer())
        .post('/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(400);
    });

    it('lists the month for the owner only', async () => {
      const own = await request(app.getHttpServer())
        .get('/deliveries?month=2026-09')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(own.body).toEqual([expect.objectContaining(record)]);

      const other = await request(app.getHttpServer())
        .get('/deliveries?month=2026-09')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(other.body).toEqual([]);

      const nextMonth = await request(app.getHttpServer())
        .get('/deliveries?month=2026-10')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(nextMonth.body).toEqual([]);
    });

    describe('POST /deliveries/batch', () => {
      const batch = {
        company_name: '신선유통',
        delivery_date: '2026-11-03',
        items: [
          { product_name: '깔끔한국간장', product_quantity: '3통' },
          { product_name: '생명물간장', product_quantity: '2박스' },
        ],
      };
      const november = () =>
        request(app.getHttpServer())
          .get('/deliveries?month=2026-11')
          .set('Authorization', `Bearer ${tokenA}`);

      it.each([
        ['empty items', { ...batch, items: [] }],
        ['11 items', { ...batch, items: Array(11).fill(batch.items[0]) }],
        [
          'an item without quantity',
          {
            ...batch,
            items: [
              batch.items[0],
              { product_name: '생명물간장', product_quantity: '' },
            ],
          },
        ],
        [
          'userid inside an item',
          { ...batch, items: [{ ...batch.items[0], userid: 1 }] },
        ],
        ['impossible date', { ...batch, delivery_date: '2026-11-31' }],
      ] as [string, object][])(
        'rejects %s with 400 and saves nothing',
        async (_label, body) => {
          await request(app.getHttpServer())
            .post('/deliveries/batch')
            .set('Authorization', `Bearer ${tokenA}`)
            .send(body)
            .expect(400);
          expect((await november().expect(200)).body).toEqual([]);
        },
      );

      it('saves one record per item with the shared company and date', async () => {
        const res = await request(app.getHttpServer())
          .post('/deliveries/batch')
          .set('Authorization', `Bearer ${tokenA}`)
          .send(batch)
          .expect(201);
        expect(res.body).toEqual([
          expect.objectContaining({
            company_name: '신선유통',
            product_name: '깔끔한국간장',
            product_quantity: '3통',
            delivery_date: '2026-11-03',
          }),
          expect.objectContaining({
            company_name: '신선유통',
            product_name: '생명물간장',
            product_quantity: '2박스',
            delivery_date: '2026-11-03',
          }),
        ]);
        expect((await november().expect(200)).body).toHaveLength(2);
      });

      it('requires a token', async () => {
        await request(app.getHttpServer())
          .post('/deliveries/batch')
          .send(batch)
          .expect(401);
      });
    });

    describe('PUT /deliveries/group', () => {
      interface Rec {
        delivery_number: number;
        company_name: string;
        product_name: string;
        product_quantity: string;
        delivery_date: string;
      }
      const put = (token: string, body: object) =>
        request(app.getHttpServer())
          .put('/deliveries/group')
          .set('Authorization', `Bearer ${token}`)
          .send(body);
      const month = async (m: string) =>
        (
          await request(app.getHttpServer())
            .get(`/deliveries?month=${m}`)
            .set('Authorization', `Bearer ${tokenA}`)
            .expect(200)
        ).body as Rec[];
      const createGroup = async () =>
        (
          await request(app.getHttpServer())
            .post('/deliveries/batch')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
              company_name: '신선유통',
              delivery_date: '2026-12-07',
              items: [
                {
                  product_name: '깔끔한 국간장 120ml',
                  product_quantity: '10개',
                },
                { product_name: '생명물관장 120ml', product_quantity: '5개' },
              ],
            })
            .expect(201)
        ).body as Rec[];

      afterEach(async () => {
        await prisma.deliveryRecord.deleteMany({
          where: { delivery_date: { gte: '2026-12-01', lt: '2027-02-01' } },
        });
      });

      it('updates, adds and deletes rows in one step', async () => {
        const [first, second] = await createGroup();
        const res = await put(tokenA, {
          delivery_numbers: [first.delivery_number, second.delivery_number],
          company_name: '신선유통상사',
          delivery_date: '2026-12-08',
          items: [
            {
              delivery_number: first.delivery_number,
              product_name: '깔끔한 국간장 120ml',
              product_quantity: '12개',
            },
            { product_name: '양조간장 500ml', product_quantity: '3박스' },
          ],
        }).expect(200);

        const saved = res.body as Rec[];
        expect(saved).toHaveLength(2);
        expect(saved[0]).toMatchObject({
          delivery_number: first.delivery_number,
          product_quantity: '12개',
        });
        const december = await month('2026-12');
        expect(december).toHaveLength(2);
        expect(
          december.every(
            (r) =>
              r.company_name === '신선유통상사' &&
              r.delivery_date === '2026-12-08',
          ),
        ).toBe(true);
        expect(december.map((r) => r.delivery_number)).not.toContain(
          second.delivery_number,
        );
      });

      it('moves the block to another month', async () => {
        const rows = await createGroup();
        await put(tokenA, {
          delivery_numbers: rows.map((r) => r.delivery_number),
          company_name: '신선유통',
          delivery_date: '2027-01-05',
          items: rows.map(
            ({ delivery_number, product_name, product_quantity }) => ({
              delivery_number,
              product_name,
              product_quantity,
            }),
          ),
        }).expect(200);
        expect(await month('2026-12')).toEqual([]);
        expect(await month('2027-01')).toHaveLength(2);
      });

      it('deletes the whole block when items is empty', async () => {
        const rows = await createGroup();
        await put(tokenA, {
          delivery_numbers: rows.map((r) => r.delivery_number),
          company_name: '신선유통',
          delivery_date: '2026-12-07',
          items: [],
        }).expect(200);
        expect(await month('2026-12')).toEqual([]);
      });

      it("rejects another user's rows with 404 and changes nothing", async () => {
        const rows = await createGroup();
        await put(tokenB, {
          delivery_numbers: rows.map((r) => r.delivery_number),
          company_name: 'hacked',
          delivery_date: '2026-12-07',
          items: [],
        }).expect(404);
        expect(await month('2026-12')).toHaveLength(2);
      });

      it.each([
        [
          'an item id outside the group',
          (ids: number[]) => ({
            items: [
              {
                delivery_number: 999999,
                product_name: 'x',
                product_quantity: '1개',
              },
            ],
            delivery_numbers: ids,
          }),
        ],
        [
          'an empty quantity',
          (ids: number[]) => ({
            items: [
              {
                delivery_number: ids[0],
                product_name: 'x',
                product_quantity: '',
              },
            ],
            delivery_numbers: ids,
          }),
        ],
        [
          'an impossible date',
          (ids: number[]) => ({
            items: [],
            delivery_numbers: ids,
            delivery_date: '2026-02-30',
          }),
        ],
        ['no delivery_numbers', () => ({ items: [], delivery_numbers: [] })],
      ] as [string, (ids: number[]) => object][])(
        'rejects %s with 400 and changes nothing',
        async (_label, build) => {
          const rows = await createGroup();
          const ids = rows.map((r) => r.delivery_number);
          await put(tokenA, {
            company_name: '신선유통',
            delivery_date: '2026-12-07',
            ...build(ids),
          }).expect(400);
          const december = await month('2026-12');
          expect(december.map((r) => r.product_quantity).sort()).toEqual([
            '10개',
            '5개',
          ]);
        },
      );

      it('allows PUT from the frontend origin (CORS)', async () => {
        const res = await request(app.getHttpServer())
          .options('/deliveries/group')
          .set('Origin', 'http://localhost:3100')
          .set('Access-Control-Request-Method', 'PUT');
        expect(res.headers['access-control-allow-methods']).toContain('PUT');
      });
    });

    it('validates the month query', async () => {
      await request(app.getHttpServer())
        .get('/deliveries?month=2026-9')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
    });
  });
});
