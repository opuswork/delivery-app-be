import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { IsCalendarDate } from '../../common/validators/is-calendar-date';

export const MAX_BATCH_ITEMS = 10;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class DeliveryItemDto {
  /** 상품명 */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  product_name!: string;

  /** 수량, e.g. "4통" */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  product_quantity!: string;
}

/**
 * One recording with several products for the same 납품처 and 납품일.
 * Each item becomes its own DeliveryRecord row.
 */
export class CreateDeliveryBatchDto {
  /** 납품처 */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  company_name!: string;

  /** yyyy-mm-dd */
  @IsCalendarDate()
  delivery_date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemDto)
  items!: DeliveryItemDto[];
}
