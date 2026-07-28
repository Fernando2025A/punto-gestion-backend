import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MovementsModule } from 'src/movements/movements.module';

@Module({
  imports: [PrismaModule, MovementsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
