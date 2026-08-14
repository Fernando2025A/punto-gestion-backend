import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { Permission } from 'generated/prisma/enums';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Listar todos los negocios a los que el usuario tiene acceso (Owner o Empleado activo)
  async findAllForUser(userId: string) {
    const employments = await this.prisma.businessEmployee.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            description: true,
            ownerId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return employments.map((emp) => ({
      businessId: emp.business.id,
      businessName: emp.business.name,
      businessDescription: emp.business.description,
      isOwner: emp.business.ownerId === userId || emp.role === 'OWNER',
      role: emp.role,
      isActive: emp.isActive,
      permissions: emp.permissions,
    }));
  }

  // 2. Obtener contexto del negocio activo para sincronizar el estado global del frontend
  async getActiveBusinessContext(userId: string, businessId: number) {
    const employment = await this.prisma.businessEmployee.findUnique({
      where: {
        userId_businessId: { userId, businessId },
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            description: true,
            ownerId: true,
          },
        },
      },
    });

    if (!employment) {
      throw new NotFoundException('No tienes acceso a este negocio');
    }

    if (!employment.isActive) {
      throw new ForbiddenException(
        'Tu acceso a este negocio ha sido desactivado',
      );
    }

    return {
      businessId: employment.business.id,
      businessName: employment.business.name,
      businessDescription: employment.business.description,
      isOwner:
        employment.business.ownerId === userId || employment.role === 'OWNER',
      role: employment.role,
      isActive: employment.isActive,
      permissions: employment.permissions,
    };
  }

  // 3. Actualizar datos del negocio (Nombre, Descripción)
  async updateBusiness(
    businessId: number,
    userId: string,
    dto: UpdateBusinessDto,
  ) {
    // Verificar si el usuario tiene acceso a este negocio
    const employment = await this.prisma.businessEmployee.findUnique({
      where: {
        userId_businessId: { userId, businessId },
      },
      include: { business: true },
    });

    if (!employment || !employment.isActive) {
      throw new NotFoundException('Negocio no encontrado o sin acceso');
    }

    const isOwner =
      employment.business.ownerId === userId || employment.role === 'OWNER';
    const hasPermission = employment.permissions.includes(
      Permission.UPDATE_BUSINESS,
    );

    // Permitir si es OWNER o si tiene el permiso asignado explícitamente
    if (!isOwner && !hasPermission) {
      throw new ForbiddenException(
        'No tienes permisos para editar la información de este negocio',
      );
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }
}
