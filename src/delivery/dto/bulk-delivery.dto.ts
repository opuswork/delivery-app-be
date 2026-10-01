import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

import { DeliveryContentDto } from './create-delivery.dto';

/** At most about one year of daily deliveries per request. */
export const MAX_BULK_DELIVERIES = 366;

/** 선택수정: the same 납품처 / 납품종류 / 메모 written to several saved deliveries. */
export class BulkUpdateDeliveryDto extends DeliveryContentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_DELIVERIES)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  delivery_numbers!: number[];
}

export interface BulkUpdateDeliveryResponseDto {
  /** Number of records changed (other users' numbers are ignored). */
  updated: number;
}
