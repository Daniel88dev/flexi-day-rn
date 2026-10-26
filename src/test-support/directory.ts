import type {
  DirectoryOrganization,
  DirectoryPerson,
  FormerDirectoryPerson,
} from "@/lib/directory";

export function directoryOrganization(
  organizationId: string,
  patch: Partial<DirectoryOrganization> = {}
): DirectoryOrganization {
  return {
    organizationId,
    name: `Org ${organizationId}`,
    role: "MEMBER",
    enabled: true,
    writable: true,
    newAgreementVersionReady: false,
    ...patch,
  };
}

export function directoryPerson(
  id: string,
  name: string,
  patch: Partial<DirectoryPerson> = {}
): DirectoryPerson {
  const initials = name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    employmentId: `e-${id}`,
    name,
    image: null,
    user: { id: `u-${id}`, name, initials, avatarColor: "#7c6cf0" },
    markers: [],
    ...patch,
  };
}

export function formerDirectoryPerson(
  id: string,
  name: string,
  endedAt: string,
  patch: Partial<FormerDirectoryPerson> = {}
): FormerDirectoryPerson {
  return {
    ...directoryPerson(id, name),
    startedAt: "2024-01-01T00:00:00.000Z",
    endedAt,
    ...patch,
  };
}
