import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth.types';
import { toUserResponse, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() auth: AuthUser): Promise<UserResponseDto> {
    const user = await this.usersService.findById(auth.id);
    // Token is valid but the account no longer exists.
    if (!user) throw new UnauthorizedException('인증이 필요합니다.');
    return toUserResponse(user);
  }
}
