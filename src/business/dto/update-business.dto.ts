import { IsString, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsUrl() // 👈 Valida que sea una URL válida
  imageUrl?: string;
}
