import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SubscriptionsService } from 'src/suscriptions/subscriptions.service';

@Injectable()
export class BusinessEmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  // Listar empleados del negocio
  async findAll(businessId: number, paginationDto: PaginationDto) {
    const { page = 1, limit = 12 } = paginationDto;

    // Calcular el salto para Prisma
    const skip = (page - 1) * limit;

    // Ejecutar consulta de registros y conteo total en paralelo para optimizar rendimiento
    const [data, total] = await Promise.all([
      this.prisma.businessEmployee.findMany({
        where: { businessId },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc', // Opcional: ordenar los más recientes primero
        },
      }),
      this.prisma.businessEmployee.count({
        where: { businessId },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // Actualización unificada de empleado (Rol, Estado, Permisos)
  async update(employeeId: number, businessId: number, dto: UpdateEmployeeDto) {
    // Validar pertenencia y obtener datos actuales del empleado
    const employee = await this.ensureEmployeeBelongsToBusiness(
      employeeId,
      businessId,
    );

    // Protección: Evitar modificar al dueño
    if (employee.role === 'OWNER') {
      throw new ForbiddenException(
        'No se pueden modificar los permisos, rol o estado del propietario',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const { periodStart, periodEnd } =
        await this.subscriptionsService.getCurrentUsagePeriod(businessId);

      await tx.businessUsage.upsert({
        where: {
          businessId_type_periodStart: {
            businessId: businessId,
            type: 'MOVEMENTS',
            periodStart,
          },
        },
        update: {
          value: { increment: 1 },
        },
        create: {
          businessId: businessId,
          type: 'MOVEMENTS',
          value: 1,
          periodStart,
          periodEnd,
        },
      });
      return tx.businessEmployee.update({
        where: { id: employeeId },
        data: {
          ...(dto.role && { role: dto.role }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.permissions && { permissions: dto.permissions }),
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });
    });
  }

  // Eliminar empleado del negocio
  async remove(employeeId: number, businessId: number) {
    const employee = await this.ensureEmployeeBelongsToBusiness(
      employeeId,
      businessId,
    );

    if (employee.role === 'OWNER') {
      throw new ForbiddenException(
        'No se puede eliminar al propietario del negocio',
      );
    }

    return this.prisma.businessEmployee.delete({
      where: { id: employeeId },
    });
  }

  private async ensureEmployeeBelongsToBusiness(
    employeeId: number,
    businessId: number,
  ) {
    const employee = await this.prisma.businessEmployee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.businessId !== businessId) {
      throw new NotFoundException('Empleado no encontrado en este negocio');
    }

    return employee;
  }
}
