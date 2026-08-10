import { IsDate, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class PeriodDto {
  @IsNotEmpty({ message: 'La fecha de inicio es requerida' })
  @Type(() => Date)
  @IsDate({ message: 'startDate debe ser una fecha válida (ej. YYYY-MM-DD)' })
  startDate: Date;

  @IsNotEmpty({ message: 'La fecha de fin es requerida' })
  @Type(() => Date)
  @IsDate({ message: 'endDate debe ser una fecha válida (ej. YYYY-MM-DD)' })
  endDate: Date;
}
