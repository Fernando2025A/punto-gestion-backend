import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email'] as const),
) {
  @IsOptional()
  @IsInt()
  activeBusinessId?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
