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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { JwtPayload } from 'src/auth/jwt-payload.interface';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { StockEntryDto } from 'src/movements/dto/stock-entry.dto';
import { StockExitDto } from 'src/movements/dto/stock-exit.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @CurrentUser('id') id: string,
    @Body() dto: CreateProductDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.create(dto, id, businessId);
  }

  @Get('business/:businessId')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() paginationDto: FindProductsDto,
  ) {
    return this.productsService.findAll(user, paginationDto, businessId);
  }

  // 🟢 Entrada de stock (ej: PATCH /products/stock-entry)
  @Patch('stock-entry')
  recordStockEntry(
    @CurrentUser('id') id: string,
    @Body() dto: StockEntryDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.recordStockEntry(dto, id, businessId);
  }

  // 🔴 Salida de stock (ej: PATCH /products/stock-exit)
  @Patch('stock-exit')
  recordStockExit(
    @CurrentUser('id') id: string,
    @Body() dto: StockExitDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.recordStockExit(dto, id, businessId);
  }

  // ⚠️ Los endpoints con :id deben ir SIEMPRE al final de las rutas del mismo método HTTP
  @Patch(':id')
  update(
    @CurrentUser('id') id: string,
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.update(dto, id, productId, businessId);
  }

  @Delete(':id')
  delete(
    @CurrentUser('id') id: string,
    @Param('id', ParseIntPipe) productId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.delete(id, productId, businessId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('id') id: string,
    @Param('id', ParseIntPipe) productId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.findOne(id, productId, businessId);
  }
}
