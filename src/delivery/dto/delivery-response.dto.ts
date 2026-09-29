export interface DeliveryResponseDto {
  delivery_number: number;
  company_name: string;
  product_name: string;
  product_quantity: string;
  delivery_date: string;
}

/** Prisma `select` matching DeliveryResponseDto (excludes userid / timestamps). */
export const DELIVERY_RESPONSE_SELECT = {
  delivery_number: true,
  company_name: true,
  product_name: true,
  product_quantity: true,
  delivery_date: true,
} as const;
