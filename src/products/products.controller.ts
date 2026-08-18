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
  UploadedFile,
  UseGuards,
  UseInterceptors,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { BulkStockExitDto } from 'src/movements/dto/bulk-stock-exit.dto';
import { BulkStockEntryDto } from 'src/movements/dto/bulk-stock-entry.dto';

@UseGuards(PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Permissions(Permission.CREATE_PRODUCT)
  @Post()
  @UseInterceptors(FileInterceptor('file')) // 👈 Intercepta la imagen enviada con la key 'file'
  async create(
    @CurrentUser('id') id: string,
    @Body() dto: CreateProductDto,
    @Query('businessId', ParseIntPipe) businessId: number,
    @UploadedFile() file?: Express.Multer.File, // 👈 Recibimos el archivo opcional
  ) {
    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file);
      dto.imageUrl = uploadResult.secure_url;
    }

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

  @Permissions(Permission.REGISTER_STOCK_ENTRY)
  @Patch('stock-entry/bulk/:businessId')
  async recordBulkStockEntry(
    @Param('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Body() dto: BulkStockEntryDto,
  ) {
    return await this.productsService.bulkStockEntry(dto, userId, businessId);
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

  @Permissions(Permission.REGISTER_STOCK_EXIT)
  @Patch('stock-exit/bulk/:businessId')
  async recordBulkStockExit(
    @Param('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Body() dto: BulkStockExitDto,
  ) {
    return await this.productsService.bulkStockExit(dto, userId, businessId);
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
  @UseInterceptors(FileInterceptor('file')) // 👈 Intercepta la imagen enviada con la key 'file'
  async update(
    @CurrentUser('id') id: string,
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
    @Query('businessId', ParseIntPipe) businessId: number,
    @UploadedFile() file?: Express.Multer.File, // 👈 Recibimos el archivo opcional
  ) {
    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file);
      dto.imageUrl = uploadResult.secure_url;
    }

    return this.productsService.update(dto, id, productId, businessId);
  }
}
