import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MovementsModule } from 'src/movements/movements.module';
import { SuppliersModule } from 'src/suppliers/suppliers.module';

@Module({
  imports: [PrismaModule, MovementsModule, SuppliersModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
