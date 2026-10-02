import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { IsCalendarDate } from '../../common/validators/is-calendar-date';

export const MAX_MEMO_LENGTH = 1000;

/** 납품종류 values older clients may still send. */
export const DELIVERY_TYPES = ['런', '두부', '간장'] as const;

/** The colour each 납품종류 had, used when an older client sends no colour. */
export const DELIVERY_TYPE_COLORS: Record<string, string> = {
  런: '#1D84C4',
  두부: '#B41DC4',
  간장: '#413742',
};

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** 납품처 + badge colour + optional memo: everything except the date. */
export class DeliveryContentDto {
  /** 납품처, e.g. "홈플러스" */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  company_name!: string;

  /** 납품처 badge colour, #RRGGBB; empty or omitted for the default colour. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : (value ?? ''),
  )
  @Matches(/^(#[0-9A-F]{6})?$/, {
    message: 'badge_color must be a #RRGGBB colour',
  })
  badge_color: string = '';

  /** No longer used; accepted so clients from before badge_color keep working. */
  @IsOptional()
  @IsIn(['', ...DELIVERY_TYPES])
  delivery_type?: string;

  /** e.g. "1급진간장 1.8리터 10통"; may be empty or omitted */
  @Transform(({ value }: { value: unknown }) => trim({ value }) ?? '')
  @IsString()
  @MaxLength(MAX_MEMO_LENGTH)
  memo: string = '';
}

/** 납품일 + 납품처 + badge colour + optional memo. `userid` always comes from the JWT. */
export class CreateDeliveryDto extends DeliveryContentDto {
  /** yyyy-mm-dd */
  @IsCalendarDate()
  delivery_date!: string;
}
