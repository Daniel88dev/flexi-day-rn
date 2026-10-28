import { directoryLapsed } from "./entry";
import type {
  DirectoryOrganization,
  DirectoryPerson,
  DirectoryPhone,
  DirectoryProfile,
  DirectorySectionKey,
  ProfileRef,
  SectionRetention,
} from "./types";

/** The order the profile scrolls in, which the Retention block follows too. */
export const PROFILE_SECTIONS: DirectorySectionKey[] = [
  "card",
  "photo",
  "workContact",
  "job",
  "contact",
  "personal",
];

/** A list row's picture: the Profile photo's small link, then the Account picture, then initials. */
export const rowPicture = (person: DirectoryPerson): string | null =>
  person.photoUrl ?? person.image ?? null;

/** The header's picture in full size. Only a Profile photo opens the full-screen viewer. */
export function headerPicture(profile: DirectoryProfile): {
  uri: string | null;
  viewable: boolean;
} {
  const photo = profile.sections.photo?.photo;
  if (photo) return { uri: photo.fullUrl, viewable: true };
  return { uri: rowPicture(profile), viewable: false };
}

export type ContactButtons = { call: string | null; message: string | null; email: string | null };

/** Call, Message and Email from Work contact only; none on a former profile. */
export function contactButtons(profile: DirectoryProfile): ContactButtons | null {
  const workContact = profile.sections.workContact;
  if (profile.ended || !workContact) return null;
  const phone = workContact.workPhone?.e164 ?? null;
  return {
    call: phone ? `tel:${phone}` : null,
    message: phone ? `sms:${phone}` : null,
    email: workContact.workEmail ? `mailto:${workContact.workEmail}` : null,
  };
}

export type ProfileValue =
  | { kind: "phone"; phone: DirectoryPhone; copyable: boolean }
  | { kind: "email"; email: string; copyable: boolean };

export type ValueAction = { kind: "call" | "email"; url: string } | { kind: "copy"; text: string };

/**
 * What tapping a value offers. Copy only for Work contact, so a private or emergency number never
 * reaches the clipboard, which Universal Clipboard syncs to the person's other devices.
 */
export function valueActions(value: ProfileValue): ValueAction[] {
  const open: ValueAction =
    value.kind === "phone"
      ? { kind: "call", url: `tel:${value.phone.e164}` }
      : { kind: "email", url: `mailto:${value.email}` };
  if (!value.copyable) return [open];
  return [open, { kind: "copy", text: value.kind === "phone" ? value.phone.display : value.email }];
}

/** The web page that edits one profile. The query string is built by hand: RN's polyfill. */
export const profileEditPath = ({ organizationId, employmentId }: ProfileRef) =>
  `/directory/person/edit/?organizationId=${encodeURIComponent(organizationId)}&employmentId=${encodeURIComponent(employmentId)}`;

/** The notice on the viewer's own profile, which sends edits to the web. */
export function selfNotice(
  profile: DirectoryProfile,
  organization: DirectoryOrganization | undefined
): { lapsed: boolean; editPath: string } | null {
  if (!profile.self) return null;
  return {
    lapsed: directoryLapsed(organization),
    editPath: profileEditPath(profile),
  };
}

/** A Section heading's removal date, or the day a purge emptied it. */
export function sectionRetention(
  profile: DirectoryProfile,
  section: DirectorySectionKey
): { removesOn: string | null; removedOn: string | null } {
  const entry = profile.retention?.sections[section];
  return {
    removesOn: entry?.status === "REMOVES_ON" ? entry.date : null,
    removedOn: entry?.status === "REMOVED_ON" ? entry.date : null,
  };
}

/** The Retention block's lines: every Section the server says something about, in order. */
export function retentionLines(
  profile: DirectoryProfile
): { section: DirectorySectionKey; retention: SectionRetention }[] {
  const sections = profile.retention?.sections;
  if (!sections) return [];
  return PROFILE_SECTIONS.flatMap((section) => {
    const retention = sections[section];
    return retention ? [{ section, retention }] : [];
  });
}
