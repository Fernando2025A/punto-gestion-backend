import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { EmployeeRole, Permission } from 'generated/prisma/enums';
import { randomBytes } from 'crypto';

@Injectable()
export class BusinessInvitesService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Generar Código de Invitación
  async createInvite(
    businessId: number,
    createdById: string,
    dto: CreateInviteDto,
  ) {
    const randomCode = `INV-${randomBytes(3).toString('hex').toUpperCase()}`;

    // 1. Si no se especifican minutos, se toma 60 por defecto
    const minutesToExpire = dto.expiresInMinutes ?? 60;

    // 2. Calcular la fecha límite sumando los minutos a la hora actual
    const expiresAt = new Date(Date.now() + minutesToExpire * 60 * 1000);

    return this.prisma.businessInvite.create({
      data: {
        code: randomCode,
        role: dto.role,
        expiresAt,
        maxUses: dto.maxUses ?? 1,
        businessId,
        createdById,
      },
    });
  }

  // 2. Canjear Invitación (Unirse a un negocio)
  async joinBusinessByCode(userId: string, code: string) {
    return this.prisma.$transaction(async (tx) => {
      // a. Buscar la invitación
      const invite = await tx.businessInvite.findUnique({
        where: { code },
        include: { business: true },
      });

      if (!invite) {
        throw new NotFoundException('El código de invitación no es válido');
      }

      // b. Validar expiración
      if (new Date() > invite.expiresAt) {
        throw new BadRequestException('El código de invitación ha expirado');
      }

      // c. Validar límite de uso
      if (invite.usedCount >= invite.maxUses) {
        throw new BadRequestException(
          'El código de invitación ya no tiene usos disponibles',
        );
      }

      // d. Verificar si el usuario ya es el Dueño del negocio
      if (invite.business.ownerId === userId) {
        throw new ConflictException('Ya eres el propietario de este negocio');
      }

      // e. Verificar si el usuario ya es empleado
      const existingEmployee = await tx.businessEmployee.findUnique({
        where: {
          userId_businessId: {
            userId,
            businessId: invite.businessId,
          },
        },
      });

      if (existingEmployee) {
        throw new ConflictException('Ya eres miembro de este negocio');
      }

      // f. Asignar permisos por defecto según el rol del código
      const defaultPermissions = this.getDefaultPermissionsForRole(invite.role);

      // g. Crear la membresía de empleado
      const employee = await tx.businessEmployee.create({
        data: {
          userId,
          businessId: invite.businessId,
          role: invite.role,
          permissions: defaultPermissions,
          isActive: true,
        },
      });

      // h. Incrementar el contador de uso del código
      await tx.businessInvite.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });

      return employee;
    });
  }

  // Mapeador de permisos sugeridos para V1
  private getDefaultPermissionsForRole(role: EmployeeRole): Permission[] {
    switch (role) {
      case EmployeeRole.ADMIN:
        return Object.values(Permission); // Todos los permisos

      case EmployeeRole.CASHIER:
        return [
          Permission.VIEW_PRODUCT,
          Permission.VIEW_CATEGORIES,
          Permission.REGISTER_STOCK_EXIT,
          Permission.VIEW_DASHBOARD,
        ];

      case EmployeeRole.STOCKER:
        return [
          Permission.VIEW_PRODUCT,
          Permission.CREATE_PRODUCT,
          Permission.UPDATE_PRODUCT,
          Permission.REGISTER_STOCK_ENTRY,
          Permission.REGISTER_STOCK_EXIT,
          Permission.ADJUST_STOCK,
          Permission.VIEW_MOVEMENTS,
          Permission.VIEW_SUPPLIERS,
        ];

      case EmployeeRole.EMPLOYEE:
      default:
        return [Permission.VIEW_PRODUCT, Permission.VIEW_CATEGORIES];
    }
  }
}
