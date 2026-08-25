import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SessionCodeDto {
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  code: string;
}
