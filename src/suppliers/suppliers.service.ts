// src/suppliers/suppliers.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { FindSupplierDto } from './dto/find-supplier.dto';
import { SubscriptionsService } from 'src/suscriptions/subscriptions.service';
import { LimitType } from 'generated/prisma/enums';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Helper privado para validar que el usuario pertenezca al negocio y obtener su inventoryId
   */
  private async getInventoryAndValidateAccess(
    userId: string,
    businessId: number,
  ) {
    const employee = await this.prisma.businessEmployee.findUnique({
      where: {
        userId_businessId: {
          userId,
          businessId,
        },
      },
      select: {
        isActive: true,
        business: {
          select: {
            inventory: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!employee || !employee.isActive) {
      throw new ForbiddenException('No tienes acceso a este negocio');
    }

    const inventoryId = employee.business.inventory?.id;

    if (!inventoryId) {
      throw new NotFoundException(
        'No se encontró un inventario asignado a este negocio',
      );
    }

    return inventoryId;
  }

  // Crear proveedor
  async create(
    createSupplierDto: CreateSupplierDto,
    userId: string,
    businessId: number,
  ) {
    await this.subscriptionsService.validate(
      businessId,
      LimitType.SUPPLIERS,
      1,
    );
    const inventoryId = await this.getInventoryAndValidateAccess(
      userId,
      businessId,
    );

    return await this.prisma.$transaction(async (tx) => {
      // Validar si ya existe el nombre en este inventario
      const existing = await tx.supplier.findUnique({
        where: {
          name_inventoryId: {
            name: createSupplierDto.name,
            inventoryId,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          'Ya existe un proveedor con este nombre en tu inventario',
        );
      }

      return await tx.supplier.create({
        data: {
          ...createSupplierDto,
          inventoryId,
        },
      });
    });
  }

  // Listar todos los proveedores
  async findAll(userId: string, dto: FindSupplierDto, businessId: number) {
    const inventoryId = await this.getInventoryAndValidateAccess(
      userId,
      businessId,
    );

    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where: { inventoryId },
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.supplier.count({
        where: { inventoryId },
      }),
    ]);

    return {
      data: suppliers,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Obtener un proveedor por ID
  async findOne(id: number, userId: string, businessId: number) {
    const inventoryId = await this.getInventoryAndValidateAccess(
      userId,
      businessId,
    );
    return await this.findOneByIdAndInventory(id, inventoryId);
  }

  // Método auxiliar reutilizable directamente por ProductsService o internamente
  async findOneByIdAndInventory(id: number, inventoryId: number) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, inventoryId },
      include: {
        products: {
          select: { id: true, name: true, stock: true },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return supplier;
  }

  // Actualizar proveedor
  async update(
    id: number,
    updateSupplierDto: UpdateSupplierDto,
    userId: string,
    businessId: number,
  ) {
    await this.subscriptionsService.validate(
      businessId,
      LimitType.MOVEMENTS,
      1,
    );
    const supplier = await this.findOne(id, userId, businessId);

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
      // Si se está cambiando el nombre, validar que no colisione con otro proveedor del mismo inventario
      if (updateSupplierDto.name && updateSupplierDto.name !== supplier.name) {
        const existing = await tx.supplier.findUnique({
          where: {
            name_inventoryId: {
              name: updateSupplierDto.name,
              inventoryId: supplier.inventoryId,
            },
          },
        });

        if (existing) {
          throw new ConflictException(
            'Ya existe otro proveedor con este nombre en tu inventario',
          );
        }
      }

      return await tx.supplier.update({
        where: { id: supplier.id },
        data: updateSupplierDto,
      });
    });
  }

  // Eliminar proveedor
  async remove(id: number, userId: string, businessId: number) {
    const supplier = await this.findOne(id, userId, businessId);

    // Validar si tiene productos vinculados para evitar romper la FK de la DB
    if (supplier.products.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar el proveedor porque tiene ${supplier.products.length} producto(s) asociado(s). Reasigna los productos a otro proveedor primero.`,
      );
    }

    return await this.prisma.supplier.delete({
      where: { id: supplier.id },
    });
  }
}
