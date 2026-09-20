import { authClient } from "@/lib/session/auth-client";

export type Viewer = { id: string; name: string; email: string };

/**
 * Who the shell greets, read from the session the expo client cached, so a cold start knows
 * the viewer before the backend answers. The id is what the Local store is keyed by.
 */
export function useViewer(): Viewer | null {
  const user = authClient.useSession().data?.user;
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email };
}
