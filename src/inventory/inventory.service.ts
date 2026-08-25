import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/browser';
import { PaginationDto } from 'src/business/business-employees/dto/pagination.dto';
import { MovementsService } from 'src/movements/movements.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
  ) {}

  async getResume(businessId: number) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

    // 2. Métrica agregada (Total de productos y Stock total)
    const metrics = await this.prisma.product.aggregate({
      where: { inventoryId: inventory.id },
      _count: { id: true },
      _sum: { stock: true },
    });

    // 3. Productos para calcular el valor monetario acumulado
    const products = await this.prisma.product.findMany({
      where: { inventoryId: inventory.id },
      select: {
        price: true,
        stock: true,
      },
    });

    // 4. Cálculo del valor total convirtiendo Decimal a number
    const totalInventoryValue = products.reduce((acc, product) => {
      const price = Number(product.price) || 0;
      return acc + price * product.stock;
    }, 0);

    // 5. Movimientos del día filtrados por inventario
    const todayMovements = await this.movements.getTodayMovements(inventory.id);

    return {
      totalProducts: metrics._count.id ?? 0,
      totalStock: metrics._sum.stock ?? 0,
      totalValue: Number(totalInventoryValue.toFixed(2)),
      todayMovements,
    };
  }

  async getLowStock(
    businessId: number,
    dto: PaginationDto = { page: 1, limit: 12 },
  ) {
    const page = dto.page ? Number(dto.page) : 1;
    const limit = dto.limit ? Number(dto.limit) : 12;
    const skip = (page - 1) * limit;

    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

    const business = await this.prisma.business.findFirst({
      where: { id: businessId },
      select: {
        owner: {
          select: { stockAlertAt: true },
        },
      },
    });

    const whereCondition: Prisma.ProductWhereInput = {
      inventoryId: inventory.id,
      stock: { gt: 0 }, // 👈 Garantiza que NO incluya productos agotados (stock 0)
      OR: [
        {
          minimumStock: { not: null },
          stock: { lte: this.prisma.product.fields.minimumStock },
        },
        {
          minimumStock: null,
          stock: { lte: business?.owner.stockAlertAt },
        },
      ],
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: whereCondition,
        orderBy: { stock: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({
        where: whereCondition,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  async getCategories(businessId: number) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

    // 2. Agrupar productos por categoría
    const categories = await this.prisma.product.groupBy({
      by: ['category'],
      where: { inventoryId: inventory.id },
      _count: { category: true },
    });

    return categories.map((cat) => ({
      category: cat.category,
      count: cat._count.category,
    }));
  }

  async getOutOfStock(
    businessId: number,
    dto: PaginationDto = { page: 1, limit: 12 },
  ) {
    const page = dto.page ? Number(dto.page) : 1;
    const limit = dto.limit ? Number(dto.limit) : 12;
    const skip = (page - 1) * limit;

    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

    const whereCondition = {
      inventoryId: inventory.id,
      stock: 0,
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: whereCondition,
        orderBy: {
          name: 'asc',
        },
        skip,
        take: limit,
      }),
      this.prisma.product.count({
        where: whereCondition,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }
}
