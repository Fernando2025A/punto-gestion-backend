import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: true, credentials: true, },
  namespace: 'alerts',
})
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Mapa local en memoria (Útil solo cuando NO hay múltiples réplicas/nodos)
  private activeUsersMap = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) return client.disconnect(true);

      const decoded = this.jwtService.verify(token);
      const userId = String(decoded.sub || decoded.id);
      if (!userId) return client.disconnect(true);

      client.data.userId = userId;

      // Registrar socket en el mapa local
      if (!this.activeUsersMap.has(userId)) {
        this.activeUsersMap.set(userId, new Set());
      }
      this.activeUsersMap.get(userId)?.add(client.id);

      console.log(
        `[Alerts] Usuario ${userId} conectado con el socket ${client.id}`,
      );
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId && this.activeUsersMap.has(userId)) {
      const userSockets = this.activeUsersMap.get(userId);
      userSockets?.delete(client.id);

      // Limpiar la clave si ya no tiene pestañas/dispositivos abiertos
      if (userSockets?.size === 0) {
        this.activeUsersMap.delete(userId);
      }
    }
  }

  // Método helper opcional para saber en tiempo real si un usuario está en línea
  isUserOnline(userId: string): boolean {
    return (
      this.activeUsersMap.has(userId) &&
      this.activeUsersMap.get(userId)!.size > 0
    );
  }

  @SubscribeMessage('joinCompanyRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() businessIdInput: number | string,
  ) {
    const userId = client.data.userId;
    const businessId = Number(businessIdInput);

    if (!userId || isNaN(businessId)) return { success: false };

    const employee = await this.prisma.businessEmployee.findUnique({
      where: { userId_businessId: { userId, businessId } },
      select: { isActive: true },
    });

    if (!employee || !employee.isActive) {
      return { success: false, error: 'Sin permisos' };
    }

    // Incluso sin Redis, el sistema de Rooms de Socket.IO en memoria funciona perfecto
    client.join(`business_${businessId}`);
    return { success: true, room: `business_${businessId}` };
  }

  @OnEvent('business.alert')
  handleBusinessAlert(payload: any) {
    // La emisión nativa a salas de Socket.IO funciona nativamente en RAM
    this.server.to(`business_${payload.businessId}`).emit('notification', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }
}
