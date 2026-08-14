import { IsEnum, IsBoolean, IsArray, IsOptional } from 'class-validator';
import { EmployeeRole, Permission } from 'generated/prisma/enums';

export class UpdateEmployeeDto {
  @IsEnum(EmployeeRole)
  @IsOptional()
  role?: EmployeeRole;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsEnum(Permission, { each: true })
  @IsOptional()
  permissions?: Permission[];
}
