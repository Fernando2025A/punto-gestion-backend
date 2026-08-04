export interface JwtPayload {
  id: string;
  username: string;
  email?: string | null;
  emailVerified?: boolean;
  provider?: string;
}
