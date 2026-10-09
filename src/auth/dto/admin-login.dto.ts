import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @MaxLength(20)
  loginId!: string;

  /** bcrypt only reads the first 72 bytes. */
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
