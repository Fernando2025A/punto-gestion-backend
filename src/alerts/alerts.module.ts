import { Module } from '@nestjs/common';
import { AlertsGateway } from './alerts.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule],
  providers: [AlertsGateway],
  exports: [AlertsGateway], // Útil si necesitas inyectar directamente el Gateway en otro servicio
})
export class AlertsModule {}
