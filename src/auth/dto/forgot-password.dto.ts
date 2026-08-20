import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;
}
