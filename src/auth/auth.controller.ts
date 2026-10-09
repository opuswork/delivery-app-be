import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthService, TokenResult } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { DeviceAuthDto } from './dto/device-auth.dto';

/** Limits password guessing on the admin login. */
const ADMIN_LOGIN_RATE_LIMIT = { default: { limit: 5, ttl: 60_000 } };
/** Each new device key creates an account; limit how fast one client can do that. */
const DEVICE_RATE_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('device')
  @HttpCode(200)
  @Throttle(DEVICE_RATE_LIMIT)
  device(@Body() dto: DeviceAuthDto): Promise<TokenResult> {
    return this.authService.authenticateDevice(dto);
  }

  @Post('admin/login')
  @HttpCode(200)
  @Throttle(ADMIN_LOGIN_RATE_LIMIT)
  adminLogin(@Body() dto: AdminLoginDto): Promise<TokenResult> {
    return this.authService.adminLogin(dto);
  }
}
