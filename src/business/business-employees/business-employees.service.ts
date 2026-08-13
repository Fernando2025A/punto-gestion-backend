import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateEmployeePermissionsDto } from './dto/update-employee-permissions.dto';
import { UpdateEmployeeRoleDto } from './dto/update-employee-role.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';

@Injectable()
export class BusinessEmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  // Listar empleados del negocio
  async findAll(businessId: number) {
    return this.prisma.businessEmployee.findMany({
      where: { businessId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  // Actualizar permisos
  async updatePermissions(
    employeeId: number,
    businessId: number,
    dto: UpdateEmployeePermissionsDto,
  ) {
    await this.ensureEmployeeBelongsToBusiness(employeeId, businessId);

    return this.prisma.businessEmployee.update({
      where: { id: employeeId },
      data: { permissions: dto.permissions },
    });
  }

  // Actualizar rol
  async updateRole(
    employeeId: number,
    businessId: number,
    dto: UpdateEmployeeRoleDto,
  ) {
    await this.ensureEmployeeBelongsToBusiness(employeeId, businessId);

    return this.prisma.businessEmployee.update({
      where: { id: employeeId },
      data: { role: dto.role },
    });
  }

  // Activar o Desactivar
  async updateStatus(
    employeeId: number,
    businessId: number,
    dto: UpdateEmployeeStatusDto,
  ) {
    await this.ensureEmployeeBelongsToBusiness(employeeId, businessId);

    return this.prisma.businessEmployee.update({
      where: { id: employeeId },
      data: { isActive: dto.isActive },
    });
  }

  // Eliminar empleado del negocio
  async remove(employeeId: number, businessId: number) {
    await this.ensureEmployeeBelongsToBusiness(employeeId, businessId);

    return this.prisma.businessEmployee.delete({
      where: { id: employeeId },
    });
  }

  private async ensureEmployeeBelongsToBusiness(
    employeeId: number,
    businessId: number,
  ) {
    const employee = await this.prisma.businessEmployee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.businessId !== businessId) {
      throw new NotFoundException('Empleado no encontrado en este negocio');
    }
  }
}
