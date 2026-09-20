import type { Viewer } from "@/lib/viewer/use-viewer";

/** The person the signed-in tests are. better-auth ids are 32 alphanumeric characters. */
export const VIEWER: Viewer = {
  id: "kXk2Q7pR9sT1vW3yZ5aB7cD9eF1gH3iJ",
  name: "Dana Kučerová",
  email: "dana@northwind.co",
};

/** What the expo client's `useSession()` answers for that person. */
export const SESSION = { data: { user: VIEWER } };
