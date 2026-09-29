import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { IsCalendarDate } from '../../common/validators/is-calendar-date';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Field names follow the business contract (guideline.md). `userid` always comes from the JWT. */
export class CreateDeliveryDto {
  /** 납품처 */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  company_name!: string;

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

  /** yyyy-mm-dd */
  @IsCalendarDate()
  delivery_date!: string;
}
