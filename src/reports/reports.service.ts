import { Injectable } from '@nestjs/common';
import { Permission } from 'generated/prisma/enums';
import { BusinessAccessService } from 'src/business-access/business-access.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessAccess: BusinessAccessService,
  ) {}
  async getExpiringSoonProducts(
    businessId: number,
    userId: string,
    daysAhead = 30,
  ) {
    const inventory = await this.businessAccess.getInventory(
      businessId,
      userId,
      Permission.VIEW_REPORTS,
    );

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    return this.prisma.product.findMany({
      where: {
        inventoryId: inventory.id,
        expirationDate: {
          gte: now,
          lte: futureDate,
        },
      },
      orderBy: {
        expirationDate: 'asc',
      },
    });
  }

  // 4. Productos con Poca Rotación (Sin ventas en los últimos 60 días)
  async getLowRotationProducts(businessId: number, userId: string, days = 60) {
    const inventory = await this.businessAccess.getInventory(
      businessId,
      userId,
      Permission.VIEW_REPORTS,
    );

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - days);

    return this.prisma.product.findMany({
      where: {
        inventoryId: inventory.id,
        saleItems: {
          none: {
            sale: {
              businessId,
              occurredAt: { gte: sixtyDaysAgo },
              status: 'COMPLETED',
            },
          },
        },
      },
    });
  }

  // 5. Ganancias del Mes Actual
  async getCurrentMonthProfits(businessId: number, userId: string) {
    // Valida acceso a través de BusinessAccessService
    await this.businessAccess.getInventory(
      businessId,
      userId,
      Permission.VIEW_FINANCIAL_SUMMARY,
    );

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const sales = await this.prisma.sale.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        occurredAt: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { items: true },
    });

    let totalRevenue = 0;
    let totalCOGS = 0;

    for (const sale of sales) {
      totalRevenue += Number(sale.total);
      for (const item of sale.items) {
        totalCOGS += Number(item.unitCost) * item.quantity;
      }
    }

    const expensesGroup = await this.prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        businessId,
        occurredAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const totalExpenses = Number(expensesGroup._sum.amount || 0);
    const grossProfit = totalRevenue - totalCOGS;

    return {
      period: { start: startOfMonth, end: endOfMonth },
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalExpenses,
      netProfit: grossProfit - totalExpenses,
    };
  }
}
