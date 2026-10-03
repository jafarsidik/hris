import { SetMetadata, type CustomDecorator } from '@nestjs/common';

/**
 * Marks an endpoint as reachable without authentication.
 *
 * Every route is authenticated by default (see the global auth guard added in
 * phase 2). Public access must therefore be declared explicitly, so that adding
 * a controller cannot accidentally expose it.
 */
export const IS_PUBLIC_KEY = 'hris:public';

export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
