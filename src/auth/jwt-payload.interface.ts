export interface JwtPayload {
  sub: string;
  username: string | null;
  email?: string | null;
  emailVerified?: boolean;
  provider?: string;
  isTemporaly?: boolean;
  expiresAt?: Date | null;
}
