import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { STORE_DDL } from "../ddl.generated";

const REPO_ROOT = join(__dirname, "../../../..");
const MIGRATIONS_DIR = join(REPO_ROOT, "src/lib/local-store/drizzle");
const SCHEMA = "./src/lib/local-store/schema.ts";

function statementsOf(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function committedMigration(): string {
  const files = readdirSync(MIGRATIONS_DIR);
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/\.sql$/);
  return readFileSync(join(MIGRATIONS_DIR, files[0]), "utf8");
}

describe("STORE_DDL", () => {
  it("matches the committed migration file", () => {
    expect(STORE_DDL).toEqual(statementsOf(committedMigration()));
  });

  it("matches what drizzle-kit generates from the current schema", () => {
    const out = mkdtempSync(join(tmpdir(), "flexi-ddl-"));
    try {
      execFileSync(
        "npx",
        // prettier-ignore
        ["drizzle-kit", "generate", "--dialect", "sqlite", "--driver", "expo",
         "--schema", SCHEMA, "--out", out, "--name", "store"],
        { cwd: REPO_ROOT, stdio: "pipe" }
      );
      const regenerated = readFileSync(join(out, "0000_store.sql"), "utf8");
      expect(statementsOf(regenerated)).toEqual(STORE_DDL);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 120_000);
});
