import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { Category } from 'generated/prisma/enums';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsEnum(Category)
  @IsNotEmpty()
  category: Category;
}
