import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MovementReason } from 'generated/prisma/enums'; // Ajusta la ruta a tu enum

export class StockEntryDto {
  @IsNotEmpty({ message: 'El ID del producto es obligatorio' })
  @IsInt({ message: 'El ID del producto debe ser un número entero' })
  @Type(() => Number)
  productId: number;

  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad ingresada debe ser de al menos 1' })
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena de texto' })
  notes?: string;

  // Campos opcionales para cuando el motivo sea PURCHASE (Compra a Proveedor)
  @IsOptional()
  @IsInt({ message: 'El ID del proveedor debe ser un número entero' })
  @Type(() => Number)
  supplierId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El costo unitario debe ser un número' })
  @Min(0, { message: 'El costo unitario no puede ser negativo' })
  @Type(() => Number)
  unitCost?: number;
}
