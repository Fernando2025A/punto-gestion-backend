import { IsEnum, IsInt, Min, IsOptional } from 'class-validator';
import { EmployeeRole } from 'generated/prisma/enums';

export class CreateInviteDto {
  @IsEnum(EmployeeRole)
  role: EmployeeRole;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxUses?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  expiresInMinutes?: number = 60; // 👈 Opcional: por defecto 60 minutos (1 hora)
}
