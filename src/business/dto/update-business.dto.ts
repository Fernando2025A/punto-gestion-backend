import { IsString, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  description?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
