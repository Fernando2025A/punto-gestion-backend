import { Injectable, NotFoundException } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async updateBusinessPlan(businessId: number, planId: number) {
    // 1. Validar que el plan exista en la base de datos
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(`El plan con ID ${planId} no existe`);
    }

    // 2. Calcular la fecha de expiración (30 días desde el momento actual)
    const planExpiresAt = new Date();
    planExpiresAt.setDate(planExpiresAt.getDate() + 30);

    // 3. Actualizar el plan y la fecha de vencimiento del negocio
    try {
      const updatedBusiness = await this.prisma.business.update({
        where: { id: businessId },
        data: {
          planId,
          planExpiresAt,
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          owner: {
            select: {
              email: true,
            },
          },
        },
      });

      // 4. Enviar email al dueño del negocio si cuenta con un correo registrado
      if (updatedBusiness.owner?.email) {
        await this.mailService.sendPlanUpgradedNotification(
          updatedBusiness.owner.email,
          updatedBusiness.name,
          updatedBusiness.plan.name,
          planExpiresAt,
        );
      }

      return {
        message: `Plan del negocio "${updatedBusiness.name}" actualizado a ${plan.name} por 30 días.`,
        business: updatedBusiness,
      };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(
          `El negocio con ID ${businessId} no existe`,
        );
      }
      throw error;
    }
  }
}
