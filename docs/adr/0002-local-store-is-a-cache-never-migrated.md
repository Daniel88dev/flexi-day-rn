# ADR 0002: Rebuild the local store on a schema change instead of migrating it

Date: 2026-09-19. Status: accepted.

## Context

`src/lib/local-store/` holds an expo-sqlite database whose tables are column-for-column the rows
the backend's sync pull returns, plus a `generation` stamp of the store's own that the pull never
carries. Every row in it came from the server and can be asked for again: the store is a
projection, and the next sync pull refills it from a snapshot. Nothing on the phone is the only
copy of anything. Pending changes live in memory, and there is no offline outbox.

That leaves the usual mobile question of what an app update does when `schema.ts` changes. The
normal answer is a migration folder with a journal, `drizzle-kit generate` per change, and a
`migrate()` call on open. On Expo that answer costs more than it looks: drizzle's `migrations.js`
bundle needs the inline-import Babel plugin, and on SDK 57 an empty statement reaching `migrate()`
segfaults every cold start. It would also be code written to preserve data nobody needs to keep.
Research:
https://github.com/Daniel88dev/flexi-day-workspace/blob/main/docs/research/expo-sqlite-drizzle.md

## Decision

The store is a cache and never migrates. A schema change deletes the file and rebuilds it.

- `STORE_VERSION` in `version.ts` is the shape of the file on disk. `createStoreLifecycle` in
  `lifecycle.ts` compares it with `PRAGMA user_version` on open, and a mismatch deletes the file,
  creates it again from the generated DDL, and stamps the new version. A stored user id that is
  not the session's is treated the same way, which also covers a half-failed wipe.
- The DDL is one committed migration file, `src/lib/local-store/drizzle/0000_store.sql`.
  `npm run store:ddl` (`scripts/generate-store-ddl.mjs`) deletes that folder, runs
  `drizzle-kit generate` with the expo driver from `drizzle.config.ts`, deletes `meta/` and
  `migrations.js` again, splits the SQL on drizzle's statement breakpoints, and writes the
  statements into `ddl.generated.ts`. Neither file is edited by hand.
- There is no `migrate()` call and no journal. `lifecycle.ts` runs `STORE_DDL` statement by
  statement against a fresh file, which is the only state it ever sees.
- `__tests__/ddl-drift.test.ts` asserts that the drizzle folder holds exactly one `.sql` file,
  that `STORE_DDL` equals its statements, and that `drizzle-kit generate` into a temp directory
  produces the same statements from the current `schema.ts`. A schema change that skips
  `npm run store:ddl` fails there.

The file also carries no encryption beyond what iOS gives it. SQLCipher was considered and
declined:

- The rows are what the signed-in user already reads on the web, so an attacker who can read them
  can read them by signing in.
- The database sits inside the app sandbox under iOS data protection, and `destroyStore()` deletes
  it on sign-out, so a shared or resold phone keeps nothing.
- SQLCipher means a native dependency, a patched build of expo-sqlite, and a key to store in the
  keychain and rotate. That is real work against a threat the first two points already cover.

## Consequences

- A schema change is three steps: edit `schema.ts`, run `npm run store:ddl`, bump `STORE_VERSION`.
  Forgetting the second fails the drift test; forgetting the third ships a file the app opens with
  the wrong tables.
- The first launch after such an update pulls a full snapshot. The store is empty while it runs, so
  the dashboard shows "Syncing…" for one pull. No data is lost, because none of it was only here.
- The migration folder stays a single file forever. Both the generation script and the drift test
  refuse more than one, which is the point: a second file would mean somebody started keeping
  history.
- This holds only while the store is a pure projection. A feature that lets the phone hold a write
  the server has not seen, an offline outbox above all, reopens this ADR and the encryption
  question with it.
