import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StockExitDto } from './dto/stock-exit.dto';
import { CreateProductDto } from 'src/products/dto/create-product.dto';
import { Category, MovementType } from 'generated/prisma/enums';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { StockEntryDto } from './dto/stock-entry.dto';
import { UpdateProductDto } from 'src/products/dto/update-product.dto';

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

      // Registrar historial...
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

  async getTodayMovements(userId: string) {
    // 1. Obtener el inventario del usuario
    const inventory = await this.prisma.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      throw new NotFoundException('Inventario no encontrado');
    }

    // 2. Definir el inicio del día (00:00:00.000) y el fin (23:59:59.999)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 3. Consultar los movimientos dentro del rango
    return await this.prisma.movementHistory.findMany({
      where: {
        inventoryId: inventory.id,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            price: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Los más recientes primero
      },
    });
  }

  async getMovements(user: JwtPayload) {
    const movements = await this.prisma.movementHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }, // Opcional: para traer los más recientes primero
    });
    return movements;
  }
}
