import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MovementReason, PaymentMethod } from 'generated/prisma/enums'; // Ajusta la ruta a tu enum

export class StockExitDto {
  @IsNotEmpty({ message: 'El ID del producto es obligatorio' })
  @IsInt({ message: 'El ID del producto debe ser un número entero' })
  @Type(() => Number)
  productId: number;

  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad a descontar debe ser de al menos 1' })
  @Type(() => Number)
  quantity: number;

  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @IsEnum(MovementReason, {
    message: 'El motivo debe ser un valor válido del tipo de movimiento',
  })
  reason: MovementReason;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena de texto' })
  notes?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: 'El método de pago no es válido',
  })
  paymentMethod?: PaymentMethod;
}
