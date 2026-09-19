#!/usr/bin/env node
// Regenerates the local store's DDL: deletes the migration folder, runs `drizzle-kit generate`
// into it, and copies the one migration file into a TypeScript module the app can import.
// The store is a cache and never migrates, so drizzle's journal and its migrations.js bundle
// (which would need the inline-import Babel plugin) are removed again.

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "src/lib/local-store/drizzle");
const generatedModule = join(root, "src/lib/local-store/ddl.generated.ts");

rmSync(migrationsDir, { recursive: true, force: true });
mkdirSync(migrationsDir, { recursive: true });

execFileSync("npx", ["drizzle-kit", "generate", "--name", "store"], {
  cwd: root,
  stdio: "inherit",
});

rmSync(join(migrationsDir, "meta"), { recursive: true, force: true });
rmSync(join(migrationsDir, "migrations.js"), { force: true });

const files = readdirSync(migrationsDir);
if (files.length !== 1 || !files[0].endsWith(".sql")) {
  throw new Error(`expected one migration file in ${migrationsDir}, found ${files.join(", ")}`);
}

const sql = readFileSync(join(migrationsDir, files[0]), "utf8");
const statements = sql
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

writeFileSync(
  generatedModule,
  [
    `// Generated from src/lib/local-store/drizzle by \`npm run store:ddl\`. Do not edit by hand.`,
    ``,
    `export const STORE_DDL: readonly string[] = [`,
    ...statements.map((statement) => `${JSON.stringify(statement)},`),
    `];`,
    ``,
  ].join("\n")
);

execFileSync("npx", ["prettier", "--write", generatedModule], { cwd: root, stdio: "inherit" });

console.log(`wrote ${statements.length} statements from ${files[0]}`);
