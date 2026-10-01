import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { IsCalendarDate } from '../../common/validators/is-calendar-date';

export const MAX_MEMO_LENGTH = 1000;

/** 납품종류 choices, in dropdown order. */
export const DELIVERY_TYPES = ['런', '두부', '간장'] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** 납품처 + 납품종류 + optional memo: everything except the date. */
export class DeliveryContentDto {
  /** 납품처, e.g. "홈플러스" */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  company_name!: string;

  /** 납품종류 */
  @IsIn(DELIVERY_TYPES, {
    message: `delivery_type must be one of ${DELIVERY_TYPES.join(', ')}`,
  })
  delivery_type!: DeliveryType;

  /** e.g. "1급진간장 1.8리터 10통"; may be empty or omitted */
  @Transform(({ value }: { value: unknown }) => trim({ value }) ?? '')
  @IsString()
  @MaxLength(MAX_MEMO_LENGTH)
  memo: string = '';
}

/** 납품일 + 납품처 + 납품종류 + optional memo. `userid` always comes from the JWT. */
export class CreateDeliveryDto extends DeliveryContentDto {
  /** yyyy-mm-dd */
  @IsCalendarDate()
  delivery_date!: string;
}
