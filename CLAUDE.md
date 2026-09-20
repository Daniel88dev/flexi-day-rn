# CLAUDE.md

Guidance for Claude Code working in `flexi-day-rn`, the iPhone app of Flexi Day, a vacation/day-off
management product. Expo SDK 57 with Expo Router, React Native 0.86, TypeScript, NativeWind v5
(Tailwind v4 on native), expo-sqlite + Drizzle for the local store, better-auth's `expo` plugin
for the native session.

## Working style

Solo developer and owner, expert with this stack. Skip explanations of standard conventions and
framework basics. Be terse: show results rather than narrating the work. When several
implementation approaches are open, state which you chose and why. Propose a plan and wait for
approval before starting any non-trivial implementation.

## It is a client of a live backend

Every request goes to `flexi-day-be`. This repo holds no server code and no business rules the
backend already enforces. The local store is a projection of the server, never a source of truth,
and writes need connectivity. `CONTEXT.md` defines the words for that (local store, sync pull,
sync cursor, tombstone, sync reset, pending change, provisional row); use them, not synonyms.

## Continuous native generation

`ios/` is generated, gitignored, and never committed. `npm run prebuild` regenerates it from
`app.json`; `npm run ios` builds and runs the dev client through Xcode. A native change goes into
`app.json` or a config plugin, never into `ios/` by hand. Android is untouched for now: the code
stays cross-platform, but nothing is configured or tested there.

Bundle id `com.flexiday.app`, URL scheme `flexiday`, display name "Flexi Day". Device testing uses
a free Apple ID through Xcode (seven-day signing); there is no EAS, TestFlight or paid program.
The personal team id sits in `app.json` so prebuild signs without Xcode clicks; the phone setup,
the re-sign loop and how the app finds the backend are in
[`docs/device-testing.md`](docs/device-testing.md). `npm run ios` targets the simulator,
`npm run ios:device` the phone.
Scene support (`expo-build-properties`, `ios.enableSceneSupport`) stays on: iOS 27 kills an app
built with Xcode 27 that lacks it, and only a real phone shows that.

Adding a native module — `expo-sqlite`, `expo-secure-store`, `expo-crypto`, `expo-application`
and `expo-web-browser` are the ones here — means `npm run prebuild` and then `npm run ios` or
`npm run ios:device` to rebuild the dev client. Metro alone cannot load them, and the JavaScript
fails at the import with a missing native module until the rebuild lands. A non-interactive shell
has no UTF-8 `LANG`, and CocoaPods quits without one, so run `LANG=en_US.UTF-8 npm run prebuild`
there.

The backend base URL comes from `src/lib/api.ts`: `EXPO_PUBLIC_API_URL` when set, otherwise the
Metro host on port 8080. Never hardcode `localhost`; a phone cannot reach it.

## Styling is NativeWind v5, on a release candidate

`nativewind@5.0.0-rc.0` with `react-native-css@3.1.0-rc.0`, `tailwindcss@4.1.12`,
`@tailwindcss/postcss@4.1.12` and `lightningcss@1.30.1`, all pinned exactly
([`docs/adr/0001`](docs/adr/0001-nativewind-v5-release-candidate.md)). The stable `latest` tag is
v4 with Tailwind v3 and rejects OKLCH, so never install `nativewind` without the exact version.

- `src/global.css` is the Tailwind entry; Metro compiles it through `metro.config.js`. Import it
  once, in `src/app/_layout.tsx`.
- `src/theme.css` holds the design tokens, copied by hand from `flexi-day/app/globals.css`. The
  OKLCH strings stay identical to the web so the two `:root` blocks diff by eye. Accent variables
  are inlined and the dark block sits under `prefers-color-scheme`. A token change on the web is a
  copy-paste here, never a regeneration.
- Dark mode follows the system: `userInterfaceStyle` is `automatic` and the media query is the
  only switch. Never call `Appearance.setColorScheme`.
- Native `rem` is pinned to 16px in `theme.css`; radii are px. Shadows use NativeWind's
  `elevation-*` and `shadow-*` utilities, not the web's `--shadow-*` strings.
- The font files are embedded through the `expo-font` config plugin in `app.json`. Native text
  inherits nothing, so every text node goes through `Text` from `src/components/ui/text.tsx`,
  which adds `font-sans`.
- Never put an opacity modifier on a token. `bg-primary/10` compiles to `color-mix()` on this
  release and paints nothing. The primary tint has a utility of its own, `bg-accent`, because
  `--accent` is `var(--primary-soft)` in `src/theme.css`; warm, danger and ok have their own
  `*-soft` utilities; anything else takes an inline `opacity`, as `src/components/ui/logo.tsx`
  does for its halo.
- One radius scale for new screens, settled by the prototypes: `rounded-full` for buttons and
  links, 24 px for cards and slots, 16 px for tiles and rows, 12 px for fields. The `--radius-*`
  tokens are the web's derived values and only `rounded-lg` lands on the scale, so the rest are
  written as px, the way the fields use `rounded-[12px]`. The shell predates it: the dashboard
  cards are `rounded-2xl` and `rounded-3xl`, the More sheet is `rounded-t-[28px]` with its
  pressable rows at `rounded-2xl`, and moving them is open work.
- `className` only works on React Native core components. Third-party ones, including
  `SafeAreaView` from `react-native-safe-area-context`, silently drop it; use a `View` with the
  `pt-safe` / `pb-safe` utilities for safe areas instead.

## The native session

better-auth's client is `src/lib/session/auth-client.ts`: the `expo` plugin, on the app's URL
scheme with the storage prefix `flexi-day` and SecureStore as its storage, keeps the cookie jar
and the session cache in the Keychain, and the two-factor client plugin rides beside it. Screens
read the viewer through `useViewer()` rather than the client.

`createApiFetch` in `src/lib/api.ts` is the wrapper every `/api/*` call goes through, and no
screen builds a request of its own. It names the backend, attaches the Device id, the per-launch
session id, the platform and the app version (`src/lib/session/client-headers.ts`), carries the
cookie from the auth client's jar and omits the platform's own credentials, because iOS keeps a
cookie jar of its own and only this one may answer. The auth client sends sign-in, the session
lookup and sign-out itself, and its request hook attaches the same client headers.

`signedOutWipe()` in `src/lib/session/signed-out-wipe.ts` is the only way out. A 401 from the
wrapper, a session lookup that answers with none, and sign-out all end there: the cookie jar, the
session cache and the local store go, the Device id stays, and welcome says why. `signOut()` is
the one path that tells the server first, and it wipes whatever the server answers. Never clear a
piece of the session on its own.

`src/app/_layout.tsx` waits for the Device id, reads the expo plugin's session cache
(`src/lib/session/session-cache.ts`) and hands both to `rootRoute()`, which decides the launch
once: a cached session lands in `(app)`, none lands on `(auth)`'s welcome. The answer then lives
in `src/lib/session/root-route-context.tsx`, because sign-in, two-factor and the wipe all move
it; the guards read that, not the Keychain again.

The session revalidates against the server on the same foreground event the sync pull runs on,
from `src/lib/app-state.ts`, subscribed separately so neither waits for the other. Only an answer
that arrived and carries no session wipes: a server that faults or cannot be reached says nothing
about the session.

`EXPO_PUBLIC_WEB_URL` is the second environment variable, beside the backend URL above: the web
app that sign-up and password reset open in a browser sheet, `https://flexi-day.com` unless it is
set. Both are read as literal `process.env.EXPO_PUBLIC_*` expressions so Expo inlines them, and
both are documented in [`README.md`](README.md) and [`.env.example`](.env.example).

## The local store

`src/lib/local-store/` is one deep module: its `index.ts` is the whole interface and screens
import nothing else. The schema, the connection, the adapters and the generated DDL stay
unexported.

It is a cache, so it never migrates
([`docs/adr/0002`](docs/adr/0002-local-store-is-a-cache-never-migrated.md)). `drizzle-kit generate`
writes the one migration file in `src/lib/local-store/drizzle/`, and `npm run store:ddl`
regenerates it and copies it into `ddl.generated.ts`; neither is edited by hand. A schema change
is: edit `schema.ts`, run `npm run store:ddl`, which deletes that folder and regenerates it, then
bump `STORE_VERSION` in `version.ts`. On open, a `STORE_VERSION` that differs from
`PRAGMA user_version` deletes the file and creates it again, and the next sync pull refills it
from a snapshot. `__tests__/ddl-drift.test.ts` fails on a schema changed without a regeneration,
so the only step it cannot catch is the version bump.

Pending changes are never persisted. `pending.ts` keeps them in memory and the queries module lays
them over the rows they target; nothing about them reaches SQLite. A restart mid-request leaves
nothing behind and the next pull tells the truth. Never repair a lost pending change by writing it
to a table: that is the offline outbox this repo does not have. A write the server confirms without
sending rows writes a provisional row instead, and the after-write pull overwrites it.

The native session meets the store at three points. The user id passed to `openStore` comes from
the session, through `useViewer()` in
`src/app/(app)/_layout.tsx`; the store opens one fixed file, `flexi-day.db`, stamps that id into
`syncState`, and wipes and recreates the file when it opens with a different one. `apiFetch` in
`index.ts` is the request wrapper from `src/lib/api.ts`, so every call it makes carries the client
headers and whatever the auth client's cookie jar holds. A 401 reaches `handleUnauthorized()`, the
store's one overridable handler: the shell passes the signed-out wipe
(`src/lib/session/signed-out-wipe.ts`) through `openStore`, and the wipe calls `destroyStore()`
itself along with everything else the phone holds. The module's own default, a bare destroy, only
answers a request nobody opened the store for. The pull and the writes only report an unauthorized
answer in their own result; they no longer call the handler themselves. Keep the session out of the
rest of the module.

The seam is the Drizzle instance: expo-sqlite on the device, `better-sqlite3` in Jest, on the same
schema and the same DDL. Everything below the adapter is shared code, so the store's SQL is tested
without a device.

## Testing

- Jest with `jest-expo` and `@testing-library/react-native`: `npm run test`, `npm run test:watch`.
- Tests live next to their source in a `__tests__/` folder, except for anything under `src/app/`:
  Expo Router would turn a test file there into a route. Route files stay thin and their tests
  go in `src/__tests__/app/`.
- Every new function in `src/lib/` needs unit tests; every new component needs at least a smoke test.
- Naming: `describe("functionName")` with `it("returns …")`.
- CI runs lint, prettier, `tsc --noEmit` and the tests on every PR. There is no native build in CI.

## Formatting is automatic

`.claude/settings.json` runs `prettier --write` after every Write and Edit, so files reformat
immediately after you touch them. Take the reformatted version as current rather than re-editing
to restore your own spacing. A file written through Bash skips that hook; run `npm run format`.

## Branching

One feature = one branch named `feat/<feature-slug>`, sharing the slug with the same feature's
branch in `flexi-day-be` when it touches both. `main` is protected and merges by squash through a
PR only.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, reached with the `gh` CLI. See
[`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

The five canonical triage roles, each label string equal to its name. See
[`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See
[`docs/agents/domain.md`](docs/agents/domain.md).
