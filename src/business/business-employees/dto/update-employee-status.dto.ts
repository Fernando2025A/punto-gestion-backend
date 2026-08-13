import { IsBoolean } from 'class-validator';

export class UpdateEmployeeStatusDto {
  @IsBoolean()
  isActive: boolean;
}
