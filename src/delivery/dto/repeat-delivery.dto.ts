import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  Matches,
} from 'class-validator';

import { DeliveryContentDto } from './create-delivery.dto';

/** At most about one year of dates per request. */
export const MAX_REPEAT_DATES = 366;

/** One delivery copied onto several dates (calendar "반복"). */
export class RepeatDeliveryDto extends DeliveryContentDto {
  /** yyyy-mm-dd each; whether each is a real calendar date is checked by the service. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REPEAT_DATES)
  @ArrayUnique()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    each: true,
    message: 'each delivery_dates entry must be in yyyy-mm-dd format',
  })
  delivery_dates!: string[];
}

export interface RepeatDeliveryResponseDto {
  /** Number of records created. */
  created: number;
  /** Dates skipped because the same delivery is already saved there. */
  skipped_dates: string[];
}
