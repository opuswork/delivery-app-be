export interface DeliveryResponseDto {
  delivery_number: number;
  delivery_date: string;
  memo: string;
}

/** Prisma `select` matching DeliveryResponseDto (excludes userid / timestamps). */
export const DELIVERY_RESPONSE_SELECT = {
  delivery_number: true,
  delivery_date: true,
  memo: true,
} as const;
