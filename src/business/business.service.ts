import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { LimitType, Permission } from 'generated/prisma/enums';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { SubscriptionsService } from 'src/suscriptions/subscriptions.service';

@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

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
            imageUrl: true,
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
      imageUrl: emp.business.imageUrl,
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

    if (!isOwner && !hasPermission) {
      throw new ForbiddenException(
        'No tienes permisos para editar la información de este negocio',
      );
    }

    const previousImageUrl = employment.business.imageUrl;

    // 2. Actualizamos la base de datos con la nueva imagen
    const updatedBusiness = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
      },
    });

    // 3. Verificamos si debemos eliminar la imagen previa
    if (dto.imageUrl && previousImageUrl && dto.imageUrl !== previousImageUrl) {
      const publicId =
        this.cloudinaryService.extractPublicIdFromUrl(previousImageUrl);

      if (publicId) {
        console.log(
          `Intentando eliminar de Cloudinary el public_id: "${publicId}"`,
        );

        try {
          const result = await this.cloudinaryService.deleteFile(publicId);
          console.log('Resultado de eliminación en Cloudinary:', result);
          return updatedBusiness;
        } catch (err) {
          console.error('Error al eliminar la imagen en Cloudinary:', err);
        }
      } else {
        console.warn(
          'No se pudo extraer el public_id de la URL previa:',
          previousImageUrl,
        );
      }
    }
  }

  async createExpense(
    userId: string,
    dto: CreateExpenseDto,
    businessId: number,
  ) {
    await this.subscriptionsService.validate(businessId, LimitType.EXPENSES, 1);

    return await this.prisma.$transaction(async (tx) => {
      const { periodStart, periodEnd } =
        await this.subscriptionsService.getCurrentUsagePeriod(businessId);

      await tx.businessUsage.upsert({
        where: {
          businessId_type_periodStart: {
            businessId: businessId,
            type: 'EXPENSES',
            periodStart,
          },
        },
        update: {
          value: { increment: 1 },
        },
        create: {
          businessId: businessId,
          type: 'EXPENSES',
          value: 1,
          periodStart,
          periodEnd,
        },
      });
      const expense = await tx.expense.create({
        data: {
          ...dto,
          businessId,
          userId,
        },
      });
      return expense;
    });
  }
}
