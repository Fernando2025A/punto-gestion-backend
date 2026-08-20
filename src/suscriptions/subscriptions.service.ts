import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  NotImplementedException,
  BadRequestException,
} from '@nestjs/common';
import { LimitType, Permission } from 'generated/prisma/enums';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePlanRequestDto } from './dto/create-plan-request.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Valida si el negocio puede realizar una acción según su plan.
   *
   * @param businessId ID del negocio
   * @param action Tipo de límite a evaluar
   * @param amountToConsume Cantidad que se intenta registrar en esta operación (Por defecto: 1)
   */
  async validate(
    businessId: number,
    action: LimitType,
    amountToConsume: number = 1,
  ): Promise<boolean> {
    if (amountToConsume <= 0 || !Number.isInteger(amountToConsume)) {
      throw new BadRequestException(
        'amountToConsume debe ser un entero mayor que 0',
      );
    }

    // 1. Buscamos el plan del negocio, su fecha de expiración y sus límites
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        planId: true,
        planExpiresAt: true,
        plan: {
          select: {
            limits: true,
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('No se encontró el negocio especificado');
    }

    let activeLimits = business.plan.limits;
    const now = new Date();

    // 2. Intercepción de expiración: Si venció y no está en el plan básico, lo bajamos a 1
    if (
      business.planExpiresAt &&
      business.planExpiresAt < now &&
      business.planId !== 1
    ) {
      // 2.1 Actualizamos la BD asincrónicamente o esperamos a que termine
      await this.prisma.business.update({
        where: { id: businessId },
        data: {
          planId: 1, // Downgrade automático al plan Básico
          planExpiresAt: null, // Limpiamos la expiración, el plan 1 es infinito
        },
      });

      // 2.2 Obtenemos los límites del plan básico para usarlos en esta petición
      const basicPlan = await this.prisma.plan.findUnique({
        where: { id: 1 },
        select: { limits: true },
      });

      if (basicPlan) {
        activeLimits = basicPlan.limits;
      }
    }

    const limitRecord = activeLimits.find((limit) => limit.type === action);

    // Si no hay un límite registrado, o el valor es null, es ilimitado
    if (!limitRecord || limitRecord.value === null) {
      return true;
    }

    const maxLimit = limitRecord.value;
    let currentUsage = 0;

    // 3. Consulta dinámica y específica solo para la acción solicitada
    switch (action) {
      case LimitType.PRODUCTS:
        currentUsage = await this.prisma.product.count({
          where: { inventory: { businessId } },
        });
        break;

      case LimitType.EMPLOYEES:
        currentUsage = await this.prisma.businessEmployee.count({
          where: { businessId },
        });
        break;

      case LimitType.MOVEMENTS:
        currentUsage = await this.prisma.movementHistory.count({
          where: { inventory: { businessId } },
        });
        break;

      case LimitType.SUPPLIERS:
        currentUsage = await this.prisma.supplier.count({
          where: { inventory: { businessId } },
        });
        break;

      case LimitType.SALES:
        currentUsage = await this.prisma.sale.count({
          where: { businessId },
        });
        break;

      case LimitType.PURCHASES:
        currentUsage = await this.prisma.purchase.count({
          where: { businessId },
        });
        break;

      case LimitType.EXPENSES:
        currentUsage = await this.prisma.expense.count({
          where: { businessId },
        });
        break;

      case LimitType.INVITATIONS:
        currentUsage = await this.prisma.businessInvite.count({
          where: { businessId },
        });
        break;

      case LimitType.IMAGES:
        // Evitamos un falso positivo. Si aún no controlamos imágenes, lanzamos un error
        // claro en lugar de devolver 0 siempre y permitir la subida infinita.
        throw new NotImplementedException(
          'La validación de límites de imágenes aún no está implementada.',
        );

      default:
        currentUsage = 0;
    }

    // 4. Validación considerando la cantidad a consumir (Ej: Entrada de múltiples productos)
    // Nota: A futuro (v2) esto se puede mover a una transacción atómica para evitar Race Conditions.
    if (currentUsage + amountToConsume > maxLimit) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'LIMIT_REACHED',
        limitType: action,
        limit: maxLimit,
        usage: currentUsage,
        attempted: amountToConsume,
        message: `Se ha alcanzado el límite de ${action.toLowerCase()}.`,
      });
    }

    return true;
  }

  /**
   * Calcula el periodo actual de 30 días para un negocio en base a su fecha de creación.
   */
  async getCurrentUsagePeriod(
    businessId: number,
  ): Promise<{ periodStart: Date; periodEnd: Date }> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { createdAt: true },
    });

    if (!business) {
      throw new BadRequestException(
        'No se encontró el negocio para calcular el periodo',
      );
    }

    const now = new Date();
    // 30 días expresados en milisegundos
    const msIn30Days = 30 * 24 * 60 * 60 * 1000;

    // Diferencia entre hoy y la fecha de creación del negocio
    const diffMs = now.getTime() - business.createdAt.getTime();

    // Cuántos ciclos enteros de 30 días han pasado
    const cyclesPassed = Math.floor(diffMs / msIn30Days);

    // Calculamos el inicio y fin del ciclo actual
    const periodStart = new Date(
      business.createdAt.getTime() + cyclesPassed * msIn30Days,
    );
    const periodEnd = new Date(periodStart.getTime() + msIn30Days);

    return { periodStart, periodEnd };
  }

  async getPlans() {
    const plans = await this.prisma.plan.findMany({
      include: {
        limits: true,
        permissions: true,
      },
    });
    return plans;
  }

  async validatePermission(businessId: number, permissions: Permission[]) {
    const business = await this.prisma.business.findUnique({
      where: {
        id: businessId,
      },
      select: {
        plan: {
          select: {
            permissions: {
              select: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const planPermissions =
      business.plan?.permissions.map((p) => p.permission) ?? [];

    const hasPermission = permissions.every((permission) =>
      planPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Tu plan no permite realizar esta acción');
    }

    return true;
  }

  async requestPlanUpgrade(
    userId: string,
    businessId: number,
    dto: CreatePlanRequestDto,
  ) {
    // 1. Validar que NO exista una solicitud PENDING para este negocio
    const existingRequest = await this.prisma.planUpgradeRequest.findFirst({
      where: {
        businessId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        'Ya tienes una solicitud de cambio de plan pendiente de aprobación.',
      );
    }

    // 2. Validar existencia del plan
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) throw new NotFoundException('El plan seleccionado no existe.');

    // 3. Crear registro de solicitud en BD
    const request = await this.prisma.planUpgradeRequest.create({
      data: {
        businessId,
        userId,
        planId: dto.planId,
        alias: dto.alias,
        comment: dto.comment,
      },
      include: {
        business: { select: { name: true } },
        user: { select: { email: true, username: true } },
        plan: { select: { name: true, price: true } },
      },
    });

    // 4. Notificar al admin por correo
    await this.mailService.sendPlanUpgradeRequestNotification({
      requestId: request.id,
      businessId,
      businessName: request.business.name,
      userEmail: request.user.email ?? "",
      planName: request.plan.name,
      amount: Number(request.plan.price),
      alias: dto.alias,
      comment: dto.comment,
    });

    return {
      message:
        'Solicitud enviada con éxito. Verificaremos la transferencia a la brevedad.',
      requestId: request.id,
    };
  }
}
