import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  BulkUpdateDeliveryDto,
  BulkUpdateDeliveryResponseDto,
} from './dto/bulk-delivery.dto';
import {
  CreateDeliveryDto,
  DELIVERY_TYPE_COLORS,
  DeliveryContentDto,
} from './dto/create-delivery.dto';
import {
  DELIVERY_RESPONSE_SELECT,
  DeliveryResponseDto,
} from './dto/delivery-response.dto';
import {
  RepeatDeliveryDto,
  RepeatDeliveryResponseDto,
} from './dto/repeat-delivery.dto';

const NOT_FOUND = '배달 기록을 찾을 수 없습니다.';

/**
 * yyyy-mm → [first day, first day of next month) as yyyy-mm-dd strings.
 * yyyy-mm-dd sorts lexicographically, so a string range query is exact.
 */
export function monthRange(month: string): { gte: string; lt: string } {
  const [year, mon] = month.split('-').map(Number);
  const nextYear = mon === 12 ? year + 1 : year;
  const nextMonth = mon === 12 ? 1 : mon + 1;
  return {
    gte: `${month}-01`,
    lt: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

/** True when yyyy-mm-dd names a real calendar date (no 2026-02-30). */
export function isRealDateKey(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** The stored content of a delivery; an old client's 납품종류 becomes its colour. */
function contentOf(dto: DeliveryContentDto) {
  return {
    company_name: dto.company_name,
    badge_color:
      dto.badge_color || DELIVERY_TYPE_COLORS[dto.delivery_type ?? ''] || '',
    memo: dto.memo,
  };
}

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  listForMonth(userId: number, month: string): Promise<DeliveryResponseDto[]> {
    return this.prisma.deliveryRecord.findMany({
      where: { userid: userId, delivery_date: monthRange(month) },
      orderBy: [{ delivery_date: 'asc' }, { delivery_number: 'asc' }],
      select: DELIVERY_RESPONSE_SELECT,
    });
  }

  create(userId: number, dto: CreateDeliveryDto): Promise<DeliveryResponseDto> {
    return this.prisma.deliveryRecord.create({
      data: {
        delivery_date: dto.delivery_date,
        ...contentOf(dto),
        userid: userId,
      },
      select: DELIVERY_RESPONSE_SELECT,
    });
  }

  /** Other users' records look the same as missing ones (404). */
  async update(
    userId: number,
    deliveryNumber: number,
    dto: CreateDeliveryDto,
  ): Promise<DeliveryResponseDto> {
    const { count } = await this.prisma.deliveryRecord.updateMany({
      where: { delivery_number: deliveryNumber, userid: userId },
      data: {
        delivery_date: dto.delivery_date,
        ...contentOf(dto),
      },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
    return this.prisma.deliveryRecord.findUniqueOrThrow({
      where: { delivery_number: deliveryNumber },
      select: DELIVERY_RESPONSE_SELECT,
    });
  }

  /**
   * Copies one delivery onto every date in `dto.delivery_dates`. Dates that
   * already hold the same delivery (납품처, 납품종류 and memo) are skipped, so
   * repeating twice does not double anything.
   */
  async repeat(
    userId: number,
    dto: RepeatDeliveryDto,
  ): Promise<RepeatDeliveryResponseDto> {
    const invalid = dto.delivery_dates.filter((date) => !isRealDateKey(date));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `존재하지 않는 날짜입니다: ${invalid.join(', ')}`,
      );
    }
    const content = {
      ...contentOf(dto),
    };
    const existing = await this.prisma.deliveryRecord.findMany({
      where: {
        userid: userId,
        delivery_date: { in: dto.delivery_dates },
        ...content,
      },
      select: { delivery_date: true },
    });
    const taken = new Set(existing.map((r) => r.delivery_date));
    const dates = [...dto.delivery_dates].sort();
    const { count } = await this.prisma.deliveryRecord.createMany({
      data: dates
        .filter((date) => !taken.has(date))
        .map((delivery_date) => ({
          ...content,
          delivery_date,
          userid: userId,
        })),
    });
    return {
      created: count,
      skipped_dates: dates.filter((date) => taken.has(date)),
    };
  }

  /**
   * The user's deliveries to the same 납품처 as `deliveryNumber` (every date),
   * the candidates for 선택수정. 404 when the record is not the user's.
   */
  async listSameCompany(
    userId: number,
    deliveryNumber: number,
  ): Promise<DeliveryResponseDto[]> {
    const source = await this.prisma.deliveryRecord.findFirst({
      where: { delivery_number: deliveryNumber, userid: userId },
      select: { company_name: true },
    });
    if (!source) throw new NotFoundException(NOT_FOUND);
    return this.prisma.deliveryRecord.findMany({
      where: { userid: userId, company_name: source.company_name },
      orderBy: [{ delivery_date: 'asc' }, { delivery_number: 'asc' }],
      select: DELIVERY_RESPONSE_SELECT,
    });
  }

  /** 선택수정: writes the same content to several of the user's deliveries. */
  async bulkUpdate(
    userId: number,
    dto: BulkUpdateDeliveryDto,
  ): Promise<BulkUpdateDeliveryResponseDto> {
    const { count } = await this.prisma.deliveryRecord.updateMany({
      where: { userid: userId, delivery_number: { in: dto.delivery_numbers } },
      data: {
        ...contentOf(dto),
      },
    });
    return { updated: count };
  }

  async remove(userId: number, deliveryNumber: number): Promise<void> {
    const { count } = await this.prisma.deliveryRecord.deleteMany({
      where: { delivery_number: deliveryNumber, userid: userId },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
  }
}
