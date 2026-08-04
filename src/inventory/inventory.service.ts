import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { MovementsService } from 'src/movements/movements.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
  ) {}

  async getResume(user: JwtPayload) {
    // 1. Agregamos los datos agrupados filtrando por el inventario del usuario
    const metrics = await this.prisma.product.aggregate({
      where: {
        inventory: {
          userId: user.id, // Asumiendo que el modelo Inventory tiene relación con User
        },
      },
      _count: {
        id: true, // Cantidad total de productos (IDs únicos)
      },
      _sum: {
        stock: true, // Stock total acumulado
      },
    });

    // 2. Para el valor total del inventario (precio * stock), traemos solo price y stock
    const products = await this.prisma.product.findMany({
      where: {
        inventory: {
          userId: user.id,
        },
      },
      select: {
        price: true,
        stock: true,
      },
    });

    // Calculamos el valor monetario total en memoria
    const totalInventoryValue = products.reduce((acc, product) => {
      return acc + product.price * product.stock;
    }, 0);

    const todayMovements = await this.movements.getTodayMovements(user.id);

    return {
      totalProducts: metrics._count.id,
      totalStock: metrics._sum.stock ?? 0,
      totalValue: totalInventoryValue,
      todayMovements: todayMovements,
    };
  }

  async getLowStock(userId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { userId },
    });
    if (!inventory) throw new NotFoundException('No se encontró un inventario');
    const products = await this.prisma.product.findMany({
      where: { inventoryId: inventory.id, stock: { lt: 5 } }, // Productos con stock menor a 5
      orderBy: { stock: 'asc' }, // Ordenamos de menor a mayor stock
    });
    return products;
  }

  async getCategories(userId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { userId },
    });
    if (!inventory) throw new NotFoundException('No se encontró un inventario');
    const categories = await this.prisma.product.groupBy({
      by: ['category'],
      where: { inventoryId: inventory.id },
      _count: { category: true },
    });
    return categories;
  }
}
