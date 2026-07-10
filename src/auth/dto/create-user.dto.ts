import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(3, 12)
  @IsNotEmpty()
  username: string;

  @IsString()
  @Length(6, 14)
  @IsNotEmpty()
  password: string;
}
