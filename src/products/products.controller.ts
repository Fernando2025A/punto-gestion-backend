import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { StockEntryDto } from 'src/movements/dto/stock-entry.dto';
import { StockExitDto } from 'src/movements/dto/stock-exit.dto';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { Permission } from 'generated/prisma/enums';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';

@UseGuards(PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Permissions(Permission.CREATE_PRODUCT)
  @Post()
  create(
    @CurrentUser('id') id: string,
    @Body() dto: CreateProductDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.create(dto, id, businessId);
  }

  @Permissions(Permission.VIEW_PRODUCT)
  @Get('business/:businessId')
  findAll(
    @CurrentUser('id') userId: string,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() paginationDto: FindProductsDto,
  ) {
    return this.productsService.findAll(userId, paginationDto, businessId);
  }

  // 🟢 Entrada de stock (ej: PATCH /products/stock-entry)
  @Permissions(Permission.REGISTER_STOCK_ENTRY)
  @Patch('stock-entry')
  recordStockEntry(
    @CurrentUser('id') id: string,
    @Body() dto: StockEntryDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.recordStockEntry(dto, id, businessId);
  }

  // 🔴 Salida de stock (ej: PATCH /products/stock-exit)
  @Permissions(Permission.REGISTER_STOCK_EXIT)
  @Patch('stock-exit')
  recordStockExit(
    @CurrentUser('id') id: string,
    @Body() dto: StockExitDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.recordStockExit(dto, id, businessId);
  }

  @Permissions(Permission.DELETE_PRODUCT)
  @Delete(':id')
  delete(
    @CurrentUser('id') id: string,
    @Param('id', ParseIntPipe) productId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.delete(id, productId, businessId);
  }

  @Permissions(Permission.VIEW_PRODUCT)
  @Get(':name')
  findOne(
    @CurrentUser('id') id: string,
    @Param('name') productName: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.findOne(id, productName, businessId);
  }

  // ⚠️ Los endpoints con :id deben ir SIEMPRE al final de las rutas del mismo método HTTP
  @Permissions(Permission.UPDATE_PRODUCT)
  @Patch(':id')
  update(
    @CurrentUser('id') id: string,
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.update(dto, id, productId, businessId);
  }
}
