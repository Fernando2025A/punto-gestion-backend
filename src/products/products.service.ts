import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { MovementsService } from 'src/movements/movements.service';
import { StockExitDto } from 'src/movements/dto/stock-exit.dto';
import { StockEntryDto } from 'src/movements/dto/stock-entry.dto';
import { SuppliersService } from 'src/suppliers/suppliers.service';
import { BusinessAccessService } from 'src/business-access/business-access.service';
import { Category } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
    private readonly suppliersService: SuppliersService,
    private readonly businessAccess: BusinessAccessService,
  ) {}

  // Helper privado para transformar los valores Decimal de Prisma a Number de JS
  private formatProductPrices<T extends { price: any; purchasePrice?: any }>(
    product: T,
  ) {
    return {
      ...product,
      price: Number(product.price),
      purchasePrice: product.purchasePrice
        ? Number(product.purchasePrice)
        : null,
    };
  }

  async create(dto: CreateProductDto, userId: string, businessId: number) {
    const inventory = await this.businessAccess.getInventory(
      businessId,
      userId,
    );
    return this.movements.createProduct(dto, userId, inventory.id);
  }

  async recordStockEntry(
    dto: StockEntryDto,
    userId: string,
    businessId: number,
  ) {
    const inventory = await this.businessAccess.getInventory(
      businessId,
      userId,
    );
    return this.movements.recordStockEntry(dto, userId, inventory.id);
  }

  async recordStockExit(dto: StockExitDto, userId: string, businessId: number) {
    const inventory = await this.businessAccess.getInventory(
      businessId,
      userId,
    );
    return this.movements.recordStockExit(dto, userId, inventory.id);
  }

  async findAll(userId: string, dto: FindProductsDto, businessId: number) {
    const { page = 1, limit = 10, category, search } = dto;
    const inventory = await this.businessAccess.getInventory(
      businessId,
      userId,
    );

    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      inventoryId: inventory.id,
      ...(category && { category }),
      ...(search && {
        name: { contains: search, mode: 'insensitive' },
      }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((product) => this.formatProductPrices(product)),
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

  async findOne(userId: string, productName: string, businessId: number) {
    const inventory = await this.businessAccess.getInventory(
      businessId,
      userId,
    );

    const product = await this.prisma.product.findFirst({
      where: {
        name: productName,
        inventoryId: inventory.id,
      },
      include: {
        supplier: {
          select: { id: true, name: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(
        'El producto no existe o no pertenece a este negocio',
      );
    }

    return this.formatProductPrices(product);
  }

  async update(
    dto: UpdateProductDto,
    userId: string,
    productId: number,
    businessId: number,
  ) {
    const inventory = await this.businessAccess.getInventory(
      businessId,
      userId,
    );

    const existingProduct = await this.prisma.product.findFirst({
      where: {
        id: productId,
        inventoryId: inventory.id,
      },
      select: { id: true, category: true },
    });

    if (!existingProduct) {
      throw new NotFoundException(
        'El producto no existe o no pertenece a este negocio',
      );
    }

    const finalCategory = dto.category ?? existingProduct.category;
    if (finalCategory === Category.FOOD && dto.expirationDate === null) {
      throw new BadRequestException(
        'Un producto de categoría FOOD debe mantener una fecha de expiración válida',
      );
    }

    if (dto.supplierId) {
      await this.suppliersService.findOne(dto.supplierId, userId, businessId);
    }

    const { stock, ...cleanDto } = dto;

    return this.movements.recordProductUpdate(
      productId,
      cleanDto,
      userId,
      inventory.id,
    );
  }

  async delete(userId: string, productId: number, businessId: number) {
    // 1. Obtenemos el inventario solo una vez
    const inventory = await this.businessAccess.getInventory(
      businessId,
      userId,
    );

    // 2. Validamos existencia rápida mediante un select liviano sin traer todo el producto
    const productExists = await this.prisma.product.findFirst({
      where: {
        id: productId,
        inventoryId: inventory.id,
      },
      select: { id: true },
    });

    if (!productExists) {
      throw new NotFoundException(
        'El producto no existe o no pertenece a este negocio',
      );
    }

    // 3. Delegamos eliminación e historial al servicio de movimientos
    return this.movements.deleteProduct(productId, userId, inventory.id);
  }
}
