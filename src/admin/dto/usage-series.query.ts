import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const USAGE_UNITS = ['day', 'week', 'month'] as const;
export type UsageUnit = (typeof USAGE_UNITS)[number];

export class UsageSeriesQuery {
  @IsIn(USAGE_UNITS)
  unit!: UsageUnit;

  /** One account's usage; omitted for everyone. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}
