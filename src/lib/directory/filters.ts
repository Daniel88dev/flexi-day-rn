import type { DirectoryLabel, DirectoryPerson } from "./types";

export type WorkerTypeFilter = "employee" | "external";

export type DirectoryFilters = {
  query: string;
  departmentId: string | null;
  locationId: string | null;
  type: WorkerTypeFilter | null;
};

export const NO_DIRECTORY_FILTERS: DirectoryFilters = {
  query: "",
  departmentId: null,
  locationId: null,
  type: null,
};

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Lower case without diacritics, so "horakova" finds "Horáková" as it does on the web. */
function fold(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

export const isExternalWorker = (person: DirectoryPerson) =>
  person.markers.includes("EXTERNAL_WORKER");

export function directoryFiltersMoved(filters: DirectoryFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.departmentId !== null ||
    filters.locationId !== null ||
    filters.type !== null
  );
}

/** Search covers name and job title; the chips narrow by department, location and worker type. */
export function visibleDirectoryPeople<TPerson extends DirectoryPerson>(
  people: readonly TPerson[],
  filters: DirectoryFilters
): TPerson[] {
  const query = fold(filters.query.trim());
  return people.filter((person) => {
    if (query && ![person.name, person.jobTitle ?? ""].some((text) => fold(text).includes(query)))
      return false;
    if (filters.departmentId !== null && person.department?.id !== filters.departmentId)
      return false;
    if (filters.locationId !== null && person.location?.id !== filters.locationId) return false;
    if (filters.type !== null && isExternalWorker(person) !== (filters.type === "external"))
      return false;
    return true;
  });
}

function distinctByName(labels: (DirectoryLabel | null | undefined)[]): DirectoryLabel[] {
  const byId = new Map<string, DirectoryLabel>();
  for (const label of labels) if (label && !byId.has(label.id)) byId.set(label.id, label);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The Department and Location chips offer what the list carries; with nothing there, no chip. */
export function directoryFilterOptions(people: readonly DirectoryPerson[]): {
  departments: DirectoryLabel[];
  locations: DirectoryLabel[];
} {
  return {
    departments: distinctByName(people.map((person) => person.department)),
    locations: distinctByName(people.map((person) => person.location)),
  };
}
