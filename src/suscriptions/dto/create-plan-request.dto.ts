import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePlanRequestDto {
  @IsInt()
  @IsNotEmpty()
  planId: number;

  @IsString()
  @IsNotEmpty()
  alias: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
