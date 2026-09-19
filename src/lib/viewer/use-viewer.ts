export type Viewer = { id: string; name: string; email: string };

/**
 * Who the shell greets. The native session does not exist yet, so this answers with a placeholder
 * rather than pretending to read one; the sign-in work replaces the body, not the signature. The
 * id is what the local store is keyed by, so the first real session wipes the placeholder's store.
 */
export function useViewer(): Viewer | null {
  return { id: "placeholder-viewer", name: "Dana Kučerová", email: "dana@northwind.co" };
}
