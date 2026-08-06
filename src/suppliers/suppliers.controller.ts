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
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FindSupplierDto } from './dto/find-supplier.dto';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentUser('id') userId: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.suppliersService.create(createSupplierDto, userId, businessId);
  }

  @Get('business/:id')
  findAll(
    @Param('id', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Query() paginationDto: FindSupplierDto,
  ) {
    return this.suppliersService.findAll(userId, paginationDto, businessId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.suppliersService.findOne(id, userId, businessId);
  }

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

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: string,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.suppliersService.remove(id, userId, businessId);
  }
}
