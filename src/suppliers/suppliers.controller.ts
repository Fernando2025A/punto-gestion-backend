// src/suppliers/suppliers.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FindSupplierDto } from './dto/find-supplier.dto';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { Permission } from 'generated/prisma/enums';

@UseGuards(PermissionsGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Permissions(Permission.CREATE_SUPPLIERS)
  @Post()
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentUser('id') userId: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.suppliersService.create(createSupplierDto, userId, businessId);
  }

  @Permissions(Permission.VIEW_SUPPLIERS)
  @Get('business/:businessId')
  findAll(
    @Param('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Query() paginationDto: FindSupplierDto,
  ) {
    return this.suppliersService.findAll(userId, paginationDto, businessId);
  }

  @Permissions(Permission.VIEW_SUPPLIERS)
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.suppliersService.findOne(id, userId, businessId);
  }

  @Permissions(Permission.UPDATE_SUPPLIERS)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @CurrentUser('id') userId: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.suppliersService.update(
      id,
      updateSupplierDto,
      userId,
      businessId,
    );
  }

  @Permissions(Permission.DELETE_SUPPLIERS)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.suppliersService.remove(id, userId, businessId);
  }
}
