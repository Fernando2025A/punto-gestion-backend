// user-cleanup.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service'; // Ajustá la ruta según tu proyecto

@Injectable()
export class UserCleanupCronService {
  private readonly logger = new Logger(UserCleanupCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanupTemporaryUsers() {
    this.logger.log('Ejecutando limpieza de usuarios temporales expirados...');

    try {
      const now = new Date();

      // Borrado en lote directo en la Base de Datos
      // Elimina usuarios que sean isTemporaly = true Y cuyo expiresAt ya haya pasado (expiresAt < now)
      // O cuya fecha de expiración haya sido configurada a más de 24 horas de su creación
      const deleteResult = await this.prisma.user.deleteMany({
        where: {
          isTemporaly: true,
          OR: [
            // Cuentas cuya fecha de expiración ya transcurrió
            {
              expiresAt: {
                lt: now,
              },
            },
            // Cuentas donde expiresAt es nulo o inválido
            {
              expiresAt: null,
            },
          ],
        },
      });

      if (deleteResult.count > 0) {
        this.logger.warn(
          `Limpieza completada: Se eliminaron ${deleteResult.count} usuario(s) temporal(es) y todos sus datos asociados.`,
        );
      } else {
        this.logger.log(
          'Limpieza completada: No se encontraron usuarios temporales para eliminar.',
        );
      }
    } catch (error) {
      this.logger.error(
        'Error durante la ejecución del cron job de limpieza de usuarios:',
        error,
      );
    }
  }
}
