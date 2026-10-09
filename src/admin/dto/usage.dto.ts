/** Deliveries recorded in a period, and how many users recorded them. */
export interface PeriodUsageDto {
  deliveries: number;
  activeUsers: number;
}

/** One account: a device (no name) or a member from before the app dropped login. */
export interface UserUsageDto {
  id: number;
  /** Empty for device accounts. */
  fullName: string;
  /** When the app was first opened (Korean time, "yyyy-mm-dd hh:mm"). */
  createdAt: string;
  today: number;
  week: number;
  month: number;
  total: number;
  /** Korean time, "yyyy-mm-dd hh:mm"; null when nothing was ever recorded. */
  lastRecordedAt: string | null;
}

export interface PeriodSummaryDto extends PeriodUsageDto {
  /** Accounts created (app first opened) in the period. */
  newUsers: number;
}

export interface UsageSummaryDto {
  /** Start of each period in Korean time, yyyy-mm-dd (weeks start on Monday). */
  periodStarts: { today: string; week: string; month: string };
  users: number;
  totalDeliveries: number;
  today: PeriodSummaryDto;
  week: PeriodSummaryDto;
  month: PeriodSummaryDto;
  accounts: UserUsageDto[];
}

export interface UsageSeriesPointDto extends PeriodUsageDto {
  /** Start of the period, yyyy-mm-dd in Korean time. */
  period: string;
}
