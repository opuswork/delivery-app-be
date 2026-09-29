import type { User } from '../../generated/prisma/client.js';

/** Public user shape — never includes the password hash. */
export interface UserResponseDto {
  id: number;
  loginId: string;
  fullName: string;
  churchName: string;
}

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    loginId: user.loginId,
    fullName: user.fullName,
    churchName: user.churchName,
  };
}
