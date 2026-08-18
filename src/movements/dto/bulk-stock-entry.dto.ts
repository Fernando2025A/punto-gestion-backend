import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkStockEntryItemDto {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number; // Opcional: si el costo del lote cambió respecto al costo original
}

export class BulkStockEntryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStockEntryItemDto)
  items: BulkStockEntryItemDto[];

  @IsOptional()
  @IsInt()
  supplierId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
