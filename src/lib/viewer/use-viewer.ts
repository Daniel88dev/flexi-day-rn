export type Viewer = { name: string; email: string };

/**
 * Who the shell greets. The native session does not exist yet, so this answers with a placeholder
 * rather than pretending to read one; the sign-in work replaces the body, not the signature.
 */
export function useViewer(): Viewer | null {
  return { name: "Dana Kučerová", email: "dana@northwind.co" };
}
