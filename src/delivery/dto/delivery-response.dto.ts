export interface DeliveryResponseDto {
  delivery_number: number;
  delivery_date: string;
  company_name: string;
  memo: string;
}

/** Prisma `select` matching DeliveryResponseDto (excludes userid / timestamps). */
export const DELIVERY_RESPONSE_SELECT = {
  delivery_number: true,
  delivery_date: true,
  company_name: true,
  memo: true,
} as const;
