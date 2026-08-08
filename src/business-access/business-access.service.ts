import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service'; // 👈 Asegúrate de que esta importación exista

@Injectable()
export class BusinessAccessService {
  constructor(private readonly prisma: PrismaService) {} // 👈 Tipado obligatorio

  /**
   * Obtiene el inventario asegurando que el usuario sea empleado activo
   */
  async getInventory(
    businessId: number,
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _requiredPermission?: string, // 👈 Con _ evitas el error no-unused-vars
  ) {
    // 1. Validar pertenencia del usuario al negocio
    const employee = await this.prisma.businessEmployee.findUnique({
      where: {
        userId_businessId: { userId, businessId },
      },
      select: {
        isActive: true,
        role: true,
        business: {
          select: {
            id: true,
            inventory: { select: { id: true, businessId: true } },
          },
        },
      },
    });

    if (!employee || !employee.isActive) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a este negocio',
      );
    }

    // 2. Resolver inventario
    if (employee.business.inventory) {
      return employee.business.inventory;
    }

    return this.prisma.inventory.upsert({
      where: { businessId },
      update: {},
      create: { businessId },
      select: { id: true, businessId: true },
    });
  }
}
