import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MovementsModule } from 'src/movements/movements.module';
import { SuppliersModule } from 'src/suppliers/suppliers.module';
import { BusinessAccessModule } from 'src/business/business-access/business-access.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [
    PrismaModule,
    MovementsModule,
    CloudinaryModule,
    SuppliersModule,
    BusinessAccessModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
