export interface DeliveryResponseDto {
  delivery_number: number;
  delivery_date: string;
  company_name: string;
  /** 런 | 두부 | 간장, or empty for records saved before it existed */
  delivery_type: string;
  memo: string;
}

/** Prisma `select` matching DeliveryResponseDto (excludes userid / timestamps). */
export const DELIVERY_RESPONSE_SELECT = {
  delivery_number: true,
  delivery_date: true,
  company_name: true,
  delivery_type: true,
  memo: true,
} as const;
