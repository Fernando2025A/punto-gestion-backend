// user-cleanup.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserCleanupCronService {
  private readonly logger = new Logger(UserCleanupCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup() {
    this.logger.log('Ejecutando limpieza de usuarios y códigos expirados...');

    try {
      const now = new Date();
      // Límite de 24 horas atrás
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [deletedUsers, deletedCodes] = await Promise.all([
        // 1. Eliminar usuarios temporales vencidos O no verificados con +24hs de antigüedad
        this.prisma.user.deleteMany({
          where: {
            OR: [
              // Cuentas temporales expiradas
              {
                isTemporaly: true,
                OR: [{ expiresAt: { lt: now } }, { expiresAt: null }],
              },
              // Cuentas no verificadas creadas hace más de 24 horas
              {
                emailVerified: false,
                createdAt: { lt: twentyFourHoursAgo },
              },
            ],
          },
        }),

        // 2. Eliminar códigos de verificación vencidos
        this.prisma.verificationCode.deleteMany({
          where: {
            expiresAt: { lt: now },
          },
        }),
      ]);

      if (deletedUsers.count > 0) {
        this.logger.warn(
          `Limpieza de usuarios: Se eliminaron ${deletedUsers.count} usuario(s) (temporales o no verificados).`,
        );
      } else {
        this.logger.log('Limpieza de usuarios: Sin registros pendientes.');
      }

      if (deletedCodes.count > 0) {
        this.logger.warn(
          `Limpieza de códigos: Se eliminaron ${deletedCodes.count} código(s) de verificación expirado(s).`,
        );
      } else {
        this.logger.log('Limpieza de códigos: Sin registros pendientes.');
      }
    } catch (error) {
      this.logger.error(
        'Error durante la ejecución del cron job de limpieza:',
        error,
      );
    }
  }
}
