import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseCategory } from 'generated/prisma/enums';

export class CreateExpenseDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  occurredAt?: Date;

  @IsEnum(ExpenseCategory)
  @IsNotEmpty()
  category: ExpenseCategory;
}
