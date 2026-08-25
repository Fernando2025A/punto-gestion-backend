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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
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

@ApiTags('Productos')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Permissions(Permission.CREATE_PRODUCT)
  @Post()
  @ApiOperation({ summary: 'Crear un nuevo producto con imagen opcional' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'businessId', type: Number, description: 'ID del negocio' })
  @ApiResponse({ status: 201, description: 'Producto creado exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o límite de plan alcanzado.',
  })
  @ApiResponse({
    status: 404,
    description: 'El inventario del negocio no existe.',
  })
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @CurrentUser('id') id: string,
    @Body() dto: CreateProductDto,
    @Query('businessId', ParseIntPipe) businessId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file);
      dto.imageUrl = uploadResult.secure_url;
    }

    return this.productsService.create(dto, id, businessId);
  }

  @Permissions(Permission.VIEW_PRODUCT)
  @Get('business/:businessId')
  @ApiOperation({ summary: 'Obtener listado paginado y filtrado de productos' })
  @ApiParam({ name: 'businessId', type: Number, description: 'ID del negocio' })
  @ApiResponse({
    status: 200,
    description: 'Lista de productos obtenida exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'El inventario del negocio no existe.',
  })
  findAll(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() paginationDto: FindProductsDto,
  ) {
    return this.productsService.findAll(paginationDto, businessId);
  }

  @Permissions(Permission.REGISTER_STOCK_ENTRY)
  @Patch('stock-entry')
  @ApiOperation({ summary: 'Registrar una entrada de stock individual' })
  @ApiQuery({ name: 'businessId', type: Number, description: 'ID del negocio' })
  @ApiResponse({
    status: 200,
    description: 'Entrada de stock registrada exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'El inventario del negocio no existe.',
  })
  recordStockEntry(
    @CurrentUser('id') id: string,
    @Body() dto: StockEntryDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.recordStockEntry(dto, id, businessId);
  }

  @Permissions(Permission.REGISTER_STOCK_ENTRY)
  @Patch('stock-entry/bulk/:businessId')
  @ApiOperation({
    summary: 'Registrar entradas de stock de forma masiva (Bulk)',
  })
  @ApiParam({ name: 'businessId', type: Number, description: 'ID del negocio' })
  @ApiResponse({
    status: 200,
    description: 'Entradas de stock masivas registradas con éxito.',
  })
  @ApiResponse({
    status: 404,
    description: 'El inventario del negocio no existe.',
  })
  async recordBulkStockEntry(
    @Param('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Body() dto: BulkStockEntryDto,
  ) {
    return await this.productsService.bulkStockEntry(dto, userId, businessId);
  }

  @Permissions(Permission.REGISTER_STOCK_EXIT)
  @Patch('stock-exit')
  @ApiOperation({ summary: 'Registrar una salida de stock individual' })
  @ApiQuery({ name: 'businessId', type: Number, description: 'ID del negocio' })
  @ApiResponse({
    status: 200,
    description: 'Salida de stock registrada exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'El inventario del negocio no existe.',
  })
  recordStockExit(
    @CurrentUser('id') id: string,
    @Body() dto: StockExitDto,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.recordStockExit(dto, id, businessId);
  }

  @Permissions(Permission.REGISTER_STOCK_EXIT)
  @Patch('stock-exit/bulk/:businessId')
  @ApiOperation({
    summary: 'Registrar salidas de stock de forma masiva (Bulk)',
  })
  @ApiParam({ name: 'businessId', type: Number, description: 'ID del negocio' })
  @ApiResponse({
    status: 200,
    description: 'Salidas de stock masivas registradas con éxito.',
  })
  @ApiResponse({
    status: 404,
    description: 'El inventario del negocio no existe.',
  })
  async recordBulkStockExit(
    @Param('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Body() dto: BulkStockExitDto,
  ) {
    return await this.productsService.bulkStockExit(dto, userId, businessId);
  }

  @Permissions(Permission.DELETE_PRODUCT)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un producto por su ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID numérico del producto',
  })
  @ApiQuery({ name: 'businessId', type: Number, description: 'ID del negocio' })
  @ApiResponse({ status: 200, description: 'Producto eliminado exitosamente.' })
  @ApiResponse({
    status: 404,
    description: 'El producto o el inventario no existe.',
  })
  delete(
    @CurrentUser('id') id: string,
    @Param('id', ParseIntPipe) productId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.delete(id, productId, businessId);
  }

  @Permissions(Permission.VIEW_PRODUCT)
  @Get(':name')
  @ApiOperation({
    summary: 'Buscar un producto específico por su nombre exacto',
  })
  @ApiParam({ name: 'name', type: String, description: 'Nombre del producto' })
  @ApiQuery({ name: 'businessId', type: Number, description: 'ID del negocio' })
  @ApiResponse({ status: 200, description: 'Detalle del producto encontrado.' })
  @ApiResponse({
    status: 404,
    description: 'El producto o el inventario no existe.',
  })
  findOne(
    @Param('name') productName: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.productsService.findOne(productName, businessId);
  }

  @Permissions(Permission.UPDATE_PRODUCT)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar los datos e imagen de un producto' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID numérico del producto',
  })
  @ApiQuery({ name: 'businessId', type: Number, description: 'ID del negocio' })
  @ApiResponse({
    status: 200,
    description: 'Producto actualizado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validación fallida (ej: categoría FOOD sin fecha de expiración).',
  })
  @ApiResponse({
    status: 404,
    description: 'El producto o el inventario no existe.',
  })
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @CurrentUser('id') id: string,
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductDto,
    @Query('businessId', ParseIntPipe) businessId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file);
      dto.imageUrl = uploadResult.secure_url;
    }

    return this.productsService.update(dto, id, productId, businessId);
  }
}
