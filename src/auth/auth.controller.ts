import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthService, LoginResult } from './auth.service';
import { LoginDto } from './dto/login.dto';

/** An 8-digit numeric password is a small keyspace; limit guessing per client. */
const LOGIN_RATE_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle(LOGIN_RATE_LIMIT)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }
}
