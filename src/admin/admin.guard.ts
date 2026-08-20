import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_ADMIN_KEY } from './is-admin.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresAdmin = this.reflector.getAllAndOverride<boolean>(
      IS_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si la ruta no tiene el decorador @IsAdmin(), permite el paso
    if (!requiresAdmin) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.email) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    // Lee la variable del .env y la convierte en un arreglo
    const rawAdminEmails = this.configService.get<string>('ADMIN_EMAILS') || '';
    const allowedEmails = rawAdminEmails
      .split(',')
      .map((email) => email.trim());

    const hasAccess = allowedEmails.includes(user.email);

    if (!hasAccess) {
      throw new ForbiddenException(
        'Acceso denegado: Tu cuenta no tiene permisos administrativos',
      );
    }

    return true;
  }
}
