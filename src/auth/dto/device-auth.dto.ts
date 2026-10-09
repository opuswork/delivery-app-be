import { IsString, Matches } from 'class-validator';

export class DeviceAuthDto {
  /** Random key the app generates once and keeps on the device (base64url, 32+ bytes). */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43,128}$/, { message: 'deviceKey is invalid' })
  deviceKey!: string;
}
