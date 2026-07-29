import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del proveedor es obligatorio' })
  name: string;

  @IsString()
  @IsOptional()
  contact?: string; // Teléfono, email o persona de contacto
}
