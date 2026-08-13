import { SetMetadata } from '@nestjs/common';
import { Permission } from 'generated/prisma/enums';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorador para requerir uno o más permisos en endpoints de Controllers.
 * Ejemplo de uso: @Permissions(Permission.CREATE_PRODUCT, Permission.UPDATE_PRODUCT)
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
