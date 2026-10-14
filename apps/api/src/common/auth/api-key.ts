/**
 * API key wire format.
 *
 * A key is `hris_ak_<clientId>.<secret>`. The public `clientId` is safe to log and is
 * used as the lookup handle; the `secret` is high-entropy and is the only part that is
 * a credential. The prefix lets the authentication guard recognise an API key before it
 * is mistaken for an opaque session token.
 */
export const API_KEY_PREFIX = 'hris_ak_';

export interface ParsedApiKey {
  readonly clientId: string;
  readonly secret: string;
}

/** Splits a presented key into its public handle and secret, or returns null. */
export function parseApiKey(presented: string): ParsedApiKey | null {
  if (!presented.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  const separatorIndex = presented.indexOf('.');
  if (separatorIndex <= API_KEY_PREFIX.length || separatorIndex === presented.length - 1) {
    return null;
  }
  return {
    clientId: presented.slice(0, separatorIndex),
    secret: presented.slice(separatorIndex + 1),
  };
}
