import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth.types';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryBatchDto } from './dto/create-delivery-batch.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import type { DeliveryResponseDto } from './dto/delivery-response.dto';
import { ListDeliveriesQuery } from './dto/list-deliveries.query';

@Controller('deliveries')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListDeliveriesQuery,
  ): Promise<DeliveryResponseDto[]> {
    return this.deliveryService.listForMonth(user.id, query.month);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDeliveryDto,
  ): Promise<DeliveryResponseDto> {
    return this.deliveryService.create(user.id, dto);
  }

  /** Several products for one 납품처 and 납품일 (one recording). */
  @Post('batch')
  createBatch(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDeliveryBatchDto,
  ): Promise<DeliveryResponseDto[]> {
    return this.deliveryService.createBatch(user.id, dto);
  }
}
