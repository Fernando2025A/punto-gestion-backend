import { IsEnum } from 'class-validator';
import { EmployeeRole } from 'generated/prisma/enums';

export class UpdateEmployeeRoleDto {
  @IsEnum(EmployeeRole)
  role: EmployeeRole;
}
