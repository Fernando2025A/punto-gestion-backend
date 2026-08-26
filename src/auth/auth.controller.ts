import {
  Body,
  Controller,
  Post,
  Res,
  UnauthorizedException,
  Get,
  Req,
  BadRequestException,
  UseGuards,
  Patch,
  UploadedFile,
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateUserDto, EmailDto } from './dto/create-user.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoggerDto } from './dto/logger.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdateUserDto } from './dto/update-user.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { SessionCodeDto } from './dto/session-code.dto';
import { PrismaService } from 'src/prisma/prisma.service';

const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions: any = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax', // 'none' permite enviar cookies entre distintos dominios
  secure: isProduction, // OBLIGATORIO (true) cuando sameSite es 'none'
};

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getAuthCookieName() {
    return process.env.AUTH_COOKIE_NAME ?? 'access_token';
  }

  private getRefreshCookieName() {
    return process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @ApiResponse({
    status: 201,
    description: 'Usuario y negocio creados exitosamente.',
  })
  @ApiResponse({
    status: 409,
    description: 'El nombre de usuario o email ya existe.',
  })
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión con credenciales (Usuario/Email y Contraseña)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesión iniciada correctamente o requiere 2FA.',
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas.' })
  @ApiResponse({
    status: 400,
    description: 'Cuenta no verificada o datos inválidos.',
  })
  async login(
    @Body() dto: LoggerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identifier = dto.identifier ?? dto.username;
    if (!identifier)
      throw new BadRequestException('No se reconoció el identificador');
    const user = await this.authService.validateUser(identifier, dto.password);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.emailVerified)
      throw new BadRequestException('Correo electrónico no verificado');

    if (!user.email)
      throw new BadRequestException('No se ha podido obtener el email');
    if (user.active2FA) {
      return await this.authService.sendSessionCode(user.email);
    }
    const token = await this.authService.login(user);
    res.cookie(this.getAuthCookieName(), token.access_token, {
      ...cookieOptions,
      maxAge: 1000 * 60 * 15,
    });
    res.cookie(this.getRefreshCookieName(), token.refresh_token, {
      ...cookieOptions,
      maxAge:
        1000 *
        60 *
        60 *
        24 *
        Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7),
    });

    return {
      message: 'Inicio de sesión correcto',
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      user: token.user,
    };
  }

  @Public()
  @Post('verify-2fa')
  @ApiOperation({
    summary: 'Verificar código 2FA para completar el inicio de sesión',
  })
  @ApiResponse({
    status: 200,
    description: 'Código verificado y sesión iniciada.',
  })
  @ApiResponse({ status: 400, description: 'Código inválido o expirado.' })
  async verify2Fa(
    @Body() dto: SessionCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.verifySessionCode(dto);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) return;
    const token = await this.authService.login({
      id: user.id,
      username: user?.username ?? null,
      email: user?.email ?? null,
      emailVerified: true,
      activeBusinessId: user?.activeBusinessId ?? 1,
      provider: user.provider,
      isTemporaly: user.isTemporaly,
      expiresAt: user.expiresAt,
    });
    res.cookie(this.getAuthCookieName(), token.access_token, {
      ...cookieOptions,
      maxAge: 1000 * 60 * 15,
    });
    res.cookie(this.getRefreshCookieName(), token.refresh_token, {
      ...cookieOptions,
      maxAge:
        1000 *
        60 *
        60 *
        24 *
        Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7),
    });

    return {
      message: 'Inicio de sesión correcto',
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      user: token.user,
    };
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Redirigir a la autenticación OAuth2 de Google' })
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return;
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Callback de respuesta enviado por Google OAuth' })
  @UseGuards(AuthGuard('google'))
  googleCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authResult = req.user as
      | {
          access_token: string;
          refresh_token: string;
          user: {
            id: string;
            username: string | null;
            email: string | null;
            emailVerified: boolean;
            provider: string;
          };
        }
      | undefined;

    if (!authResult) {
      throw new UnauthorizedException('No se pudo autenticar con Google');
    }

    res.cookie(this.getAuthCookieName(), authResult.access_token, {
      ...cookieOptions,
      maxAge: 1000 * 60 * 15,
    });
    res.cookie(this.getRefreshCookieName(), authResult.refresh_token, {
      ...cookieOptions,
      maxAge:
        1000 *
        60 *
        60 *
        24 *
        Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7),
    });

    const redirectUrl =
      this.configService.get<string>('GOOGLE_REDIRECT_URL') ||
      'http://localhost:5173/home';

    res.redirect(redirectUrl);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary:
      'Renovar el Access Token mediante el Refresh Token guardado en Cookies',
  })
  @ApiResponse({
    status: 200,
    description: 'Nuevo access token generado exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token ausente, expirado o inválido.',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[this.getRefreshCookieName()] as string;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no presente');
    }

    const token = await this.authService.refreshAccessToken(refreshToken);
    res.cookie(this.getAuthCookieName(), token.access_token, {
      ...cookieOptions,
      maxAge: 1000 * 60 * 15,
    });

    return { access_token: token.access_token };
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión actual y revocar tokens' })
  @ApiResponse({
    status: 200,
    description: 'Sesión cerrada y cookies eliminadas.',
  })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[this.getRefreshCookieName()] as string;

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    res.clearCookie(this.getAuthCookieName(), cookieOptions);
    res.clearCookie(this.getRefreshCookieName(), cookieOptions);
    return { message: 'Sesión cerrada' };
  }

  @Patch()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar perfil del usuario y/o imagen de avatar',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Campos opcionales a actualizar e imagen de avatar',
    schema: {
      type: 'object',
      properties: {
        avatar: { type: 'string', format: 'binary' },
        phoneNumber: { type: 'string' },
        username: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil de usuario actualizado exitosamente.',
  })
  @UseInterceptors(FileInterceptor('avatar'))
  async update(
    @CurrentUser('id') id: string,
    @Body() dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl: string | null = null;

    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file);
      imageUrl = uploadResult.secure_url;
      dto.imageUrl = imageUrl ?? undefined;
    }
    return this.authService.update(id, dto);
  }

  @Throttle({ default: { limit: 1, ttl: 86400000 } })
  @Public()
  @Post('demo')
  @ApiOperation({
    summary: 'Generar una cuenta de prueba temporal (Demo 24hs)',
  })
  @ApiResponse({
    status: 201,
    description: 'Credenciales del usuario demo generadas.',
  })
  async createDemoUser() {
    return this.authService.createDemoUser();
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener datos del perfil y negocios del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del perfil devuelta exitosamente.',
  })
  me(@CurrentUser('id') id: string) {
    return this.authService.getMe(id);
  }

  @Public()
  @Post('verify-email/:code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Verificar cuenta de correo electrónico mediante código de 6 dígitos',
  })
  @ApiParam({
    name: 'code',
    description: 'Código de 6 dígitos enviado por email',
  })
  @ApiResponse({ status: 200, description: 'Cuenta verificada exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'Código inválido, expirado o cuenta ya verificada.',
  })
  verifyEmail(@Body() dto: EmailDto, @Param('code') code: string) {
    return this.authService.verifyUser(dto, code);
  }

  @Public()
  @Post('send-code')
  @ApiOperation({
    summary: 'Reenviar código de verificación de correo electrónico',
  })
  @ApiResponse({
    status: 200,
    description: 'Código de verificación reenviado.',
  })
  sendCode(@Body() dto: EmailDto) {
    return this.authService.sendCode(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar código para restablecimiento de contraseña',
  })
  @ApiResponse({
    status: 200,
    description: 'Instrucciones enviadas si el correo existe.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambiar la contraseña utilizando el código recibido por email',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña restablecida exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'Código o email inválido/expirado.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
