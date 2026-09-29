import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type ExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

@Module({
  imports: [
    UsersModule,
    // Global so JwtAuthGuard can verify tokens in any feature module.
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          // Validated at boot (env.validation.ts); a vercel/ms string such as "12h".
          expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN') as ExpiresIn,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
