import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4100;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '12h';

  /** Comma-separated list of allowed browser origins. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string = 'http://localhost:3100';

  /**
   * bcrypt hash of the dashboard password for the "admin" login
   * (`npm run admin:hash`). Unset or empty: admin login is disabled.
   */
  @ValidateIf((env: EnvironmentVariables) => Boolean(env.ADMIN_PASSWORD_HASH))
  @Matches(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/, {
    message: 'ADMIN_PASSWORD_HASH must be a bcrypt hash (npm run admin:hash)',
  })
  ADMIN_PASSWORD_HASH?: string;
}

export type AppEnv = EnvironmentVariables;

/** Fails fast at boot when required configuration is missing or invalid. */
export function validateEnv(config: Record<string, unknown>): AppEnv {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return validated;
}
