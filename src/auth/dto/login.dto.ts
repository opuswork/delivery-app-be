import { IsString, Matches } from 'class-validator';

export class LoginDto {
  /** Middle 4 digits of the phone number. */
  @IsString()
  @Matches(/^\d{4}$/, { message: 'loginId must be exactly 4 digits' })
  loginId!: string;

  /** Last 8 digits of the phone number. */
  @IsString()
  @Matches(/^\d{8}$/, { message: 'password must be exactly 8 digits' })
  password!: string;
}
