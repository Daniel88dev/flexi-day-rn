export type DirectoryOrganization = {
  organizationId: string;
  name: string;
  role: "OWNER" | "ORGANIZATION_ADMIN" | "MEMBER";
  enabled: boolean;
  /** Enterprise or Custom right now; false on an enabled organization means lapsed. */
  writable: boolean;
  newAgreementVersionReady: boolean;
};

export type DirectoryMarker =
  "EXTERNAL_WORKER" | "NO_ACCOUNT" | "INVITE_SENT" | "ACCOUNT_DELETED" | "REJOINED";

/** A Department or Location; an archived one still shows on the record that holds it. */
export type DirectoryLabel = { id: string; name: string; archived: boolean };

export type DirectorySectionKey = "card" | "photo" | "workContact" | "job" | "contact" | "personal";

export type DirectoryPerson = {
  employmentId: string;
  name: string;
  image: string | null;
  /** The small signed link of the Profile photo; null without one or without Photo. */
  photoUrl: string | null;
  /** `id` is null on a record without an account; key such a row by `employmentId`. */
  user: { id: string | null; name: string; initials: string; avatarColor: string };
  markers: DirectoryMarker[];
  jobTitle: string | null;
  department: DirectoryLabel | null;
  location: DirectoryLabel | null;
};

export type FormerDirectoryPerson = DirectoryPerson & {
  /** Null when the viewer can't read Job; the server still sends the list newest end first. */
  startedAt: string | null;
  endedAt: string | null;
  /** Null under a hold. */
  nextRemoval: { section: DirectorySectionKey; date: string } | null;
  hold: boolean;
};

export type DirectoryPeople = { people: DirectoryPerson[]; formerList: boolean };

export type DirectorySectionLevel = "READ" | "WRITE";
type SectionView = { level: DirectorySectionLevel };

export type DirectoryCountry = { code: string; name: string };

/** E.164 for `tel:` links and the server's international display form, never formatted here. */
export type DirectoryPhone = { e164: string; display: string; country: DirectoryCountry | null };

export type DirectoryCardView = SectionView & {
  jobTitle: string | null;
  /** `name` is null when the viewer can't reach that person. */
  reportsTo: { employmentId: string; name: string | null } | null;
  department: DirectoryLabel | null;
  location: (DirectoryLabel & { country: DirectoryCountry | null }) | null;
};

export type DirectoryWorkContactView = SectionView & {
  workEmail: string | null;
  workPhone: DirectoryPhone | null;
};

export type ContractType = "PERMANENT" | "FIXED_TERM" | "APPRENTICESHIP" | "INTERNSHIP" | "OTHER";
export type WorkingTime = "FULL_TIME" | "PART_TIME";

export type DirectoryJobView = SectionView & {
  spell: { startedAt: string; endedAt: string | null };
  legalName: string | null;
  employeeNumber: string | null;
  /** `YYYY-MM-DD` calendar days. */
  startDate: string | null;
  leavingDate: string | null;
  probationEndDate: string | null;
  contractType: ContractType | null;
  workingTime: WorkingTime | null;
};

export type DirectoryPhotoView = SectionView & {
  photo: { smallUrl: string; fullUrl: string } | null;
};

export type SensitiveSectionKey = "contact" | "personal";

export type EmergencyContact = { name: string; phone: DirectoryPhone };

export type ContactValues = {
  privatePhone: DirectoryPhone | null;
  privateEmail: string | null;
  emergencyContact1: EmergencyContact | null;
  emergencyContact2: EmergencyContact | null;
};

export type HomeAddress = {
  line1: string;
  line2: string | null;
  postalCode: string | null;
  city: string;
  region: string | null;
  country: DirectoryCountry;
};

/** Personal's values, only ever in a Show answer. `dateOfBirth` is a `YYYY-MM-DD`. */
export type PersonalValues = { homeAddress: HomeAddress | null; dateOfBirth: string | null };

export type ShownSection =
  | ({ section: "CONTACT"; level: DirectorySectionLevel; recorded: boolean } & ContactValues)
  | ({ section: "PERSONAL"; level: DirectorySectionLevel; recorded: boolean } & PersonalValues);

/** `date` is a `YYYY-MM-DD`: the nightly run that empties the Section, or the day a purge did. */
export type SectionRetention =
  | { status: "REMOVES_ON" | "REMOVED_ON"; date: string }
  | { status: "KEPT_UNTIL_ERASED" | "ON_HOLD" };

export type ProfileRetention = {
  hold: { setAt: string; setBy: { userId: string; name: string | null } | null } | null;
  sections: Partial<Record<DirectorySectionKey, SectionRetention>>;
};

export type DirectoryAccountStatus = "ACTIVE" | "NO_ACCOUNT" | "DELETED";

/** Which profile: one spell in one organization's directory. A `DirectoryProfile` is one too. */
export type ProfileRef = { organizationId: string; employmentId: string };

/**
 * `GET /api/directory/{organizationId}/people/{employmentId}`. A Section key is present only when
 * the viewer reads it; Contact and Personal never carry values here.
 */
export type DirectoryProfile = DirectoryPerson & {
  organizationId: string;
  self: boolean;
  ended: boolean;
  sections: {
    card?: DirectoryCardView;
    photo?: DirectoryPhotoView;
    workContact?: DirectoryWorkContactView;
    job?: DirectoryJobView;
    contact?: SectionView;
    personal?: SectionView;
  };
  /** On an ended record, for the owner, org admins and HR. */
  retention?: ProfileRetention;
  account?: {
    status: DirectoryAccountStatus;
    signInEmail: string | null;
    directoryRoles: ("HR" | "LEADERSHIP")[];
  };
};
