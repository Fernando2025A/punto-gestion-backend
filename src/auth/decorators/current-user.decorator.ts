import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Retorna `req.user` o una propiedad específica de `user`.
 * Ejemplos:
 *  - `@CurrentUser() user`
 *  - `@CurrentUser('id') id`
 */
export const CurrentUser = createParamDecorator(
  (data?: string, ctx?: ExecutionContext) => {
    const req = ctx?.switchToHttp().getRequest();
    const user = req?.user;
    if (!data) return user;
    return user ? user[data] : undefined;
  },
);
