import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Permission } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';

export interface BusinessAccessResult {
  isOwner: boolean;
  role?: string;
  permissions: Permission[];
}

@Injectable()
export class BusinessAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determina el acceso de un usuario a un negocio.
   * Usado principalmente por el PermissionsGuard.
   */
  async getAccess(
    userId: string,
    businessId: number,
  ): Promise<BusinessAccessResult> {
    // 1. Obtener el negocio para verificar el propietario
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });

    if (!business) {
      throw new NotFoundException('El negocio especificado no existe');
    }

    // 2. Si el usuario es el dueño directo, se otorga bypass total
    if (business.ownerId === userId) {
      return {
        isOwner: true,
        permissions: Object.values(Permission), // Posee todos los permisos
      };
    }

    // 3. Si no es el dueño, verificar membresía activa en BusinessEmployee
    const membership = await this.prisma.businessEmployee.findUnique({
      where: {
        userId_businessId: { userId, businessId },
      },
      select: {
        isActive: true,
        role: true,
        permissions: true,
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException(
        'No tienes acceso a este negocio o tu cuenta ha sido desactivada',
      );
    }

    return {
      isOwner: false,
      role: membership.role,
      permissions: membership.permissions,
    };
  }

  /**
   * Obtiene (o crea si no existe) el inventario de un negocio,
   * asegurando primero que el usuario tenga acceso como dueño o empleado activo.
   */
  async getInventory(businessId: number, userId: string) {
    // 1. Validar acceso general (Lanza ForbiddenException si no aplica)
    await this.getAccess(userId, businessId);

    // 2. Buscar o crear el inventario del negocio
    return this.prisma.inventory.upsert({
      where: { businessId },
      update: {},
      create: { businessId },
      select: { id: true, businessId: true },
    });
  }
}
