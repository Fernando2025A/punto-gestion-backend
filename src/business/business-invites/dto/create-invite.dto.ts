import { IsEnum, IsInt, Min, IsOptional, NotEquals } from 'class-validator';
import { EmployeeRole } from 'generated/prisma/enums';

export class CreateInviteDto {
  @IsEnum(EmployeeRole)
  @NotEquals(EmployeeRole.OWNER, {
    message: 'No es posible crear invitaciones para el rol OWNER',
  })
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
