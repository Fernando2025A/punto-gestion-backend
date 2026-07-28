import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import type { JwtPayload } from 'src/auth/jwt-payload.interface';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { MovementsService } from 'src/movements/movements.service';
import { StockExitDto } from 'src/movements/dto/stock-exit.dto';
import { StockEntryDto } from 'src/movements/dto/stock-entry.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
  ) {}

  // Helper privado para asegurar que el usuario tenga un inventario
  private async getOrCreateInventory(userId: string) {
    let inventory = await this.prisma.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      inventory = await this.prisma.inventory.create({
        data: { userId },
      });
    }

    return inventory;
  }

  async create(dto: CreateProductDto, user: JwtPayload) {
    const inventory = await this.getOrCreateInventory(user.id);

    // Delegamos a MovementsService la creación (que crea el producto y el historial en 1 sola transacción)
    return await this.movements.createProduct(dto, user.id, inventory.id);
  }

  // 🔹 Método para registrar Entradas de Stock (Compras, Reabastecimiento)
  async recordStockEntry(dto: StockEntryDto, user: JwtPayload) {
    const inventory = await this.getOrCreateInventory(user.id);
    return await this.movements.recordStockEntry(dto, user.id, inventory.id);
  }

  // 🔹 Método para registrar Salidas de Stock (Ventas, Mermas, Pérdidas)
  async recordStockExit(dto: StockExitDto, user: JwtPayload) {
    const inventory = await this.getOrCreateInventory(user.id);
    return await this.movements.recordStockExit(dto, user.id, inventory.id);
  }

  async findAll(user: JwtPayload, dto: FindProductsDto) {
    const { page, limit, category } = dto;

    const inventory = await this.prisma.inventory.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!inventory) {
      throw new NotFoundException(
        'No se encontró un inventario para este usuario',
      );
    }

    const skip = (page - 1) * limit;

    const where = {
      inventoryId: inventory.id,
      ...(category && { category }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(user: JwtPayload, productId: number) {
    await this.validateProduct(user, productId);
    return await this.prisma.product.findUnique({
      where: { id: productId },
    });
  }

  // ⚠️ Este update es EXCLUSIVO para metadatos (nombre, precio, categoría)
  async update(dto: UpdateProductDto, user: JwtPayload, productId: number) {
    // 1. Validamos que el producto exista y pertenezca al usuario
    await this.validateProduct(user, productId);

    // 2. Obtenemos el inventario (o lanzamos NotFoundException si no existe)
    const inventory = await this.prisma.inventory.findUnique({
      where: { userId: user.id },
    });

    if (!inventory) {
      throw new NotFoundException(
        'No se encontró un inventario para este usuario',
      );
    }

    // 3. Omitimos 'stock' si viene en el DTO para forzar el uso de /stock-entry o /stock-exit
    const { stock, ...cleanDto } = dto as any;

    // 4. Delegamos TODO a MovementsService (obtiene estado previo, actualiza y crea el historial)
    return await this.movements.recordProductUpdate(
      productId,
      cleanDto,
      user.id,
      inventory.id,
    );
  }

  async delete(user: JwtPayload, productId: number) {
    await this.validateProduct(user, productId);
    return await this.prisma.product.delete({
      where: { id: productId },
    });
  }

  private async validateProduct(user: JwtPayload, productId: number) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { userId: user.id },
    });

    if (!inventory)
      throw new NotFoundException(
        'No se encontró un inventario para este usuario',
      );

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new NotFoundException('Producto no encontrado');

    if (inventory.id !== product.inventoryId)
      throw new UnauthorizedException(
        'El producto solicitado no está en tu inventario',
      );

    return true;
  }
}
