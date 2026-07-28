import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StockEntryDto {
  @IsInt({ message: 'El ID del producto debe ser un número entero' })
  @IsNotEmpty({ message: 'El ID del producto es obligatorio' })
  @Type(() => Number)
  productId: number;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad ingresada debe ser de al menos 1' })
  @Type(() => Number)
  quantity: number;

  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsOptional()
  reason?: string;
}