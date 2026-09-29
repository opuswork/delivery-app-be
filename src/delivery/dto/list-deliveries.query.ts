import { Matches } from 'class-validator';

export class ListDeliveriesQuery {
  /** yyyy-mm */
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in yyyy-mm format',
  })
  month!: string;
}
