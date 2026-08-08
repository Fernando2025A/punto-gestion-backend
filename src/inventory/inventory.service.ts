import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementsService } from 'src/movements/movements.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
  ) {}

  async getResume(userId: string, businessId: number) {
    // 1. Obtener el inventario del negocio y validar que el usuario tenga acceso activo
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

    // 2. Métrica agregada (Total de productos y Stock total)
    const metrics = await this.prisma.product.aggregate({
      where: { inventoryId },
      _count: { id: true },
      _sum: { stock: true },
    });

    // 3. Productos para calcular el valor monetario acumulado
    const products = await this.prisma.product.findMany({
      where: { inventoryId },
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
    const todayMovements = await this.movements.getTodayMovements(inventoryId);

    return {
      totalProducts: metrics._count.id ?? 0,
      totalStock: metrics._sum.stock ?? 0,
      totalValue: Number(totalInventoryValue.toFixed(2)),
      todayMovements,
    };
  }

  async getLowStock(userId: string, businessId: number) {
    // 1. Obtener la alerta global del usuario y validar su acceso al negocio
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stockAlertAt: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const globalAlertLevel = user.stockAlertAt ?? 10;

    // 2. Obtener el inventario del negocio
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

    // 3. Consultar productos con bajo stock directamente desde la base de datos
    // Usamos OR para capturar tanto las alertas personalizadas como las globales
    const lowStockProducts = await this.prisma.product.findMany({
      where: {
        inventoryId,
        OR: [
          // Caso A: El producto tiene un minimumStock personalizado y el stock actual es menor o igual
          {
            minimumStock: { not: null },
            stock: { lte: this.prisma.product.fields.minimumStock }, // Comparación de columnas en Prisma
          },
          // Caso B: El producto no tiene minimumStock propio y se compara contra la alerta global del usuario
          {
            minimumStock: null,
            stock: { lte: globalAlertLevel },
          },
        ],
      },
      orderBy: { stock: 'asc' },
    });

    return lowStockProducts;
  }

  async getCategories(userId: string, businessId: number) {
    // 1. Validar que el negocio exista y que el usuario tenga acceso a él
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

    // 2. Agrupar productos por categoría
    const categories = await this.prisma.product.groupBy({
      by: ['category'],
      where: { inventoryId },
      _count: { category: true },
    });

    return categories.map((cat) => ({
      category: cat.category,
      count: cat._count.category,
    }));
  }

  async getOutOfStock(userId: string, businessId: number) {
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

    // 2. Obtener productos agotados (stock igual a 0)
    const products = await this.prisma.product.findMany({
      where: {
        inventoryId,
        stock: 0,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return products;
  }
}
