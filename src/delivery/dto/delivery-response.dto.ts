export interface DeliveryResponseDto {
  delivery_number: number;
  delivery_date: string;
  company_name: string;
  /** #RRGGBB, or empty for the default colour */
  badge_color: string;
  memo: string;
}

/** Prisma `select` matching DeliveryResponseDto (excludes userid / timestamps). */
export const DELIVERY_RESPONSE_SELECT = {
  delivery_number: true,
  delivery_date: true,
  company_name: true,
  badge_color: true,
  memo: true,
} as const;
