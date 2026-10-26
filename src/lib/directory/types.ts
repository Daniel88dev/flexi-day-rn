/** `GET /api/directory/organizations`, one row per organization whose directory concerns the viewer. */
export type DirectoryOrganization = {
  organizationId: string;
  name: string;
  role: "OWNER" | "ORGANIZATION_ADMIN" | "MEMBER";
  enabled: boolean;
  /** Enterprise or Custom right now; false on an enabled organization means lapsed. */
  writable: boolean;
  newAgreementVersionReady: boolean;
};

/** `INVITE_SENT` arrives with the directory invite; the phone draws it whenever it is sent. */
export type DirectoryMarker =
  "EXTERNAL_WORKER" | "NO_ACCOUNT" | "INVITE_SENT" | "ACCOUNT_DELETED" | "REJOINED";

export type DirectoryLabel = { id: string; name: string };

export type DirectorySectionKey = "card" | "photo" | "workContact" | "job" | "contact" | "personal";

/**
 * One row of the directory list. Job title, department and location arrive with later backend
 * tickets; until then they are absent and the row leaves them out.
 */
export type DirectoryPerson = {
  employmentId: string;
  name: string;
  image: string | null;
  user: { id: string; name: string; initials: string; avatarColor: string };
  markers: DirectoryMarker[];
  jobTitle?: string | null;
  department?: DirectoryLabel | null;
  location?: DirectoryLabel | null;
};

/** One ended spell. The next removal and the hold arrive with retention holds and removal dates. */
export type FormerDirectoryPerson = DirectoryPerson & {
  startedAt: string;
  endedAt: string;
  nextRemoval?: { section: DirectorySectionKey; date: string } | null;
  hold?: boolean;
};

export type DirectoryPeople = { people: DirectoryPerson[]; formerList: boolean };
