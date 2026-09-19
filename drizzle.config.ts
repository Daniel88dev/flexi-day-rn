import { defineConfig } from "drizzle-kit";

// The local store is a cache with no migrations: `npm run store:ddl` regenerates the one
// migration file this folder holds and copies it into the generated TypeScript module.
export default defineConfig({
  dialect: "sqlite",
  driver: "expo",
  schema: "./src/lib/local-store/schema.ts",
  out: "./src/lib/local-store/drizzle",
});
