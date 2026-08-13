import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsDateString,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Category } from 'generated/prisma/enums';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purchasePrice: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stock: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minimumStock?: number;

  @IsEnum(Category)
  @IsNotEmpty()
  category: Category;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  supplierId?: number; // 👈 Opcional

  @IsOptional()
  @IsDateString() // Valida formato YYYY-MM-DD o ISO8601
  expirationDate?: string;
}
