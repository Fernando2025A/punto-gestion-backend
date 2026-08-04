import { IsOptional, IsString, Length } from 'class-validator';

export class LoggerDto {
  @IsOptional()
  @IsString()
  @Length(3, 255)
  identifier?: string;

  @IsOptional()
  @IsString()
  @Length(3, 255)
  username?: string;

  @Length(6, 72)
  @IsString()
  password: string;
}