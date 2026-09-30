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
      delivery_date: '2026-09-29',
      memo: '하나마트 1급진간장1.8L 4통',
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
        .send({ ...record, memo: `  ${record.memo}  ` })
        .expect(201);
      expect(res.body).toMatchObject(record);
      expect(
        typeof (res.body as { delivery_number: unknown }).delivery_number,
      ).toBe('number');
    });

    const invalidBodies: [string, Record<string, unknown>][] = [
      ['impossible date', { ...record, delivery_date: '2026-02-30' }],
      ['unparsed date', { ...record, delivery_date: '29일' }],
      ['empty memo', { ...record, memo: '   ' }],
      ['too long memo', { ...record, memo: 'x'.repeat(1001) }],
      ['client-supplied userid', { ...record, userid: 1 }],
      ['old company field', { ...record, company_name: '하나마트' }],
    ];

    it.each(invalidBodies)('rejects %s with 400', async (_label, body) => {
      await api()
        .post('/deliveries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(body)
        .expect(400);
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

    describe('PUT and DELETE /deliveries/:id', () => {
      const create = async () =>
        (
          await api()
            .post('/deliveries')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ delivery_date: '2026-12-07', memo: '신선유통 국간장 3통' })
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
          .send({ delivery_date: '2027-01-05', memo: '신선유통 국간장 5통' })
          .expect(200);
        expect(res.body).toEqual({
          delivery_number,
          delivery_date: '2027-01-05',
          memo: '신선유통 국간장 5통',
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
          .send({ delivery_date: '2026-12-07', memo: 'hacked' })
          .expect(404);
        await api()
          .delete(`/deliveries/${delivery_number}`)
          .set('Authorization', `Bearer ${tokenB}`)
          .expect(404);
        expect(await month('2026-12')).toEqual([
          expect.objectContaining({ memo: '신선유통 국간장 3통' }),
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
