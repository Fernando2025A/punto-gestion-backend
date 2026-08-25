import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SaleStatus } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { PeriodDto } from './dto/period.dto';
import { ReportsExportService } from './reports-export.service';
import { PdfProps } from './reports-export.service';
import { PaginationDto } from 'src/business/business-employees/dto/pagination.dto';
import { Prisma } from 'generated/prisma/browser';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsExportService: ReportsExportService,
  ) {}
  async getExpiringSoonProducts(
    businessId: number,
    daysAhead = 30,
    dto: PaginationDto = { page: 1, limit: 12 },
  ) {
    const page = dto.page ? Number(dto.page) : 1;
    const limit = dto.limit ? Number(dto.limit) : 12;
    const skip = (page - 1) * limit;

    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    const whereCondition = {
      inventoryId: inventory.id,
      expirationDate: {
        gte: now,
        lte: futureDate,
      },
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: whereCondition,
        orderBy: {
          expirationDate: 'asc',
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

  // 4. Productos con Poca Rotación (Sin ventas en los últimos 60 días)
  async getLowRotationProducts(
    businessId: number,
    days = 60,
    dto: PaginationDto = { page: 1, limit: 12 },
  ) {
    const page = dto.page ? Number(dto.page) : 1;
    const limit = dto.limit ? Number(dto.limit) : 12;
    const skip = (page - 1) * limit;

    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - days);

    const whereCondition: Prisma.ProductWhereInput = {
      inventoryId: inventory.id,
      // 1. Solo evaluamos productos que tengan al menos X días de creados
      createdAt: { lte: cutOffDate },
      // 2. Filtramos productos que NO tengan ningún SaleItem asociado a una venta realizada en ese período
      saleItems: {
        none: {
          sale: {
            businessId,
            occurredAt: { gte: cutOffDate },
            status: 'COMPLETED',
          },
        },
      },
    };

    const [data, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
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

  // 5. Ganancias del Mes Actual
  async getCurrentMonthProfits(businessId: number) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

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

  async getBusinessResume(businessId: number, dto: PeriodDto) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

    const { startDate, endDate } = dto;

    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    // 2. Ejecutar consultas en paralelo (Resúmenes globales + Listados para el gráfico)
    const [
      salesAggregate,
      salesItems,
      purchasesAggregate,
      expensesAggregate,
      salesList,
      purchasesList,
      expensesList,
    ] = await Promise.all([
      // Aggregates globales
      this.prisma.sale.aggregate({
        where: {
          businessId,
          status: SaleStatus.COMPLETED,
          occurredAt: dateFilter,
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      this.prisma.saleItem.findMany({
        where: {
          sale: {
            businessId,
            status: SaleStatus.COMPLETED,
            occurredAt: dateFilter,
          },
        },
        select: { quantity: true, unitCost: true },
      }),
      this.prisma.purchase.aggregate({
        where: { businessId, occurredAt: dateFilter },
        _sum: { total: true },
      }),
      this.prisma.expense.aggregate({
        where: { businessId, occurredAt: dateFilter },
        _sum: { amount: true },
      }),

      // Consultas detalladas para agrupar por día en el gráfico
      this.prisma.sale.findMany({
        where: {
          businessId,
          status: SaleStatus.COMPLETED,
          occurredAt: dateFilter,
        },
        select: { occurredAt: true, total: true },
      }),
      this.prisma.purchase.findMany({
        where: { businessId, occurredAt: dateFilter },
        select: { occurredAt: true, total: true },
      }),
      this.prisma.expense.findMany({
        where: { businessId, occurredAt: dateFilter },
        select: { occurredAt: true, amount: true },
      }),
    ]);

    // 3. Totales generales
    const totalSales = Number(salesAggregate._sum.total ?? 0);
    const totalPurchases = Number(purchasesAggregate._sum.total ?? 0);
    const totalExpenses = Number(expensesAggregate._sum.amount ?? 0); // Gastos operativos

    const costOfGoodsSold = salesItems.reduce((acc, item) => {
      return acc + item.quantity * Number(item.unitCost);
    }, 0);

    const totalOutflows = totalPurchases + totalExpenses;
    const grossProfit = totalSales - costOfGoodsSold;

    // CORRECCIÓN: Ganancia Neta = Ganancia Bruta - Gastos Operativos
    const netProfit = grossProfit - totalExpenses;

    // 4. Construcción del arreglo 'chart' agrupado día a día
    const dailyMap = new Map<string, { income: number; expenses: number }>();

    // Inicializar todos los días del rango en el Mapa (para evitar saltos de fechas en el frontend)
    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    while (currentDate <= lastDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyMap.set(dateKey, { income: 0, expenses: 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Acumular Ingresos (Ventas) por fecha
    for (const sale of salesList) {
      const dateKey = new Date(sale.occurredAt).toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        const day = dailyMap.get(dateKey)!;
        day.income += Number(sale.total);
      }
    }

    // Acumular Egresos (Compras de stock) por fecha
    for (const purchase of purchasesList) {
      const dateKey = new Date(purchase.occurredAt).toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        const day = dailyMap.get(dateKey)!;
        day.expenses += Number(purchase.total);
      }
    }

    // Acumular Egresos (Gastos operativos) por fecha
    for (const expense of expensesList) {
      const dateKey = new Date(expense.occurredAt).toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        const day = dailyMap.get(dateKey)!;
        day.expenses += Number(expense.amount);
      }
    }

    // Convertir el Mapa a un arreglo formateado
    const chart = Array.from(dailyMap.entries()).map(([date, values]) => ({
      date,
      income: values.income,
      expenses: values.expenses,
    }));

    // 5. Estructura final de respuesta
    return {
      period: {
        startDate,
        endDate,
      },
      summary: {
        totalSales,
        totalPurchases,
        totalExpenses,
        totalOutflows,
        costOfGoodsSold,
        grossProfit,
        netProfit,
        salesCount: salesAggregate._count.id,
      },
      chart,
    };
  }

  async getKPIOverview(businessId: number) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { business: { id: businessId } },
    });

    if (!inventory) throw new NotFoundException('No se encontró inventario');

    // Fechas de control
    const now = new Date();

    // Próximos a vencer (30 días adelante)
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + 30);

    // Poca rotación (60 días atrás)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);

    // Rango del mes actual para las ganancias
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // 2. Consultas concurrentes en paralelo
    const [
      outOfStockCount,
      lowStockCount,
      expiringSoonCount,
      lowRotationCount,
      salesAggregate,
      salesItems,
      expensesAggregate,
    ] = await Promise.all([
      // A. Sin Stock (stock = 0)
      this.prisma.product.count({
        where: {
          inventoryId: inventory.id,
          stock: 0,
        },
      }),

      // B. Stock Bajo (stock > 0 y stock <= minStock)
      this.prisma.product.count({
        where: {
          inventoryId: inventory.id,
          stock: {
            gt: 0,
            lte: this.prisma.product.fields.minimumStock, // Compara stock actual contra el stock mínimo del producto
          },
        },
      }),

      // C. Próximos a vencer (entre hoy y 30 días)
      this.prisma.product.count({
        where: {
          inventoryId: inventory.id,
          expirationDate: {
            gte: now,
            lte: futureDate,
          },
        },
      }),

      // D. Poca rotación (sin ventas en los últimos 60 días)
      this.prisma.product.count({
        where: {
          inventoryId: inventory.id,
          // 1. Filtrar solo productos creados hace 'days' días o más
          createdAt: { lte: sixtyDaysAgo },
          // 2. Filtrar productos que NO se hayan vendido en ese período
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
      }),

      // E. Total Ingresos por Ventas del mes
      this.prisma.sale.aggregate({
        where: {
          businessId,
          status: SaleStatus.COMPLETED,
          occurredAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { total: true },
      }),

      // F. Costos de los productos vendidos en el mes (COGS)
      this.prisma.saleItem.findMany({
        where: {
          sale: {
            businessId,
            status: SaleStatus.COMPLETED,
            occurredAt: { gte: startOfMonth, lte: endOfMonth },
          },
        },
        select: { quantity: true, unitCost: true },
      }),

      // G. Total Gastos del mes
      this.prisma.expense.aggregate({
        where: {
          businessId,
          occurredAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    // 3. Cálculos financieros del mes actual
    const totalRevenue = Number(salesAggregate._sum.total ?? 0);
    const totalExpenses = Number(expensesAggregate._sum.amount ?? 0);

    const costOfGoodsSold = salesItems.reduce(
      (acc, item) => acc + item.quantity * Number(item.unitCost),
      0,
    );

    const grossProfit = totalRevenue - costOfGoodsSold;
    const netProfit = grossProfit - totalExpenses;

    // 4. Retorno consolidado de métricas
    return {
      outOfStockCount,
      lowStockCount,
      expiringSoonCount,
      lowRotationCount,
      currentMonthProfits: {
        period: { start: startOfMonth, end: endOfMonth },
        totalRevenue,
        costOfGoodsSold,
        grossProfit,
        totalExpenses,
        netProfit,
      },
    };
  }

  async generateBusinessReportPdf(
    businessId: number,
    periodDto?: PeriodDto,
  ): Promise<PDFKit.PDFDocument> {
    if (periodDto) {
      if (periodDto?.endDate < periodDto?.startDate) {
        throw new BadRequestException(
          'La fecha de fin no puede ser menor a la de inicio',
        );
      }
    }
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // Aseguramos que existan fechas válidas incluso si llega {} desde la Query
    const period: PeriodDto = {
      startDate: periodDto?.startDate
        ? new Date(periodDto.startDate)
        : defaultStart,
      endDate: periodDto?.endDate ? new Date(periodDto.endDate) : defaultEnd,
    };

    const [business, kpis, resume] = await Promise.all([
      this.prisma.business.findUnique({
        where: { id: businessId },
      }),
      this.getKPIOverview(businessId),
      this.getBusinessResume(businessId, period),
    ]);

    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    const pdfProps: PdfProps = {
      imageUrl: business?.imageUrl || '',
      businessName: business?.name || 'Mi Negocio',
      businessDescription: business?.description || 'Resumen de Gestión',
      startDate: formatDate(period.startDate),
      endDate: formatDate(period.endDate),
      expiringSoonCount: kpis.expiringSoonCount,
      lowRotationCount: kpis.lowRotationCount,
      outOfStockCount: kpis.outOfStockCount,
      lowStockCount: kpis.lowStockCount,
      monthlyResult: kpis.currentMonthProfits.netProfit,
      totalSales: resume.summary.totalSales,
      costOfSales: resume.summary.costOfGoodsSold,
      totalExpenses: resume.summary.totalOutflows,
      stockExpenses: resume.summary.totalPurchases,
      operatingExpenses: resume.summary.totalExpenses,
    };

    return this.reportsExportService.generatePdf(pdfProps);
  }

  async generateBusinessReportExcel(
    businessId: number,
    periodDto?: PeriodDto,
  ): Promise<Buffer> {
    if (periodDto) {
      if (periodDto?.endDate < periodDto?.startDate) {
        throw new BadRequestException(
          'La fecha de fin no puede ser menor a la de inicio',
        );
      }
    }
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const period: PeriodDto = {
      startDate: periodDto?.startDate
        ? new Date(periodDto.startDate)
        : defaultStart,
      endDate: periodDto?.endDate ? new Date(periodDto.endDate) : defaultEnd,
    };

    const [business, kpis, resume] = await Promise.all([
      this.prisma.business.findUnique({
        where: { id: businessId },
      }),
      this.getKPIOverview(businessId),
      this.getBusinessResume(businessId, period),
    ]);

    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    const props: PdfProps = {
      imageUrl: business?.imageUrl || '',
      businessName: business?.name || 'Mi Negocio',
      businessDescription: business?.description || 'Resumen de Gestión',
      startDate: formatDate(period.startDate),
      endDate: formatDate(period.endDate),
      expiringSoonCount: kpis.expiringSoonCount,
      lowRotationCount: kpis.lowRotationCount,
      outOfStockCount: kpis.outOfStockCount,
      lowStockCount: kpis.lowStockCount,
      monthlyResult: kpis.currentMonthProfits.netProfit,
      totalSales: resume.summary.totalSales,
      costOfSales: resume.summary.costOfGoodsSold,
      totalExpenses: resume.summary.totalOutflows,
      stockExpenses: resume.summary.totalPurchases,
      operatingExpenses: resume.summary.totalExpenses,
    };

    return this.reportsExportService.generateResumeExcel(props);
  }
}
