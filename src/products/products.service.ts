import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import type { JwtPayload } from 'src/auth/jwt-payload.interface';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { MovementsService } from 'src/movements/movements.service';
import { StockExitDto } from 'src/movements/dto/stock-exit.dto';
import { StockEntryDto } from 'src/movements/dto/stock-entry.dto';
import { SuppliersService } from 'src/suppliers/suppliers.service';
import { Category } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
    private readonly suppliersService: SuppliersService,
  ) {}

  // Helper privado para obtener o crear el inventario del usuario
  async getOrCreateInventoryForBusiness(businessId: number, userId: string) {
    // 1. Validar primero que el usuario sea empleado activo o dueño de ESTE negocio
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
            id: true,
            inventory: {
              select: { id: true, businessId: true },
            },
          },
        },
      },
    });

    // Si no existe la relación o el empleado está desactivado, denegar acceso de inmediato (403)
    if (!employee || !employee.isActive) {
      throw new ForbiddenException(
        'No tienes permisos para acceder ni modificar el inventario de este negocio',
      );
    }

    // 2. Si el negocio existe y el usuario tiene permiso, verificar si ya tiene inventario
    let inventory = employee.business.inventory;

    // 3. Si por algún motivo de migración/legacy el negocio no tenía inventario, lo creamos
    if (!inventory) {
      inventory = await this.prisma.inventory.create({
        data: { businessId },
        select: { id: true, businessId: true },
      });
    }

    return inventory;
  }

  async create(dto: CreateProductDto, userId: string, businessId: number) {
    const inventory = await this.getOrCreateInventoryForBusiness(
      businessId,
      userId,
    );

    // Delegamos a MovementsService la creación (que crea el producto y el historial en 1 sola transacción)
    return await this.movements.createProduct(dto, userId, inventory.id);
  }

  // 🔹 Método para registrar Entradas de Stock (Compras, Reabastecimiento)
  async recordStockEntry(
    dto: StockEntryDto,
    userId: string,
    businessId: number,
  ) {
    const inventory = await this.getOrCreateInventoryForBusiness(
      businessId,
      userId,
    );
    return await this.movements.recordStockEntry(dto, userId, inventory.id);
  }

  // 🔹 Método para registrar Salidas de Stock (Ventas, Mermas, Pérdidas)
  async recordStockExit(dto: StockExitDto, userId: string, businessId: number) {
    const inventory = await this.getOrCreateInventoryForBusiness(
      businessId,
      userId,
    );
    return await this.movements.recordStockExit(dto, userId, inventory.id);
  }

  async findAll(user: JwtPayload, dto: FindProductsDto, businessId: number) {
    const { page = 1, limit = 10, category, search } = dto;

    // 1. Validar que el usuario tenga acceso al negocio y obtener el inventoryId
    const employee = await this.prisma.businessEmployee.findUnique({
      where: {
        userId_businessId: {
          userId: user.id,
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
        'No se encontró el inventario para este negocio',
      );
    }

    // 2. Construir la cláusula `where` dinámica
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      inventoryId,
      ...(category && { category }),
      ...(search && {
        name: { contains: search, mode: 'insensitive' },
      }),
    };

    // 3. Ejecutar consulta paginada y conteo en paralelo
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Es mejor ordenar por los más recientes
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // 4. Formatear la respuesta convirtiendo el precio a número
    const formattedProducts = products.map((product) => ({
      ...product,
      price: Number(product.price),
    }));

    return {
      data: formattedProducts,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(userId: string, productId: number, businessId: number) {
    await this.validateProduct(userId, productId, businessId);
    return await this.prisma.product.findUnique({
      where: { id: productId },
    });
  }

  async update(
    dto: UpdateProductDto,
    userId: string,
    productId: number,
    businessId: number,
  ) {
    // 1. Validar que el usuario pertenezca al negocio y esté activo
    const employee = await this.prisma.businessEmployee.findUnique({
      where: {
        userId_businessId: {
          userId: userId,
          businessId,
        },
      },
      select: {
        isActive: true,
        role: true,
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
        'No se encontró el inventario de este negocio',
      );
    }

    // 2. Validar que el producto pertenezca al inventario de ESTE negocio
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        id: productId,
        inventoryId,
      },
      select: { id: true, category: true },
    });

    if (!existingProduct) {
      throw new NotFoundException(
        'El producto no existe o no pertenece a este negocio',
      );
    }

    // 3. Validar regla de negocio de categoría FOOD y fecha de expiración
    const finalCategory = dto.category ?? existingProduct.category;
    if (finalCategory === Category.FOOD && dto.expirationDate === null) {
      throw new BadRequestException(
        'Un producto de categoría FOOD debe mantener una fecha de expiración válida',
      );
    }

    // 4. Si se especifica un proveedor, validar que pertenezca al MISMO negocio
    if (dto.supplierId) {
      await this.suppliersService.findOne(dto.supplierId, userId, businessId);
    }

    // 5. Omitir el campo stock de forma segura en TypeScript
    const { stock, ...cleanDto } = dto;

    // 6. Delegar actualización e historial a MovementsService pasando el inventoryId correcto
    return await this.movements.recordProductUpdate(
      productId,
      cleanDto,
      userId,
      inventoryId,
    );
  }

  async delete(userId: string, productId: number, businessId: number) {
    // 1. Validamos la existencia y pertenencia del producto al negocio
    const inventoryId = await this.validateProduct(
      userId,
      productId,
      businessId,
    );

    // 2. Delegamos la eliminación e historial a MovementsService
    return await this.movements.deleteProduct(productId, userId, inventoryId);
  }

  private async validateProduct(
    userId: string,
    productId: number,
    businessId: number,
  ): Promise<number> {
    // 1. Validar que el usuario sea empleado activo del negocio y obtener su inventoryId
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
        'No se encontró un inventario para este negocio',
      );
    }

    // 2. Consultar el producto y verificar en un solo paso que pertenezca a ESTE inventario
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        inventoryId,
      },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(
        'El producto no existe o no pertenece al inventario de este negocio',
      );
    }

    // Retornamos el inventoryId para reutilizarlo en la eliminación
    return inventoryId;
  }
}
