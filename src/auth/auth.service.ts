import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto, EmailDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { JwtPayload } from './jwt-payload.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from 'src/mail/mail.service';
import * as crypto from 'crypto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SessionCodeDto } from './dto/session-code.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Crear el usuario
        const newUser = await tx.user.create({
          data: {
            username: dto.username.toLowerCase().trim(),
            email: dto.email,
            activeBusinessId: 1,
            password: hashedPassword,
            provider: 'LOCAL',
            emailVerified: false,
          },
          select: {
            id: true,
            username: true,
            email: true,
            emailVerified: true,
            activeBusinessId: true,
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

        await tx.user.update({
          where: { id: newUser.id },
          data: {
            activeBusinessId: defaultBusiness.id,
          },
        });

        const code = this.generate6DigitCode();
        await this.mailService.sendCode(dto.email, code);
        const hashedCode = this.hashCode(code);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await tx.verificationCode.create({
          data: {
            code: hashedCode,
            userId: newUser.id,
            expiresAt,
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

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private generate6DigitCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  async verifyUser(dto: EmailDto, code: string) {
    // 1. Validar que el usuario exista
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('Email no registrado');
    }

    if (user.emailVerified) {
      throw new BadRequestException('La cuenta ya se encuentra verificada');
    }

    // 2. Obtener el código más reciente emitido para este usuario
    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      throw new BadRequestException(
        'No se encontró un código de verificación activo',
      );
    }

    // 3. Validar si el código ha expirado
    if (verificationCode.expiresAt < new Date()) {
      throw new BadRequestException(
        'El código ha expirado. Solicita uno nuevo',
      );
    }

    // 4. Comparar el hash del código ingresado con el de la base de datos
    const hashedInputCode = this.hashCode(code);
    if (verificationCode.code !== hashedInputCode) {
      throw new BadRequestException('El código ingresado es incorrecto');
    }

    // 5. Marcar usuario como verificado y limpiar los códigos usados en una transacción
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
      this.prisma.verificationCode.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    if (user.email) {
      await this.mailService.sendEmail(user.email);
    }

    return {
      message: 'Cuenta verificada exitosamente',
    };
  }

  async sendCode(dto: EmailDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) throw new NotFoundException('Usuario no registrado');

    if (user.emailVerified)
      throw new BadRequestException('El usuario ya está verificado');
    const code = this.generate6DigitCode();
    await this.mailService.sendCode(dto.email, code);
    const hashedCode = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.verificationCode.create({
      data: {
        code: hashedCode,
        userId: user.id,
        expiresAt,
      },
    });
    return {
      message: 'Código enviado correctamente',
    };
  }

  async sendSessionCode(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) throw new NotFoundException('Usuario no registrado');

    const code = this.generate6DigitCode();
    const hashedCode = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.verificationCode.create({
      data: {
        code: hashedCode,
        userId: user.id,
        expiresAt,
      },
    });
    await this.mailService.sendSessionCode(email, code);
    return {
      message: 'Código de inicio de sesión enviado',
    };
  }

  async verifySessionCode(dto: SessionCodeDto) {
    // 1. Validar que el usuario exista
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('Email no registrado');
    }

    if (!user.emailVerified) {
      throw new BadRequestException('La cuenta no se encuentra verificada');
    }

    // 2. Obtener el código más reciente emitido para este usuario
    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      throw new BadRequestException(
        'No se encontró un código de verificación activo',
      );
    }

    // 3. Validar si el código ha expirado
    if (verificationCode.expiresAt < new Date()) {
      throw new BadRequestException(
        'El código ha expirado. Solicita uno nuevo',
      );
    }

    // 4. Comparar el hash del código ingresado con el de la base de datos
    const hashedInputCode = this.hashCode(dto.code);
    if (verificationCode.code !== hashedInputCode) {
      throw new BadRequestException('El código ingresado es incorrecto');
    }

    // 5. Marcar usuario como verificado y limpiar los códigos usados en una transacción
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
      this.prisma.verificationCode.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return {
      message: 'Cuenta verificada exitosamente',
    };
  }

  async validateUser(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier.toLowerCase() }, { email: identifier }],
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
      activeBusinessId: user.activeBusinessId,
      emailVerified: user.emailVerified,
      active2FA: user.active2FA,
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
    activeBusinessId: number;
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
        activeBusinessId: user.activeBusinessId,
        email: user.email,
        emailVerified: user.emailVerified,
        provider: user.provider,
        isTemporaly: user.isTemporaly,
        expiresAt: user.expiresAt,
      },
      businesses: userBusinesses,
    };
  }

  async update(userId: string, dto: UpdateUserDto) {
    return await this.prisma.$transaction(async (tx) => {
      return await tx.user.update({
        where: { id: userId },
        data: {
          ...dto,
        },
      });
    });
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
            activeBusinessId: 1,
            email: profile.email,
            provider: 'GOOGLE',
            emailVerified: true,
          },
        });

        const business = await tx.business.create({
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

        await tx.user.update({
          where: { id: newUser.id },
          data: {
            activeBusinessId: business.id,
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
      activeBusinessId: user.activeBusinessId,
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
            activeBusinessId: 1,
            emailVerified: true,
            password: hashedPassword,
            isTemporaly: true,
            active2FA: false,
            expiresAt,
          },
        });

        const business = await tx.business.create({
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

        await tx.user.update({
          where: { id: user.id },
          data: {
            activeBusinessId: business.id,
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
        phoneNumber: true,
        imageUrl: true,
        emailVerified: true,
        active2FA: true,
        provider: true,
        activeBusinessId: true,
        ownedBusinesses: {
          select: {
            businessUsage: true,
            description: true,
            name: true,
            imageUrl: true,
            plan: {
              include: {
                limits: true,
              },
            },
          },
        },
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

  // 1. Solicitud de código
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Siempre retornar la misma respuesta por seguridad
    if (!user)
      return { message: 'Si el correo existe, hemos enviado instrucciones.' };

    const code = this.generate6DigitCode();
    const hashedToken = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Limpiar tokens anteriores y guardar el nuevo
    await this.prisma.$transaction([
      this.prisma.userToken.deleteMany({
        where: { userId: user.id, type: 'PASSWORD_RESET' },
      }),
      this.prisma.userToken.create({
        data: {
          token: hashedToken,
          type: 'PASSWORD_RESET',
          userId: user.id,
          expiresAt,
        },
      }),
    ]);

    if (!user.email) throw new BadRequestException('Email inexistente');
    await this.mailService.sendPasswordResetCode(user.email, code);
    return { message: 'Si el correo existe, hemos enviado instrucciones.' };
  }

  // 2. Aplicar nueva contraseña
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new BadRequestException('Código inválido o expirado.');

    const tokenRecord = await this.prisma.userToken.findFirst({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        expiresAt: { gt: new Date() },
      },
    });

    if (!tokenRecord || tokenRecord.token !== this.hashCode(dto.code)) {
      throw new BadRequestException('Código inválido o expirado.');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Actualizar contraseña, limpiar tokens de reset y cerrar sesiones activas
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      this.prisma.userToken.deleteMany({
        where: {
          userId: user.id,
          type: { in: ['PASSWORD_RESET', 'REFRESH_TOKEN'] },
        },
      }),
    ]);

    return {
      message: 'Contraseña actualizada exitosamente. Por favor, inicia sesión.',
    };
  }
}
