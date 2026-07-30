import { IsString, Length } from "class-validator";

export class LoggerDto {
  @IsString()
  @Length(3, 12)
  username: string;

  @Length(6, 14)
  @IsString()
  password: string;
}