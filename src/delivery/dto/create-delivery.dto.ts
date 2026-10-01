import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { IsCalendarDate } from '../../common/validators/is-calendar-date';

export const MAX_MEMO_LENGTH = 1000;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** 납품일 + 납품처 + optional memo. `userid` always comes from the JWT. */
export class CreateDeliveryDto {
  /** yyyy-mm-dd */
  @IsCalendarDate()
  delivery_date!: string;

  /** 납품처, e.g. "홈플러스" */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  company_name!: string;

  /** e.g. "1급진간장 1.8리터 10통"; may be empty or omitted */
  @Transform(({ value }: { value: unknown }) => trim({ value }) ?? '')
  @IsString()
  @MaxLength(MAX_MEMO_LENGTH)
  memo: string = '';
}
