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

@UseGuards(PermissionsGuard)
@Controller('employees')
export class BusinessEmployeesController {
  constructor(private readonly employeesService: BusinessEmployeesService) {}

  // GET /employees?businessId=1
  @Get(':businessId')
  @Permissions(Permission.VIEW_EMPLOYEES)
  findAll(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() dto: PaginationDto,
  ) {
    return this.employeesService.findAll(businessId, dto);
  }

  // PATCH /employees/1?businessId=1
  @Patch(':id')
  @Permissions(Permission.UPDATE_EMPLOYEES)
  update(
    @Param('id', ParseIntPipe) employeeId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(employeeId, businessId, dto);
  }

  // DELETE /employees/1?businessId=1
  @Delete(':id')
  @Permissions(Permission.DELETE_EMPLOYEES)
  remove(
    @Param('id', ParseIntPipe) employeeId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
  ) {
    return this.employeesService.remove(employeeId, businessId);
  }
}
