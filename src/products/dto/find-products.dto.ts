import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Category } from 'generated/prisma/enums';

export class FindProductsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 12;

  @IsOptional()
  @IsEnum(Category, { message: 'La categoría proporcionada no es válida' })
  category?: Category;

  @IsOptional()
  @IsString()
  search?: string;
}