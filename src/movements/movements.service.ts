import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StockExitDto } from './dto/stock-exit.dto';
import { CreateProductDto } from 'src/products/dto/create-product.dto';
import { Category, MovementType } from 'generated/prisma/enums';
import { StockEntryDto } from './dto/stock-entry.dto';
import { UpdateProductDto } from 'src/products/dto/update-product.dto';
import { FindMovementsDto } from './dto/find-movements.dto';
import { FindStockDto } from './dto/find-stock.dto';

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordStockExit(
    dto: StockExitDto,
    userId: string,
    inventoryId: number,
  ) {
    const { productId, quantity, reason } = dto;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Obtener producto actual validando que sea de su inventario
      const product = await tx.product.findFirst({
        where: { id: productId, inventoryId },
      });

      if (!product) throw new NotFoundException('Producto no encontrado');
      if (product.stock < quantity) {
        throw new BadRequestException('Stock insuficiente');
      }

      const previousStock = product.stock;
      const newStock = previousStock - quantity;

      // 2. Actualizar el stock del producto
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
      });

      // 3. Crear el registro en el historial
      await tx.movementHistory.create({
        data: {
          type: MovementType.STOCK_EXIT,
          quantity,
          previousStock,
          newStock,
          reason,
          inventoryId,
          productId,
          userId,
        },
      });

      return updatedProduct;
    });
  }

  async createProduct(
    dto: CreateProductDto,
    userId: string,
    inventoryId: number,
  ) {
    if (dto.category === Category.FOOD && !dto.expirationDate) {
      throw new BadRequestException(
        'Los productos de la categoría FOOD requieren una fecha de expiración',
      );
    }
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, inventoryId },
      });
      if (!supplier) {
        throw new NotFoundException('El proveedor especificado no existe');
      }
    }
    return await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          price: dto.price,
          purchasePrice: dto.purchasePrice,
          stock: dto.stock,
          category: dto.category,
          supplierId: dto.supplierId,
          expirationDate: dto.expirationDate
            ? new Date(dto.expirationDate)
            : null,
          inventoryId,
        },
      });

      await tx.movementHistory.create({
        data: {
          type: MovementType.CREATE_PRODUCT,
          productId: product.id,
          reason: 'Creación inicial de producto',
          details: `Se añadió un producto de la categoría ${product.category} con un stock inicial de ${product.stock}`,
          inventoryId,
          userId,
        },
      });
      return product;
    });
  }

  async recordStockEntry(
    dto: StockEntryDto,
    userId: string,
    inventoryId: number,
  ) {
    const { productId, quantity, reason } = dto;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Buscar el producto validando el inventario
      const product = await tx.product.findFirst({
        where: { id: productId, inventoryId },
      });

      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }

      const previousStock = product.stock;
      const newStock = previousStock + quantity; // Sumamos el nuevo stock

      // 2. Actualizar el stock del producto
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
      });

      // 3. Registrar el movimiento directamente con Prisma en la transacción
      await tx.movementHistory.create({
        data: {
          type: MovementType.STOCK_ENTRY,
          quantity,
          previousStock,
          newStock,
          reason: reason || 'Ingreso de stock',
          inventoryId,
          productId: product.id,
          userId,
        },
      });

      return updatedProduct;
    });
  }

  async recordProductUpdate(
    productId: number,
    dto: UpdateProductDto,
    userId: string,
    inventoryId: number,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Obtener el producto ANTES de la modificación
      const currentProduct = await tx.product.findFirst({
        where: { id: productId, inventoryId },
      });

      if (!currentProduct) {
        throw new NotFoundException('Producto no encontrado');
      }

      // 2. Construir un objeto de detalles con los campos que realmente cambiaron
      const changes: Record<string, { from: any; to: any }> = {};

      Object.keys(dto).forEach((key) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const newValue = dto[key];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const oldValue = currentProduct[key];

        // Guardamos solo si el valor envió cambios y es diferente al actual
        if (newValue !== undefined && newValue !== oldValue) {
          changes[key] = {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            from: oldValue,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            to: newValue,
          };
        }
      });

      // 3. Si no hubo cambios reales en los datos, actualizamos sin registrar historial innecesario
      if (Object.keys(changes).length === 0) {
        return currentProduct;
      }

      // 4. Actualizar el producto
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: dto,
      });

      // 5. Crear el registro en el historial de movimientos
      await tx.movementHistory.create({
        data: {
          type: MovementType.UPDATE_PRODUCT,
          quantity: null,
          previousStock: currentProduct.stock,
          newStock: updatedProduct.stock,
          reason: 'Edición de información del producto',
          details: changes, // 👈 Guardamos el objeto con las diferencias
          inventoryId,
          productId,
          userId,
        },
      });

      return updatedProduct;
    });
  }

  async deleteProduct(productId: number, userId: string, inventoryId: number) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Obtener el producto antes de ser eliminado
      const product = await tx.product.findFirst({
        where: { id: productId, inventoryId },
      });

      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }

      // 2. Registrar la eliminación en el historial ANTES de borrar el producto
      // Guardamos los metadatos en 'details' para no perderlos cuando productId quede en null
      await tx.movementHistory.create({
        data: {
          type: MovementType.DELETE_PRODUCT,
          previousStock: product.stock,
          newStock: 0,
          reason: 'Producto eliminado del sistema',
          details: {
            deletedProductName: product.name,
            deletedProductCategory: product.category,
            deletedProductPrice: product.price,
            deletedProductPurchasePrice: product.purchasePrice,
          },
          inventoryId,
          productId: product.id,
          userId,
        },
      });

      // 3. Eliminar el producto de la base de datos
      return await tx.product.delete({
        where: { id: productId },
      });
    });
  }

  async getTodayMovements(inventoryId: number) {
    // 1. Definir el inicio y fin del día actual en tiempo local/servidor
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Consultar directamente usando el índice @@index([inventoryId, createdAt]) de tu esquema
    const movements = await this.prisma.movementHistory.findMany({
      where: {
        inventoryId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        type: true,
        quantity: true,
        previousStock: true,
        newStock: true,
        reason: true,
        details: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            price: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return movements;
  }

  async getLast7DaysMovementsSummary(userId: string, businessId: number) {
    // 1. Validar acceso del usuario al negocio y obtener el inventoryId
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
        'No se encontró el inventario para este negocio',
      );
    }

    // 2. Definir el rango de los últimos 7 días
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOf7DaysAgo = new Date();
    startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 6);
    startOf7DaysAgo.setHours(0, 0, 0, 0);

    // 3. Consultar los movimientos dentro del rango
    const movements = await this.prisma.movementHistory.findMany({
      where: {
        inventoryId,
        createdAt: {
          gte: startOf7DaysAgo,
          lte: endOfToday,
        },
      },
      select: {
        type: true,
        createdAt: true,
      },
    });

    // Función helper para formatear fechas a YYYY-MM-DD en hora local (evita desfase UTC)
    const formatLocalYYYYMMDD = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 4. Inicializar los últimos 7 días con conteos en 0
    const summaryMap: Record<
      string,
      { total: number; entries: number; exits: number }
    > = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatLocalYYYYMMDD(d);
      summaryMap[dateStr] = { total: 0, entries: 0, exits: 0 };
    }

    // 5. Agrupar conteos por día respetando la zona horaria local
    movements.forEach((movement) => {
      const dateStr = formatLocalYYYYMMDD(movement.createdAt);
      if (summaryMap[dateStr]) {
        summaryMap[dateStr].total += 1;
        if (movement.type === 'STOCK_ENTRY') summaryMap[dateStr].entries += 1;
        if (movement.type === 'STOCK_EXIT') summaryMap[dateStr].exits += 1;
      }
    });

    // 6. Formatear la respuesta para el frontend
    return Object.entries(summaryMap).map(([date, data]) => ({
      date,
      totalMovements: data.total,
      entries: data.entries,
      exits: data.exits,
    }));
  }

  async getStockEntry(userId: string, dto: FindStockDto) {
    const { page, limit } = dto;

    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      this.prisma.movementHistory.findMany({
        where: {
          userId,
          type: 'STOCK_ENTRY',
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.movementHistory.count({
        where: { userId, type: 'STOCK_ENTRY' },
      }),
    ]);

    return {
      data: movements,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStockExit(userId: string, dto: FindStockDto) {
    const { page, limit } = dto;

    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      this.prisma.movementHistory.findMany({
        where: {
          userId,
          type: 'STOCK_EXIT',
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.movementHistory.count({
        where: { userId, type: 'STOCK_EXIT' },
      }),
    ]);

    return {
      data: movements,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMovements(userId: string, dto: FindMovementsDto) {
    const { page, limit, movementType } = dto;

    const skip = (page - 1) * limit;

    const where = {
      userId: userId,
      ...(movementType && { type: movementType }),
    };

    const [movements, total] = await Promise.all([
      this.prisma.movementHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.movementHistory.count({ where }),
    ]);

    return {
      data: movements,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
