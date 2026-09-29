import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryBatchDto } from './dto/create-delivery-batch.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import {
  DELIVERY_RESPONSE_SELECT,
  DeliveryResponseDto,
} from './dto/delivery-response.dto';

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
        company_name: dto.company_name,
        product_name: dto.product_name,
        product_quantity: dto.product_quantity,
        delivery_date: dto.delivery_date,
        userid: userId,
      },
      select: DELIVERY_RESPONSE_SELECT,
    });
  }

  /** Saves every item as its own record, all-or-nothing. */
  createBatch(
    userId: number,
    dto: CreateDeliveryBatchDto,
  ): Promise<DeliveryResponseDto[]> {
    return this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.deliveryRecord.create({
          data: {
            company_name: dto.company_name,
            product_name: item.product_name,
            product_quantity: item.product_quantity,
            delivery_date: dto.delivery_date,
            userid: userId,
          },
          select: DELIVERY_RESPONSE_SELECT,
        }),
      ),
    );
  }
}
