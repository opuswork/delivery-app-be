import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { IsCalendarDate } from '../../common/validators/is-calendar-date';
import { DeliveryItemDto, MAX_BATCH_ITEMS } from './create-delivery-batch.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class DeliveryGroupItemDto extends DeliveryItemDto {
  /** Existing row to update; omitted for a newly added product. */
  @IsOptional()
  @IsInt()
  @Min(1)
  delivery_number?: number;
}

/**
 * Replaces one company block (same 납품처 and 납품일) in a single step:
 * listed rows are updated, new items created, omitted rows deleted.
 * An empty `items` list deletes the whole block.
 */
export class UpdateDeliveryGroupDto {
  /** The rows the block consisted of when it was opened for editing. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  delivery_numbers!: number[];

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  company_name!: string;

  @IsCalendarDate()
  delivery_date!: string;

  @IsArray()
  @ArrayMaxSize(MAX_BATCH_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => DeliveryGroupItemDto)
  items!: DeliveryGroupItemDto[];
}
