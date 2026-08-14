import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from 'generated/prisma/enums';
import { PERMISSIONS_KEY } from '../decorators/permission.decorator';
import { BusinessAccessService } from 'src/business/business-access/business-access.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private businessAccess: BusinessAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si el endpoint no exige permisos específicos, permitir paso
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Inyectado por JwtAuthGuard

    // ✅ EXTRAER BUSINESS ID CON OPTIONAL CHAINING (Evita el 500 en GET)
    const rawBusinessId =
      request.query?.businessId ??
      request.params?.businessId ??
      request.body?.businessId;

    if (!rawBusinessId) {
      throw new BadRequestException('Se requiere especificar el businessId');
    }

    const businessId = Number(rawBusinessId);

    if (isNaN(businessId)) {
      throw new BadRequestException('El businessId debe ser un número válido');
    }

    // 1. Obtener acceso mediante el servicio centralizado
    const access = await this.businessAccess.getAccess(user.id, businessId);

    // 2. Si es el DUEÑO del negocio, tiene bypass total
    if (access.isOwner) {
      return true;
    }

    // 3. Verificar que tenga TODOS los permisos requeridos
    const hasPermission = requiredPermissions.every((perm) =>
      access.permissions.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'No tienes los permisos necesarios para realizar esta acción',
      );
    }

    return true;
  }
}
