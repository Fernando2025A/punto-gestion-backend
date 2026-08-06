import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
      },
    });

    if (existingUser?.username === dto.username) {
      throw new ConflictException('El nombre de usuario ya está registrado');
    }

    if (existingUser?.email === dto.email) {
      throw new ConflictException('El correo ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const newUser = await this.prisma.user.create({
      data: {
        password: hashedPassword,
        username: dto.username,
        email: dto.email,
        provider: 'LOCAL',
        emailVerified: false,
      },
    });

    return {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      emailVerified: newUser.emailVerified,
      provider: newUser.provider,
    };
  }

  async validateUser(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    });

    if (!user) {
      return null;
    }

    if (!user.password) {
      throw new BadRequestException(
        'El usuario no tiene contraseña establecida',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      provider: user.provider,
    };
  }

  async googleLogin(input: { accessToken: string }) {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Token de Google inválido');
    }

    const profile = (await response.json()) as {
      email?: string;
      name?: string;
    };

    if (!profile.email) {
      throw new BadRequestException('No se pudo obtener el email desde Google');
    }

    return this.upsertGoogleUser({
      email: profile.email,
      name: profile.name,
    });
  }

  async googleCallback(input: { code: string; redirectUri: string }) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: input.code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: input.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException(
        'No se pudo intercambiar el código de Google',
      );
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new UnauthorizedException('Google no devolvió un access token');
    }

    return this.googleLogin({ accessToken: tokenData.access_token });
  }

  async login(user: {
    id: string;
    username: string | null;
    email: string | null;
    emailVerified: boolean;
    provider: string;
    isTemporaly?: boolean;
    expiresAt?: Date | null;
  }) {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      provider: user.provider,
      isTemporaly: user.isTemporaly,
      expiresAt: user.expiresAt,
    };
    const accessToken = this.jwtService.sign(
      payload as never,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      } as never,
    );

    const refreshTokenValue = randomBytes(32).toString('hex');
    const refreshExpiresIn = Number(
      process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '7',
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiresIn);

    await this.prisma.userToken.deleteMany({
      where: { userId: user.id, type: 'REFRESH_TOKEN' },
    });

    await this.prisma.userToken.create({
      data: {
        token: refreshTokenValue,
        type: 'REFRESH_TOKEN',
        userId: user.id,
        expiresAt,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshTokenValue,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        provider: user.provider,
        isTemporaly: user.isTemporaly,
        expiresAt: user.expiresAt,
      },
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const storedToken = await this.prisma.userToken.findFirst({
      where: { token: refreshToken, type: 'REFRESH_TOKEN' },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.userToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedException('Refresh token expirado');
    }

    const payload = {
      sub: storedToken.user.id,
      username: storedToken.user.username,
      email: storedToken.user.email,
      emailVerified: storedToken.user.emailVerified,
      provider: storedToken.user.provider,
    };
    const accessToken = this.jwtService.sign(
      payload as never,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      } as never,
    );

    return { access_token: accessToken };
  }

  async revokeRefreshToken(refreshToken: string) {
    const storedToken = await this.prisma.userToken.findFirst({
      where: { token: refreshToken, type: 'REFRESH_TOKEN' },
    });

    if (storedToken) {
      await this.prisma.userToken.delete({ where: { id: storedToken.id } });
    }
  }

  validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }

  private async upsertGoogleUser(profile: { email: string; name?: string }) {
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      const baseUsername = this.buildUsername(profile.name ?? profile.email);
      const username = await this.ensureUniqueUsername(baseUsername);
      user = await this.prisma.user.create({
        data: {
          username,
          email: profile.email,
          provider: 'GOOGLE',
          emailVerified: true,
        },
      });
    }

    return this.login({
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      provider: user.provider,
    });
  }

  private buildUsername(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 20);
  }

  private async ensureUniqueUsername(baseUsername: string) {
    const sanitized = baseUsername || 'user';
    const existing = await this.prisma.user.findUnique({
      where: { username: sanitized },
    });

    if (!existing) {
      return sanitized;
    }

    let suffix = 1;
    let candidate = `${sanitized}${suffix}`;
    while (
      await this.prisma.user.findUnique({ where: { username: candidate } })
    ) {
      suffix += 1;
      candidate = `${sanitized}${suffix}`;
    }

    return candidate;
  }

  async createDemoUser() {
    const userData = {
      username: `user${Math.floor(Math.random() * 100000)}`,
      email: `user${Math.floor(Math.random() * 100000)}@demo.com`,
      password: Math.floor(Math.random() * 1000000).toString(), // Generate a random 6-digit password
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expira en 24 horas
    };

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const newUser = await this.prisma.user.create({
      data: {
        username: userData.username,
        password: hashedPassword,
        email: userData.email,
        isTemporaly: true,
        expiresAt: userData.expiresAt,
      },
    });

    await this.prisma.inventory.create({
      data: {
        userId: newUser.id,
      },
    });

    return {
      username: newUser.username,
      password: userData.password,
    };
  }
}
