# ADR 0008: shadcn/ui and Tailwind CSS for the web tier

- **Status**: Accepted
- **Date**: 2026-10-03

## Context

The web application was built with hand-rolled presentational components in a shared
`@hris/ui` workspace package: `Card`, `Button`, `Badge` and `Text`, each carrying its
own inline `style` objects, plus a token module duplicated into `globals.css` as
`--hris-*` custom properties.

Two problems had already surfaced.

The token duplication was a drift risk by construction. The same palette existed in
`packages/ui/src/tokens.ts` and again in `apps/web/src/app/globals.css`, joined only by
a comment asking the two to stay aligned. Nothing enforced it.

More fundamentally, a shared component package was the wrong shape for this system.
`@hris/ui` had exactly one consumer, `apps/web`, because the mobile client is React
Native and consumes `StyleSheet` objects rather than CSS classes. React Native cannot
share a Tailwind or CSS-token component at all, so the package was not shared
across platforms in any meaningful sense — it was a web package with extra indirection.

Meanwhile a strict nonce-based Content-Security-Policy had just been adopted (ADR
0007). That raises the cost of any approach relying on client-side theming.

## Decision

1. **The web tier uses Tailwind CSS v4 with shadcn/ui.** Theme values live as CSS custom
   properties in `apps/web/src/app/globals.css` and are exposed to utilities through
   `@theme inline`. There is no JavaScript theme object and no token module in
   TypeScript.
2. **shadcn/ui components are source files owned by the application**, in
   `apps/web/src/components/ui`, generated with `npx shadcn@latest add <name>` and
   committed. They are not a dependency.
3. **`@hris/ui` is deleted.** The build wiring that referenced it is removed from the
   root `build:packages` script and the web `prebuild`/`predev` hooks.
4. **Dark mode follows the operating system** via `prefers-color-scheme`. A manual theme
   toggle is deferred.
5. **The `cn()` helper is local** (`apps/web/src/lib/utils.ts`, `clsx` plus
   `tailwind-merge`), not the separate `cn` package the CLI installs by default.

## Rationale

**Tailwind is a prerequisite, not a preference.** shadcn/ui components are Tailwind
class strings. There is no version of this decision that keeps a CSS-in-JS or
inline-style component system alongside it, and two coexisting styling systems drift.

**Owned source is the entire point of shadcn/ui.** The components exist so they can be
edited in place. Publishing them as a versioned package reintroduces exactly the
problem this change removes: upgrades require a release, and the code still cannot be
adjusted to the application's own needs.

**The CSP forced the theming decision.** The canonical shadcn dark-mode setup uses
`next-themes`, which injects an inline `<script>` to set a class on `<html>` before
hydration. ADR 0007 sets `script-src` to `'self' 'nonce-…' 'strict-dynamic'` with no
`'unsafe-inline'`, so that script would be blocked and the page would render in the
wrong theme. Passing the nonce through to `ThemeProvider` would work, but it adds a
client-side provider to every page for a capability nobody has asked for yet.
`prefers-color-scheme` needs no script at all, so the existing automatic dark mode was
preserved rather than replaced.

**`cn()` stays local and inspectable.** `tailwind-merge` is what makes caller
overrides actually work; without it a later `p-2` loses to a component's `p-6` because
Tailwind emits rules in a fixed cascade order. Keeping the helper in the repository
means the reason is documented in the file rather than hidden in a dependency.

**One Base UI caveat worth recording.** The current shadcn CLI (4.x, `base-nova` style)
generates components against `@base-ui/react`, not Radix, and its generated imports
referenced a `cn` package it installs. Both were normalised on import: the primitive
library is a declared dependency, and the class helper is local. The generated
components work in React Server Components without a `'use client'` boundary, which was
verified against the production build rather than assumed.

## Consequences

**Accepted costs**

- The unit test count drops from 203 to 194. `@hris/ui` accounted for the 9-test
  difference. This is removal of retired code, not lost coverage of live code.
- Design tokens now exist only in CSS. A consumer that needs them in TypeScript — a
  chart library, an email template — has to read them from the cascade rather than
  import them.
- Component styling is expressed as utility strings, which are less greppable than a
  central stylesheet. Tailwind's `@source` scan roots in `globals.css` are declared
  explicitly for this reason; classes in files outside the scan silently produce no CSS.
- Upgrading a shadcn component means re-running the CLI and reviewing the diff against
  local modifications, not bumping a version range.

## Notes for maintainers

`CardTitle` renders a `div`, so pages supply the heading element themselves
(`<CardTitle><h2>…</h2></CardTitle>`). The previous `@hris/ui` `Card` rendered an `h2`
for its title specifically so the document outline stayed navigable by screen reader
users. Preserving that is the caller's responsibility now, and it is easy to forget.

`--color-success` is not part of the shadcn token set. It was added because the
platform status surface must report a healthy system in green, and reusing `primary`
would render a healthy system in brand blue. The matching `success` variant on `Badge`
is likewise a local addition.

Do not reintroduce a `next-themes` provider without threading the CSP nonce to it.
See ADR 0007 and the comment in `globals.css`.