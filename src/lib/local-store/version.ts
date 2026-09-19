/**
 * The shape of the file on disk. A mismatch with `PRAGMA user_version` deletes and recreates the
 * store, so a schema change means: edit `schema.ts`, run `npm run store:ddl`, bump this.
 */
export const STORE_VERSION = 1;
