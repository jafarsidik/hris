/**
 * Mobile runtime configuration.
 *
 * Values come from `EXPO_PUBLIC_*` environment variables, which Expo inlines at
 * bundle time. There is deliberately no second copy of these URLs in
 * `app.json`, so the build environment stays the single source of truth.
 */

export const API_BASE_URL =
  process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3001/api/v1';

export const API_PLATFORM_URL =
  process.env['EXPO_PUBLIC_API_PLATFORM_URL'] ?? 'http://localhost:3001';

/**
 * Timeout applied to every mobile API call.
 *
 * Field devices routinely lose connectivity; failing fast lets the sync engine
 * move work to the offline queue instead of leaving a spinner on screen.
 */
export const API_TIMEOUT_MS = 15_000;

/**
 * Maximum accepted clock skew between the device and the server before an
 * offline capture is treated as suspect.
 *
 * Attendance taken far from the authoritative clock can silently corrupt payroll
 * inputs, so the server re-validates and can reject a record outright.
 */
export const MAX_CAPTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
