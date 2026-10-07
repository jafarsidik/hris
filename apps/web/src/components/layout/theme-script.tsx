/**
 * Applies the saved theme before first paint.
 *
 * Runs inline, so it must carry the per-request CSP nonce that `middleware.ts` mints and
 * posts on the `x-nonce` request header; without it the script is blocked and the page
 * flashes the light theme before the toggle can react. The preference lives in
 * `localStorage` under the same key `ThemeToggle` writes, and the default is System, so a
 * reader who never chooses still follows their OS exactly as the previous media-query
 * scheme did.
 *
 * The script cannot be type-checked as JS inside a template literal, so it is kept tiny
 * and reviewed here rather than unit-tested: three reads and one class toggle.
 */
const THEME_SCRIPT = [
  '(function () {',
  '  var stored = null;',
  "  try { stored = window.localStorage.getItem('hris:theme'); } catch (_) {}",
  '  var dark =',
  "    stored === 'dark' ||",
  "    (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);",
  "  document.documentElement.classList.toggle('dark', dark);",
  '})();',
].join('\n');

export function ThemeScript({ nonce }: { nonce: string }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
