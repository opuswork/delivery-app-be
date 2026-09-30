import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { IsCalendarDate } from '../../common/validators/is-calendar-date';

export const MAX_MEMO_LENGTH = 1000;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** 납품일 + free-text memo. `userid` always comes from the JWT. */
export class CreateDeliveryDto {
  /** yyyy-mm-dd */
  @IsCalendarDate()
  delivery_date!: string;

  /** e.g. "홈플러스 1급진간장 1.8리터 10통" */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MEMO_LENGTH)
  memo!: string;
}
