import { IsArray, IsEnum } from 'class-validator';
import { Permission } from 'generated/prisma/enums';

export class UpdateEmployeePermissionsDto {
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
