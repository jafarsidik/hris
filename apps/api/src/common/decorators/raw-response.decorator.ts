import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'hris:raw-response';

/**
 * Opts a route out of the standard `{ success, data }` response envelope.
 *
 * Required for binary downloads, file streams and any endpoint whose body is
 * already a complete, well-known format (for example a CSV export).
 */
export const RawResponse = (): MethodDecorator & ClassDecorator => SetMetadata(RAW_RESPONSE_KEY, true);