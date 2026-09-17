# ADR 0001: Style with the NativeWind v5 release candidate

Date: 2026-09-17. Status: accepted.

## Context

The web frontend defines its design tokens as Tailwind v4 CSS: an `@theme inline` block and OKLCH
colour values in `flexi-day/app/globals.css`. The phone should reuse those tokens so a colour
change on the web is a copy-paste here.

NativeWind has two live lines. Stable `nativewind@4.2.7` is a Tailwind v3 engine: JS config, and
it drops every `oklch()` value with an "Invalid color unit" warning, so the tokens would have to
be converted to a hex table and kept in sync by hand. The `nativewind@5.0.0-rc.0` release
candidate runs Tailwind v4 CSS config and converts OKLCH to hex at build time. It targets Expo
SDK 57 by name. Research:
https://github.com/Daniel88dev/flexi-day-workspace/blob/main/docs/research/nativewind-tokens.md

## Decision

Start on the v5 release candidate, pinned exactly:

| Package                | Version      |
| ---------------------- | ------------ |
| `nativewind`           | `5.0.0-rc.0` |
| `react-native-css`     | `3.1.0-rc.0` |
| `tailwindcss`          | `4.1.12`     |
| `@tailwindcss/postcss` | `4.1.12`     |
| `lightningcss`         | `1.30.1`     |

Tokens are ported by hand into `src/theme.css` with the OKLCH strings copied verbatim from the web,
the accent variables inlined, and the dark block under `prefers-color-scheme` on `:root`. Dark
mode follows the system; the app never calls `Appearance.setColorScheme`.

## Consequences

- The pins stay exact until NativeWind v5 goes stable. Lifting them is its own issue in this repo.
- The `latest` npm tag will not move during the RC, so `npm install nativewind` without a version
  would downgrade to v4. Always install with the exact version.
- Retreat path if the RC misbehaves: `nativewind@4.2.7` with `tailwindcss@~3.4`, tokens as a hex
  table in `tailwind.config.js` (the research doc carries the converted table), `darkMode` left
  at its `media` default. The StyleSheet-with-generated-tokens fallback is retired.
