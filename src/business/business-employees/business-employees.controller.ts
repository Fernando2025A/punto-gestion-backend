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
import { UpdateEmployeePermissionsDto } from './dto/update-employee-permissions.dto';
import { UpdateEmployeeRoleDto } from './dto/update-employee-role.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';

@Controller('employees')
@UseGuards(PermissionsGuard)
export class BusinessEmployeesController {
  constructor(private readonly employeesService: BusinessEmployeesService) {}

  // GET /employees?businessId=1
  @Get()
  @Permissions(Permission.VIEW_EMPLOYEES)
  findAll(@Query('businessId', ParseIntPipe) businessId: number) {
    return this.employeesService.findAll(businessId);
  }

  // PATCH /employees/1/permissions?businessId=1
  @Patch(':id/permissions')
  @Permissions(Permission.MANAGE_EMPLOYEE_PERMISSIONS)
  updatePermissions(
    @Param('id', ParseIntPipe) employeeId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
    @Body() dto: UpdateEmployeePermissionsDto,
  ) {
    return this.employeesService.updatePermissions(employeeId, businessId, dto);
  }

  // PATCH /employees/1/role?businessId=1
  @Patch(':id/role')
  @Permissions(Permission.MANAGE_EMPLOYEE_ROLES)
  updateRole(
    @Param('id', ParseIntPipe) employeeId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
    @Body() dto: UpdateEmployeeRoleDto,
  ) {
    return this.employeesService.updateRole(employeeId, businessId, dto);
  }

  // PATCH /employees/1/status?businessId=1
  @Patch(':id/status')
  @Permissions(Permission.UPDATE_EMPLOYEES)
  updateStatus(
    @Param('id', ParseIntPipe) employeeId: number,
    @Query('businessId', ParseIntPipe) businessId: number,
    @Body() dto: UpdateEmployeeStatusDto,
  ) {
    return this.employeesService.updateStatus(employeeId, businessId, dto);
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
