import type { User } from '../../generated/prisma/client.js';

/** Public user shape: never includes the password or device key hash. */
export interface UserResponseDto {
  id: number;
  /** Empty for device accounts. */
  fullName: string;
  createdAt: string;
}

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    fullName: user.fullName,
    createdAt: user.createdAt.toISOString(),
  };
}
