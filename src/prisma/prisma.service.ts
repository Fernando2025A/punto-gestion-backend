import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // PrismaPg maneja internamente el pool con este objeto de configuración
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    super({ adapter });
  }

  async onModuleInit() {
    // Fuerza la conexión al arrancar la app para detectar errores de red de inmediato
    await this.$connect();
  }

  async onModuleDestroy() {
    // Cierra el pool de conexiones limpiamente al apagar NestJS
    await this.$disconnect();
  }
}
