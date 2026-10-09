/**
 * End-to-end tests against the real PostgreSQL database from .env
 * (docker compose). Creates two throwaway device accounts and removes them afterwards.
 */
import 'dotenv/config';

import { randomBytes } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { hashDeviceKey } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DEVICE_A = randomBytes(32).toString('base64url');
const DEVICE_B = randomBytes(32).toString('base64url');
const ADMIN_PASSWORD = 'e2e-admin-password';
// Read by ConfigModule when the app boots below.
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 4);

interface TokenBody {
  accessToken: string;
}

describe('Voice Delivery API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let adminToken: string;

  const authDevice = (deviceKey: string) =>
    request(app.getHttpServer()).post('/auth/device').send({ deviceKey });
  const adminLogin = (body: object) =>
    request(app.getHttpServer()).post('/auth/admin/login').send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    tokenA = ((await authDevice(DEVICE_A).expect(200)).body as TokenBody)
      .accessToken;
    tokenB = ((await authDevice(DEVICE_B).expect(200)).body as TokenBody)
      .accessToken;
    adminToken = (
      (
        await adminLogin({ loginId: 'admin', password: ADMIN_PASSWORD }).expect(
          200,
        )
      ).body as TokenBody
    ).accessToken;
  });

  afterAll(async () => {
    // Deliveries cascade with their users.
    await prisma?.user.deleteMany({
      where: {
        deviceKeyHash: {
          in: [hashDeviceKey(DEVICE_A), hashDeviceKey(DEVICE_B)],
        },
      },
    });
    await app?.close();
  });

  describe('POST /auth/device', () => {
    it('rejects a malformed key with 400', async () => {
      await authDevice('short').expect(400);
    });

    it('returns the same account for the same key', async () => {
      const again = (await authDevice(DEVICE_A).expect(200)).body as TokenBody;
      const me = (token: string) =>
        request(app.getHttpServer())
          .get('/users/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      const [first, second] = await Promise.all([
        me(tokenA),
        me(again.accessToken),
      ]);
      expect((second.body as { id: number }).id).toBe(
        (first.body as { id: number }).id,
      );
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

    it('returns the account without secrets', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body).toMatchObject({ fullName: '' });
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('deviceKeyHash');
    });

    it('refuses admin tokens on member routes', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('admin dashboard', () => {
    const api = () => request(app.getHttpServer());

    it('rejects a wrong admin password with 401', async () => {
      await adminLogin({ loginId: 'admin', password: 'wrong-password' }).expect(
        401,
      );
    });

    it('refuses device tokens', async () => {
      await api()
        .get('/admin/usage')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
    });

    it("counts a device's deliveries today, this week and this month", async () => {
      const created = await api()
        .post('/deliveries')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          delivery_date: '2026-12-01',
          company_name: '대시보드마트',
          badge_color: '#413742',
        })
        .expect(201);

      const res = await api()
        .get('/admin/usage')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = res.body as {
        today: { deliveries: number; activeUsers: number; newUsers: number };
        accounts: { id: number; today: number; week: number; month: number }[];
      };
      const meB = (
        await api()
          .get('/users/me')
          .set('Authorization', `Bearer ${tokenB}`)
          .expect(200)
      ).body as { id: number };
      expect(body.accounts.find((a) => a.id === meB.id)).toMatchObject({
        today: 1,
        week: 1,
        month: 1,
      });
      expect(body.today.activeUsers).toBeGreaterThanOrEqual(1);
      expect(body.today.newUsers).toBeGreaterThanOrEqual(2);

      const series = await api()
        .get(`/admin/usage/series?unit=day&userId=${meB.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const points = series.body as { deliveries: number }[];
      expect(points).toHaveLength(30);
      expect(points[points.length - 1]).toMatchObject({
        deliveries: 1,
        activeUsers: 1,
      });

      await prisma.deliveryRecord.delete({
        where: {
          delivery_number: (created.body as { delivery_number: number })
            .delivery_number,
        },
      });
    });

    it.each([
      ['unit=year', 400],
      ['unit=week&userId=0', 400],
      ['unit=month&userId=999999999', 404],
    ])('series?%s → %i', async (query, status) => {
      await api()
        .get(`/admin/usage/series?${query}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(status);
    });
  });

  describe('/deliveries', () => {
    const record = {
      delivery_date: '2026-09-29',
      company_name: '하나마트',
      badge_color: '#413742',
      memo: '1급진간장1.8L 4통',
    };
    const api = () => request(app.getHttpServer());
    const month = async (m: string) =>
      (
        await api()
          .get(`/deliveries?month=${m}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200)
      ).body as (typeof record & { delivery_number: number })[];

    it('requires a token', async () => {
      await api().get('/deliveries?month=2026-09').expect(401);
    });

    it('creates a record for the authenticated user', async () => {
      const res = await api()
        .post('/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...record, company_name: ` ${record.company_name} ` })
        .expect(201);
      expect(res.body).toMatchObject(record);
      expect(
        typeof (res.body as { delivery_number: unknown }).delivery_number,
      ).toBe('number');
    });

    const invalidBodies: [string, Record<string, unknown>][] = [
      ['impossible date', { ...record, delivery_date: '2026-02-30' }],
      ['unparsed date', { ...record, delivery_date: '29일' }],
      ['empty company', { ...record, company_name: '   ' }],
      [
        'missing company',
        {
          delivery_date: record.delivery_date,
          badge_color: '#413742',
          memo: 'x',
        },
      ],
      ['invalid badge colour', { ...record, badge_color: '빨강' }],
      ['too long memo', { ...record, memo: 'x'.repeat(1001) }],
      ['client-supplied userid', { ...record, userid: 1 }],
      ['unknown field', { ...record, product_name: '간장' }],
    ];

    it.each(invalidBodies)('rejects %s with 400', async (_label, body) => {
      await api()
        .post('/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(400);
    });

    it('accepts a delivery without a memo', async () => {
      const res = await api()
        .post('/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          delivery_date: '2026-11-02',
          company_name: '우리식당',
          badge_color: '#B41DC4',
        })
        .expect(201);
      expect(res.body).toMatchObject({ company_name: '우리식당', memo: '' });
      await prisma.deliveryRecord.deleteMany({
        where: { delivery_date: '2026-11-02' },
      });
    });

    it('lists the month for the owner only', async () => {
      expect(await month('2026-09')).toEqual([expect.objectContaining(record)]);

      const other = await api()
        .get('/deliveries?month=2026-09')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(other.body).toEqual([]);

      expect(await month('2026-10')).toEqual([]);
    });

    describe('POST /deliveries/repeat', () => {
      const repeat = {
        company_name: '신선유통',
        badge_color: '#1D84C4',
        memo: '',
        delivery_dates: ['2027-03-03', '2027-03-10', '2027-03-17'],
      };

      afterEach(async () => {
        await prisma.deliveryRecord.deleteMany({
          where: { delivery_date: { gte: '2027-03-01', lt: '2027-04-01' } },
        });
      });

      it('copies the delivery onto each date, skipping ones that have it', async () => {
        const send = () =>
          api()
            .post('/deliveries/repeat')
            .set('Authorization', `Bearer ${tokenA}`)
            .send(repeat)
            .expect(201);
        expect((await send()).body).toEqual({ created: 3, skipped_dates: [] });
        expect((await send()).body).toEqual({
          created: 0,
          skipped_dates: repeat.delivery_dates,
        });
        expect(await month('2027-03')).toHaveLength(3);
      });

      it('rejects an impossible date and saves nothing', async () => {
        await api()
          .post('/deliveries/repeat')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ ...repeat, delivery_dates: ['2027-03-03', '2027-02-30'] })
          .expect(400);
        expect(await month('2027-03')).toEqual([]);
      });
    });

    describe('선택수정 (same-company + PUT /deliveries/bulk)', () => {
      afterEach(async () => {
        await prisma.deliveryRecord.deleteMany({
          where: { delivery_date: { gte: '2027-04-01', lt: '2027-05-01' } },
        });
      });

      it('lists the same 납품처 and updates only the selected records', async () => {
        await api()
          .post('/deliveries/repeat')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            company_name: '공신유통',
            badge_color: '#B41DC4',
            memo: '두부 10모',
            delivery_dates: ['2027-04-06', '2027-04-13', '2027-04-20'],
          })
          .expect(201);
        const [first, second, third] = await month('2027-04');

        const same = await api()
          .get(`/deliveries/${first.delivery_number}/same-company`)
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(200);
        expect(same.body).toHaveLength(3);
        await api()
          .get(`/deliveries/${first.delivery_number}/same-company`)
          .set('Authorization', `Bearer ${tokenB}`)
          .expect(404);

        const res = await api()
          .put('/deliveries/bulk')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            delivery_numbers: [first.delivery_number, third.delivery_number],
            company_name: '공신유통',
            badge_color: '#413742',
            memo: '국간장 2통',
          })
          .expect(200);
        expect(res.body).toEqual({ updated: 2 });
        expect(
          (await month('2027-04')).map((r) => [r.badge_color, r.memo]),
        ).toEqual([
          ['#413742', '국간장 2통'],
          ['#B41DC4', '두부 10모'],
          ['#413742', '국간장 2통'],
        ]);

        const other = await api()
          .put('/deliveries/bulk')
          .set('Authorization', `Bearer ${tokenB}`)
          .send({
            delivery_numbers: [second.delivery_number],
            company_name: 'hacked',
            badge_color: '#1D84C4',
            memo: '',
          })
          .expect(200);
        expect(other.body).toEqual({ updated: 0 });
      });
    });

    describe('PUT and DELETE /deliveries/:id', () => {
      const create = async () =>
        (
          await api()
            .post('/deliveries')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
              delivery_date: '2026-12-07',
              company_name: '신선유통',
              badge_color: '#1D84C4',
              memo: '국간장 3통',
            })
            .expect(201)
        ).body as { delivery_number: number };

      afterEach(async () => {
        await prisma.deliveryRecord.deleteMany({
          where: { delivery_date: { gte: '2026-12-01', lt: '2027-02-01' } },
        });
      });

      it('updates the date and memo', async () => {
        const { delivery_number } = await create();
        const res = await api()
          .put(`/deliveries/${delivery_number}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            delivery_date: '2027-01-05',
            company_name: '신선유통상사',
            badge_color: '#413742',
            memo: '국간장 5통',
          })
          .expect(200);
        expect(res.body).toEqual({
          delivery_number,
          delivery_date: '2027-01-05',
          company_name: '신선유통상사',
          badge_color: '#413742',
          memo: '국간장 5통',
        });
        expect(await month('2026-12')).toEqual([]);
        expect(await month('2027-01')).toHaveLength(1);
      });

      it('deletes the record', async () => {
        const { delivery_number } = await create();
        await api()
          .delete(`/deliveries/${delivery_number}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(204);
        expect(await month('2026-12')).toEqual([]);
      });

      it("rejects another user's record with 404 and changes nothing", async () => {
        const { delivery_number } = await create();
        await api()
          .put(`/deliveries/${delivery_number}`)
          .set('Authorization', `Bearer ${tokenB}`)
          .send({
            delivery_date: '2026-12-07',
            company_name: 'hacked',
            badge_color: '#1D84C4',
            memo: '',
          })
          .expect(404);
        await api()
          .delete(`/deliveries/${delivery_number}`)
          .set('Authorization', `Bearer ${tokenB}`)
          .expect(404);
        expect(await month('2026-12')).toEqual([
          expect.objectContaining({ company_name: '신선유통' }),
        ]);
      });

      it('rejects a non-numeric id with 400', async () => {
        await api()
          .delete('/deliveries/abc')
          .set('Authorization', `Bearer ${tokenA}`)
          .expect(400);
      });

      it('allows PUT and DELETE from the frontend origin (CORS)', async () => {
        for (const method of ['PUT', 'DELETE']) {
          const res = await api()
            .options('/deliveries/1')
            .set('Origin', 'http://localhost:3100')
            .set('Access-Control-Request-Method', method);
          expect(res.headers['access-control-allow-methods']).toContain(method);
        }
      });
    });

    it('validates the month query', async () => {
      await api()
        .get('/deliveries?month=2026-9')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
    });
  });
});
