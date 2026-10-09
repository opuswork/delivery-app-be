import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type {
  PeriodSummaryDto,
  UsageSeriesPointDto,
  UsageSummaryDto,
  UserUsageDto,
} from './dto/usage.dto';
import type { UsageUnit } from './dto/usage-series.query';

/** How many periods the trend shows, ending with the current one. */
export const SERIES_LENGTH: Record<UsageUnit, number> = {
  day: 30,
  week: 12,
  month: 12,
};

interface PeriodStartsRow {
  today: string;
  week: string;
  month: string;
}

function periodSummary(
  accounts: UserUsageDto[],
  key: 'today' | 'week' | 'month',
  start: string,
): PeriodSummaryDto {
  return {
    deliveries: accounts.reduce((sum, account) => sum + account[key], 0),
    activeUsers: accounts.filter((account) => account[key] > 0).length,
    // "yyyy-mm-dd hh:mm" and "yyyy-mm-dd" compare correctly as strings.
    newUsers: accounts.filter((account) => account.createdAt >= start).length,
  };
}

/**
 * Usage = deliveries recorded, counted by when they were saved ("createdAt"),
 * not by 납품일. createdAt is stored in UTC; periods are in Korean time and
 * weeks start on Monday (date_trunc).
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async usageSummary(): Promise<UsageSummaryDto> {
    const [starts] = await this.prisma.$queryRaw<PeriodStartsRow[]>`
      SELECT to_char(date_trunc('day', now() AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD') AS today,
             to_char(date_trunc('week', now() AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD') AS week,
             to_char(date_trunc('month', now() AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD') AS month`;

    const accounts = await this.prisma.$queryRaw<UserUsageDto[]>`
      WITH recorded AS (
        SELECT userid, ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul' AS at
        FROM delivery_records
      )
      SELECT u.id, u."fullName",
             to_char((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul',
                     'YYYY-MM-DD HH24:MI') AS "createdAt",
             COUNT(r.at) FILTER (WHERE r.at >= ${starts.today}::timestamp)::int AS today,
             COUNT(r.at) FILTER (WHERE r.at >= ${starts.week}::timestamp)::int AS week,
             COUNT(r.at) FILTER (WHERE r.at >= ${starts.month}::timestamp)::int AS month,
             COUNT(r.at)::int AS total,
             to_char(MAX(r.at), 'YYYY-MM-DD HH24:MI') AS "lastRecordedAt"
      FROM users u
      LEFT JOIN recorded r ON r.userid = u.id
      GROUP BY u.id
      ORDER BY month DESC, total DESC, u.id DESC`;

    return {
      periodStarts: starts,
      users: accounts.length,
      totalDeliveries: accounts.reduce(
        (sum, account) => sum + account.total,
        0,
      ),
      today: periodSummary(accounts, 'today', starts.today),
      week: periodSummary(accounts, 'week', starts.week),
      month: periodSummary(accounts, 'month', starts.month),
      accounts,
    };
  }

  /** Deliveries per day/week/month, oldest first, including empty periods. */
  async usageSeries(
    unit: UsageUnit,
    userId?: number,
  ): Promise<UsageSeriesPointDto[]> {
    if (userId !== undefined) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    const account = userId ?? null;
    const step = `1 ${unit}`;
    return this.prisma.$queryRaw<UsageSeriesPointDto[]>`
      WITH periods AS (
        SELECT generate_series(
          date_trunc(${unit}::text, now() AT TIME ZONE 'Asia/Seoul')
            - (${SERIES_LENGTH[unit] - 1}::int * ${step}::interval),
          date_trunc(${unit}::text, now() AT TIME ZONE 'Asia/Seoul'),
          ${step}::interval
        ) AS start
      ),
      recorded AS (
        SELECT userid,
               date_trunc(${unit}::text, ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul') AS start
        FROM delivery_records
        WHERE ${account}::int IS NULL OR userid = ${account}::int
      )
      SELECT to_char(p.start, 'YYYY-MM-DD') AS period,
             COUNT(r.userid)::int AS deliveries,
             COUNT(DISTINCT r.userid)::int AS "activeUsers"
      FROM periods p
      LEFT JOIN recorded r ON r.start = p.start
      GROUP BY p.start
      ORDER BY p.start`;
  }
}
