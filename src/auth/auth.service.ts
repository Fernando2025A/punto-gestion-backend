import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Crear el usuario
        const newUser = await tx.user.create({
          data: {
            username: dto.username,
            email: dto.email,
            password: hashedPassword,
            provider: 'LOCAL',
            emailVerified: false,
          },
          select: {
            id: true,
            username: true,
            email: true,
            emailVerified: true,
            provider: true,
            createdAt: true,
          },
        });

        // 2. Crear su negocio por defecto + Inventario + Registro en BusinessEmployee (OWNER)
        const defaultBusiness = await tx.business.create({
          data: {
            name: `Negocio de ${newUser.username}`,
            ownerId: newUser.id,
            inventory: { create: {} },
            employees: {
              create: {
                userId: newUser.id,
                role: 'OWNER',
                isActive: true,
              },
            },
          },
          select: {
            id: true,
            name: true,
            inventory: { select: { id: true } },
          },
        });

        return {
          user: newUser,
          defaultBusiness: {
            id: defaultBusiness.id,
            name: defaultBusiness.name,
            inventoryId: defaultBusiness.inventory?.id,
          },
        };
      });
    } catch (error: unknown) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes('username')) {
          throw new ConflictException(
            'El nombre de usuario ya está registrado',
          );
        }
        if (target?.includes('email')) {
          throw new ConflictException(
            'El correo electrónico ya está registrado',
          );
        }
        throw new ConflictException('El usuario o email ya existe');
      }
      throw error;
    }
  }

  async validateUser(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    });

    if (!user) return null;

    if (!user.password) {
      throw new BadRequestException(
        'El usuario no tiene contraseña establecida (ingresó mediante Google)',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

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
        headers: { Authorization: `Bearer ${input.accessToken}` },
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    // Consultamos los negocios en los que participa el usuario para adjuntarlos en la respuesta
    const employeeRecords = await this.prisma.businessEmployee.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        role: true,
        business: {
          select: {
            id: true,
            name: true,
            inventory: { select: { id: true } },
          },
        },
      },
    });

    const userBusinesses = employeeRecords.map((emp) => ({
      id: emp.business.id,
      name: emp.business.name,
      role: emp.role,
      inventoryId: emp.business.inventory?.id,
    }));

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      provider: user.provider,
      isTemporaly: user.isTemporaly,
      expiresAt: user.expiresAt,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    } as JwtSignOptions);

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
      businesses: userBusinesses, // 👈 Ahora el frontend sabe a qué negocios tiene acceso el usuario
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

    const payload: JwtPayload = {
      sub: storedToken.user.id,
      username: storedToken.user.username,
      email: storedToken.user.email,
      emailVerified: storedToken.user.emailVerified,
      provider: storedToken.user.provider,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    } as JwtSignOptions);

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
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }

  private async upsertGoogleUser(profile: { email: string; name?: string }) {
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    // Si es un usuario nuevo registrándose con Google, creamos User + Business + Inventory
    if (!user) {
      const baseUsername = this.buildUsername(profile.name ?? profile.email);
      const username = await this.ensureUniqueUsername(baseUsername);

      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            username,
            email: profile.email,
            provider: 'GOOGLE',
            emailVerified: true,
          },
        });

        await tx.business.create({
          data: {
            name: `Negocio de ${newUser.username}`,
            ownerId: newUser.id,
            inventory: { create: {} },
            employees: {
              create: {
                userId: newUser.id,
                role: 'OWNER',
                isActive: true,
              },
            },
          },
        });

        return newUser;
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

    if (!existing) return sanitized;

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
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const plainPassword = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const username = `demo_${randomSuffix}`;
    const email = `demo_${randomSuffix}@demo.com`;
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    try {
      // Solución limpia de creación atómica sin reconexiones fallidas
      const newUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            email,
            password: hashedPassword,
            isTemporaly: true,
            expiresAt,
          },
        });

        await tx.business.create({
          data: {
            name: `Negocio Demo (${user.username})`,
            ownerId: user.id,
            inventory: { create: {} },
            employees: {
              create: {
                userId: user.id,
                role: 'OWNER',
                isActive: true,
              },
            },
          },
        });

        return user;
      });

      return {
        username: newUser.username,
        password: plainPassword,
        expiresAt: newUser.expiresAt,
      };
    } catch {
      throw new InternalServerErrorException(
        'Error al crear el usuario de prueba',
      );
    }
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        provider: true,
        ownedBusinesses: true,
        employments: {
          where: { isActive: true },
          select: {
            role: true,
            business: {
              select: {
                id: true,
                name: true,
                inventory: { select: { id: true } },
              },
            },
          },
        },
      },
    });
  }
}
