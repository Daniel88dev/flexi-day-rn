# Context: flexi-day-rn

The vacation/day-off domain as the phone sees it. The backend's glossary in
`flexi-day-be/CONTEXT.md` owns the domain terms (vacation, group, quota, organization); this file
adds only the terms the mobile client coins. Use the backend's words for everything else.

## Glossary

| Term                | Meaning                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Local store**     | The on-device SQLite database holding everything the signed-in user can see on the web, partitioned by organization. Sign-out empties it. Avoid: cache, offline database.                                                                              |
| **Sync pull**       | One request to the backend's delta endpoint for every row changed since the sync cursor, across all the user's organizations. Runs on app foreground (debounced 30 s, except cold start and sign-in), on pull-to-refresh, and after a confirmed write. |
| **Sync cursor**     | The position the last sync pull reached, kept in the local store and sent on the next pull. Avoid: last sync time, watermark.                                                                                                                          |
| **Tombstone**       | A row the sync pull returns for a soft-deleted record, so the local store can drop its copy. Avoid: deletion marker.                                                                                                                                   |
| **Sync reset**      | Defined in `flexi-day-be/CONTEXT.md`; the local store applies one by generation sweep.                                                                                                                                                                 |
| **Pending change**  | A write shown at once as an overlay on the rows it targets while its request is in flight. Lifts on the server's answer, or after a timeout with a toast. Never stored, never survives a restart. Avoid: optimistic update, outbox.                    |
| **Provisional row** | A row the local store holds in the state the server just confirmed but has not yet sent back, written when a write returns no row. The next sync pull overwrites it. Avoid: optimistic row.                                                            |

## Boundaries

- This repo is a client of `flexi-day-be`. It holds no server code and no business rules the
  backend already enforces.
- The local store is a projection of the server, never a source of truth. There is no offline
  outbox: a write needs connectivity.
- Decisions scoped to this repo live in [`docs/adr/`](docs/adr/).
