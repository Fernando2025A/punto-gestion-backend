import { IsNumber } from 'class-validator';

export class UpgradePlanDto {
  @IsNumber()
  businessId: number;

  @IsNumber()
  planId: number;
}
