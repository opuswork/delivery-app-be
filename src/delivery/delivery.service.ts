import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import {
  DELIVERY_RESPONSE_SELECT,
  DeliveryResponseDto,
} from './dto/delivery-response.dto';

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
        company_name: dto.company_name,
        memo: dto.memo,
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
        company_name: dto.company_name,
        memo: dto.memo,
      },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
    return this.prisma.deliveryRecord.findUniqueOrThrow({
      where: { delivery_number: deliveryNumber },
      select: DELIVERY_RESPONSE_SELECT,
    });
  }

  async remove(userId: number, deliveryNumber: number): Promise<void> {
    const { count } = await this.prisma.deliveryRecord.deleteMany({
      where: { delivery_number: deliveryNumber, userid: userId },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);
  }
}
