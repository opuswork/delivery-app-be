import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth.types';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { DeliveryNumberParam } from './dto/delivery-number.param';
import type { DeliveryResponseDto } from './dto/delivery-response.dto';
import { ListDeliveriesQuery } from './dto/list-deliveries.query';
import {
  RepeatDeliveryDto,
  type RepeatDeliveryResponseDto,
} from './dto/repeat-delivery.dto';

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

  /** Copies one delivery onto several dates. Declared before `:id` routes. */
  @Post('repeat')
  repeat(
    @CurrentUser() user: AuthUser,
    @Body() dto: RepeatDeliveryDto,
  ): Promise<RepeatDeliveryResponseDto> {
    return this.deliveryService.repeat(user.id, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param() { id }: DeliveryNumberParam,
    @Body() dto: CreateDeliveryDto,
  ): Promise<DeliveryResponseDto> {
    return this.deliveryService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param() { id }: DeliveryNumberParam,
  ): Promise<void> {
    return this.deliveryService.remove(user.id, id);
  }
}
