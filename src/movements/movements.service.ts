import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StockExitDto } from './dto/stock-exit.dto';
import { CreateProductDto } from 'src/products/dto/create-product.dto';
import {
  Category,
  MovementReason,
  MovementType,
  PaymentMethod,
  SaleStatus,
} from 'generated/prisma/enums';
import { StockEntryDto } from './dto/stock-entry.dto';
import { UpdateProductDto } from 'src/products/dto/update-product.dto';
import { FindMovementsDto } from './dto/find-movements.dto';
import { FindStockDto } from './dto/find-stock.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubscriptionsService } from 'src/suscriptions/subscriptions.service';
import { BulkStockExitDto } from './dto/bulk-stock-exit.dto';
import { BulkStockEntryDto } from './dto/bulk-stock-entry.dto';

interface BusinessAlertPayload {
  businessId: number;
  type: 'LOW_STOCK' | 'EXPIRATION_WARNING' | 'NEW_EMPLOYEE';
  message: string;
  data?: Record<string, any>;
}

@Injectable()
export class MovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async recordStockExit(
    dto: StockExitDto,
    userId: string,
    inventoryId: number,
  ) {
    const { productId, quantity, reason, notes, paymentMethod } = dto;

    // Variable temporal para guardar la alerta si corresponde emitirla
    let alertPayloadToSend: BusinessAlertPayload | null = null;

    // 1. Ejecutar operaciones atómicas en Base de Datos
    const result = await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
        select: { businessId: true },
      });

      if (!inventory) {
        throw new NotFoundException('Inventario no encontrado');
      }

      const { periodStart, periodEnd } =
        await this.subscriptionsService.getCurrentUsagePeriod(
          inventory.businessId,
        );

      await tx.businessUsage.upsert({
        where: {
          businessId_type_periodStart: {
            businessId: inventory.businessId,
            type: 'MOVEMENTS',
            periodStart,
          },
        },
        update: {
          value: { increment: 1 },
        },
        create: {
          businessId: inventory.businessId,
          type: 'MOVEMENTS',
          value: 1,
          periodStart,
          periodEnd,
        },
      });
      // Obtener producto e incluir businessId desde la relación inventory
      const product = await tx.product.findFirst({
        where: { id: productId, inventoryId },
        include: {
          inventory: {
            select: { businessId: true },
          },
        },
      });

      if (!product) throw new NotFoundException('Producto no encontrado');
      if (product.stock < quantity) {
        throw new BadRequestException('Stock insuficiente');
      }

      const previousStock = product.stock;
      const newStock = previousStock - quantity;

      // Descontar el stock
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
      });

      // Crear el historial
      const movement = await tx.movementHistory.create({
        data: {
          type: MovementType.STOCK_EXIT,
          reason,
          notes: notes ?? null,
          quantity,
          previousStock,
          newStock,
          inventoryId,
          productId,
          userId,
        },
      });

      let sale: any = null;

      // Crear la Venta ÚNICAMENTE si el motivo es VENTA
      if (reason === MovementReason.SALE) {
        const businessId = product.inventory.businessId;
        const unitPrice = Number(product.price);
        const unitCost = Number(product.purchasePrice);
        const totalAmount = unitPrice * quantity;

        sale = await tx.sale.create({
          data: {
            businessId,
            userId,
            subtotal: totalAmount,
            discount: 0,
            total: totalAmount,
            status: SaleStatus.COMPLETED,
            paymentMethod: paymentMethod ?? PaymentMethod.CASH,
            items: {
              create: [
                {
                  productId: product.id,
                  productName: product.name,
                  quantity,
                  unitPrice,
                  unitCost,
                  subtotal: totalAmount,
                },
              ],
            },
          },
          include: {
            items: true,
          },
        });
      }

      // Preparar la alerta de stock si aplica
      const threshold = updatedProduct.minimumStock ?? 10; // Usar minimumStock o fallback

      // Alerta solo si cruzó el límite hacia abajo en esta transacción
      const isLow = newStock <= threshold;
      const wasAbove = previousStock > threshold;

      if (isLow && wasAbove) {
        alertPayloadToSend = {
          businessId: product.inventory.businessId, // 👈 Se envía el businessId para el Room de WS
          type: 'LOW_STOCK',
          message: `¡Alerta! El producto "${updatedProduct.name}" ha alcanzado el nivel mínimo de stock (${newStock} unidades restantes).`,
          data: {
            productId: updatedProduct.id,
            productName: updatedProduct.name,
            currentStock: newStock,
            minimumStock: threshold,
          },
        };
      }

      return {
        product: updatedProduct,
        movement,
        sale,
      };
    });

    // 2. Emitir el evento de WebSockets SOLAMENTE tras confirmación en BD
    if (alertPayloadToSend) {
      this.eventEmitter.emit('business.alert', alertPayloadToSend);
    }

    return result;
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
      // 1. Obtener el inventario para extraer el businessId
      const inventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
        select: { businessId: true },
      });

      if (!inventory) {
        throw new NotFoundException('Inventario no encontrado');
      }
      // 2. Crear el producto
      const product = await tx.product.create({
        data: {
          name: dto.name,
          price: dto.price,
          purchasePrice: dto.purchasePrice,
          stock: dto.stock,
          minimumStock: dto.minimumStock,
          imageUrl: dto.imageUrl,
          category: dto.category,
          supplierId: dto.supplierId,
          expireAlertAt: dto.expireAlertAt,
          expirationDate: dto.expirationDate
            ? new Date(dto.expirationDate)
            : null,
          inventoryId,
        },
      });

      // 3. Crear el historial de movimiento
      await tx.movementHistory.create({
        data: {
          type: MovementType.CREATE_PRODUCT,
          productId: product.id,
          quantity: dto.stock,
          previousStock: 0,
          newStock: dto.stock,
          details: `Se añadió un producto de la categoría ${product.category} con un stock inicial de ${product.stock}`,
          inventoryId,
          userId,
        },
      });

      // 4. Si el stock inicial es mayor a 0, registrar la compra/inversión inicial en Purchase
      if (dto.stock > 0) {
        const unitCost = Number(dto.purchasePrice);
        const totalAmount = unitCost * dto.stock;

        await tx.purchase.create({
          data: {
            businessId: inventory.businessId,
            supplierId: dto.supplierId ?? null,
            userId,
            subtotal: totalAmount,
            total: totalAmount,
            items: {
              create: [
                {
                  productId: product.id,
                  productName: product.name,
                  quantity: dto.stock,
                  unitCost,
                  subtotal: totalAmount,
                },
              ],
            },
          },
        });
      }

      return product;
    });
  }

  async recordStockEntry(
    dto: StockEntryDto,
    userId: string,
    inventoryId: number,
  ) {
    const { productId, quantity, notes } = dto;

    return await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
        select: { businessId: true },
      });

      if (!inventory) {
        throw new NotFoundException('Inventario no encontrado');
      }

      const { periodStart, periodEnd } =
        await this.subscriptionsService.getCurrentUsagePeriod(
          inventory.businessId,
        );
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
          notes: notes ?? 'Ingreso de stock',
          inventoryId,
          productId: product.id,
          userId,
        },
      });

      const unitCost = Number(product.purchasePrice);
      const totalAmount = unitCost * dto.quantity;

      await tx.purchase.create({
        data: {
          businessId: inventory.businessId,
          supplierId: dto.supplierId ?? null,
          userId,
          subtotal: totalAmount,
          total: totalAmount,
          items: {
            create: [
              {
                productId: product.id,
                productName: product.name,
                quantity: dto.quantity,
                unitCost,
                subtotal: totalAmount,
              },
            ],
          },
        },
      });
      await tx.businessUsage.upsert({
        where: {
          businessId_type_periodStart: {
            businessId: inventory.businessId,
            type: 'MOVEMENTS',
            periodStart,
          },
        },
        update: {
          value: { increment: 1 },
        },
        create: {
          businessId: inventory.businessId,
          type: 'MOVEMENTS',
          value: 1,
          periodStart,
          periodEnd,
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
      const inventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
        select: { businessId: true },
      });

      if (!inventory) {
        throw new NotFoundException('Inventario no encontrado');
      }

      const { periodStart, periodEnd } =
        await this.subscriptionsService.getCurrentUsagePeriod(
          inventory.businessId,
        );

      await tx.businessUsage.upsert({
        where: {
          businessId_type_periodStart: {
            businessId: inventory.businessId,
            type: 'MOVEMENTS',
            periodStart,
          },
        },
        update: {
          value: { increment: 1 },
        },
        create: {
          businessId: inventory.businessId,
          type: 'MOVEMENTS',
          value: 1,
          periodStart,
          periodEnd,
        },
      });
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
          details: changes,
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
      const inventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
        select: { businessId: true },
      });

      if (!inventory) {
        throw new NotFoundException('Inventario no encontrado');
      }

      const { periodStart, periodEnd } =
        await this.subscriptionsService.getCurrentUsagePeriod(
          inventory.businessId,
        );

      await tx.businessUsage.upsert({
        where: {
          businessId_type_periodStart: {
            businessId: inventory.businessId,
            type: 'MOVEMENTS',
            periodStart,
          },
        },
        update: {
          value: { increment: 1 },
        },
        create: {
          businessId: inventory.businessId,
          type: 'MOVEMENTS',
          value: 1,
          periodStart,
          periodEnd,
        },
      });
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

  async getLast7DaysMovementsSummary(businessId: number) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

    // 2. Definir el rango de los últimos 7 días
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOf7DaysAgo = new Date();
    startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 6);
    startOf7DaysAgo.setHours(0, 0, 0, 0);

    // 3. Consultar los movimientos dentro del rango
    const movements = await this.prisma.movementHistory.findMany({
      where: {
        inventoryId: inventory.id,
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

  async getStockEntry(businessId: number, dto: FindStockDto) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');
    const { page, limit } = dto;

    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      this.prisma.movementHistory.findMany({
        where: {
          inventoryId: inventory.id,
          type: 'STOCK_ENTRY',
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.movementHistory.count({
        where: { type: 'STOCK_ENTRY', inventoryId: inventory.id },
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

  async getStockExit(businessId: number, dto: FindStockDto) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');
    const { page, limit } = dto;

    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      this.prisma.movementHistory.findMany({
        where: {
          inventoryId: inventory.id,
          type: 'STOCK_EXIT',
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.movementHistory.count({
        where: { inventoryId: inventory.id, type: 'STOCK_EXIT' },
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

  async getMovements(businessId: number, dto: FindMovementsDto) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });
    if (!inventory) throw new NotFoundException('No se encontró inventario');
    const { page, limit, movementType } = dto;

    const skip = (page - 1) * limit;

    const where = {
      inventoryId: inventory.id,
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

  async recordBulkStockExit(
    dto: BulkStockExitDto,
    userId: string,
    inventoryId: number,
  ) {
    const { items, reason, notes, paymentMethod } = dto;
    const productIds = items.map((i) => i.productId);
    const alertsToSend: BusinessAlertPayload[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Obtener inventario y validar periodo
      const inventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
        select: { businessId: true },
      });
      if (!inventory) throw new NotFoundException('Inventario no encontrado');

      // 2. Obtener todos los productos solicitados de un solo query
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, inventoryId },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException(
          'Uno o más productos no existen en el inventario',
        );
      }

      const productMap = new Map(products.map((p) => [p.id, p]));
      const saleItemsData: any = [];
      let totalSaleAmount = 0;

      // 3. Validar stock y preparar actualizaciones
      for (const item of items) {
        const product = productMap.get(item.productId)!;
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para "${product.name}"`,
          );
        }

        const previousStock = product.stock;
        const newStock = previousStock - item.quantity;

        // Actualizar stock del producto
        await tx.product.update({
          where: { id: product.id },
          data: { stock: newStock },
        });

        // Crear entrada individual de historial
        await tx.movementHistory.create({
          data: {
            type: MovementType.STOCK_EXIT,
            reason,
            notes: notes ?? null,
            quantity: item.quantity,
            previousStock,
            newStock,
            inventoryId,
            productId: product.id,
            userId,
          },
        });

        // Recopilar datos si el motivo es VENTA
        if (reason === MovementReason.SALE) {
          const unitPrice = Number(product.price);
          const unitCost = Number(product.purchasePrice);
          const subtotal = unitPrice * item.quantity;
          totalSaleAmount += subtotal;

          saleItemsData.push({
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice,
            unitCost,
            subtotal,
          });
        }

        // Evaluar alertas de stock mínimo
        const threshold = product.minimumStock ?? 10;
        if (newStock <= threshold && previousStock > threshold) {
          alertsToSend.push({
            businessId: inventory.businessId,
            type: 'LOW_STOCK',
            message: `¡Alerta! "${product.name}" alcanzó el stock mínimo (${newStock} unidades).`,
            data: {
              productId: product.id,
              productName: product.name,
              currentStock: newStock,
            },
          });
        }
      }

      // 4. Crear una sola venta agrupada con sus ítems
      let sale: any = null;
      if (reason === MovementReason.SALE && saleItemsData.length > 0) {
        sale = await tx.sale.create({
          data: {
            businessId: inventory.businessId,
            userId,
            subtotal: totalSaleAmount,
            total: totalSaleAmount,
            status: SaleStatus.COMPLETED,
            paymentMethod: paymentMethod ?? PaymentMethod.CASH,
            items: { create: saleItemsData },
          },
          include: { items: true },
        });
      }

      // 5. Incrementar contador de uso (1 movimiento por transacción compuesta)
      const { periodStart, periodEnd } =
        await this.subscriptionsService.getCurrentUsagePeriod(
          inventory.businessId,
        );
      await tx.businessUsage.upsert({
        where: {
          businessId_type_periodStart: {
            businessId: inventory.businessId,
            type: 'MOVEMENTS',
            periodStart,
          },
        },
        update: { value: { increment: 1 } },
        create: {
          businessId: inventory.businessId,
          type: 'MOVEMENTS',
          value: 1,
          periodStart,
          periodEnd,
        },
      });

      return { success: true, count: items.length, sale };
    });

    // Emitir alertas acumuladas tras confirmar transacción
    alertsToSend.forEach((alert) =>
      this.eventEmitter.emit('business.alert', alert),
    );

    return result;
  }

  async recordBulkStockEntry(
    dto: BulkStockEntryDto,
    userId: string,
    inventoryId: number,
  ) {
    const { items, supplierId, notes } = dto;
    const productIds = items.map((i) => i.productId);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Validar existencia del inventario
      const inventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
        select: { businessId: true },
      });
      if (!inventory) throw new NotFoundException('Inventario no encontrado');

      // 2. Validar proveedor si se provee
      if (supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: supplierId, inventoryId },
        });
        if (!supplier) {
          throw new NotFoundException('El proveedor especificado no existe');
        }
      }

      // 3. Buscar todos los productos del lote en una sola consulta
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, inventoryId },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException(
          'Uno o más productos no existen en el inventario',
        );
      }

      const productMap = new Map(products.map((p) => [p.id, p]));
      const purchaseItemsData: any = [];
      let totalPurchaseAmount = 0;

      // 4. Procesar actualización de stock e historial por cada producto
      for (const item of items) {
        const product = productMap.get(item.productId)!;
        const previousStock = product.stock;
        const newStock = previousStock + item.quantity;

        // Usar el costo enviado o tomar el purchasePrice actual del producto como fallback
        const unitCost = item.unitCost ?? Number(product.purchasePrice);
        const subtotal = unitCost * item.quantity;
        totalPurchaseAmount += subtotal;

        // Incrementar stock del producto
        await tx.product.update({
          where: { id: product.id },
          data: { stock: newStock },
        });

        // Crear entrada individual en el historial
        await tx.movementHistory.create({
          data: {
            type: MovementType.STOCK_ENTRY,
            reason: MovementReason.PURCHASE,
            notes: notes ?? 'Ingreso masivo de stock',
            quantity: item.quantity,
            previousStock,
            newStock,
            inventoryId,
            productId: product.id,
            userId,
          },
        });

        purchaseItemsData.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitCost,
          subtotal,
        });
      }

      // 5. Crear el registro global de la Compra (Purchase)
      const purchase = await tx.purchase.create({
        data: {
          businessId: inventory.businessId,
          supplierId: supplierId ?? null,
          userId,
          subtotal: totalPurchaseAmount,
          total: totalPurchaseAmount,
          items: { create: purchaseItemsData },
        },
        include: { items: true },
      });

      // 6. Contabilizar como 1 único movimiento consumido en el plan de suscripción
      const { periodStart, periodEnd } =
        await this.subscriptionsService.getCurrentUsagePeriod(
          inventory.businessId,
        );

      await tx.businessUsage.upsert({
        where: {
          businessId_type_periodStart: {
            businessId: inventory.businessId,
            type: 'MOVEMENTS',
            periodStart,
          },
        },
        update: { value: { increment: 1 } },
        create: {
          businessId: inventory.businessId,
          type: 'MOVEMENTS',
          value: 1,
          periodStart,
          periodEnd,
        },
      });

      return { success: true, count: items.length, purchase };
    });
  }
}
