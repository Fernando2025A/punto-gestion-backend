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
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    return this.productsService.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() paginationDto: FindProductsDto,
  ) {
    return this.productsService.findAll(user, paginationDto);
  }

  // 🟢 Entrada de stock (ej: PATCH /products/stock-entry)
  @Patch('stock-entry')
  recordStockEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StockEntryDto,
  ) {
    return this.productsService.recordStockEntry(dto, user);
  }

  // 🔴 Salida de stock (ej: PATCH /products/stock-exit)
  @Patch('stock-exit')
  recordStockExit(@CurrentUser() user: JwtPayload, @Body() dto: StockExitDto) {
    return this.productsService.recordStockExit(dto, user);
  }

  // ⚠️ Los endpoints con :id deben ir SIEMPRE al final de las rutas del mismo método HTTP
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(dto, user, productId);
  }

  @Delete(':id')
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) productId: number,
  ) {
    return this.productsService.delete(user, productId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) productId: number,
  ) {
    return this.productsService.findOne(user, productId);
  }
}
