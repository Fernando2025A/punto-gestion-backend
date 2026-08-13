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
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoggerDto } from './dto/logger.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getAuthCookieName() {
    return process.env.AUTH_COOKIE_NAME ?? 'access_token';
  }

  private getRefreshCookieName() {
    return process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';
  }

  @Public()
  @Post('register')
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Public()
  @Post('login')
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

    const token = await this.authService.login(user);
    res.cookie(this.getAuthCookieName(), token.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 15,
    });
    res.cookie(this.getRefreshCookieName(), token.refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
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
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return;
  }

  @Public()
  @Get('google/callback')
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
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 15,
    });
    res.cookie(this.getRefreshCookieName(), authResult.refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge:
        1000 *
        60 *
        60 *
        24 *
        Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7),
    });

    return {
      message: 'Inicio de sesión con Google correcto',
      access_token: authResult.access_token,
      refresh_token: authResult.refresh_token,
      user: authResult.user,
    };
  }

  @Public()
  @Post('refresh')
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
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 15,
    });

    return { access_token: token.access_token };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[this.getRefreshCookieName()] as string;

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    res.clearCookie(this.getAuthCookieName());
    res.clearCookie(this.getRefreshCookieName());
    return { message: 'Sesión cerrada' };
  }

  @Public()
  @Post('demo')
  async createDemoUser() {
    return this.authService.createDemoUser();
  }
  @Get('me')
  me(@CurrentUser('id') id: string) {
    return this.authService.getMe(id);
  }
}
