import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BusinessEmployeesService } from './business-employees.service';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { Permission } from 'generated/prisma/enums';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PaginationDto } from './dto/pagination.dto';
import { PaginationFilterDto } from './dto/pagination-filter.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@UseGuards(PermissionsGuard)
@Controller('employees')
export class BusinessEmployeesController {
  constructor(private readonly employeesService: BusinessEmployeesService) {}

  @Get(':businessId')
  @Permissions(Permission.VIEW_EMPLOYEES)
  findAllFilter(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() dto: PaginationFilterDto,
  ) {
    const pagination: PaginationDto = {
      limit: dto.limit,
      page: dto.page,
    };
    return this.employeesService.findAll(
      businessId,
      pagination,
      dto.role,
      dto.isActive,
    );
  }

  // PATCH /employees/1?businessId=1
  @Patch(':id')
  @Permissions(Permission.UPDATE_EMPLOYEES)
  update(
    @Param('id', ParseIntPipe) employeeId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('email') email: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(employeeId, businessId, dto, email);
  }

  // DELETE /employees/1?businessId=1
  @Delete(':id')
  @Permissions(Permission.DELETE_EMPLOYEES)
  remove(
    @Param('id', ParseIntPipe) employeeId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('email') email: string,
  ) {
    return this.employeesService.remove(employeeId, businessId, email);
  }
}
