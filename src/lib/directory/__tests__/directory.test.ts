import {
  NO_DIRECTORY_FILTERS,
  directoryDate,
  directoryEntry,
  directoryFilterOptions,
  directoryFiltersMoved,
  directoryLapsed,
  directoryOrganizations,
  formerNewestFirst,
  isExternalWorker,
  labelName,
  rowMarkers,
  visibleDirectoryPeople,
} from "@/lib/directory";
import {
  directoryOrganization as org,
  directoryPerson as person,
  formerDirectoryPerson as former,
} from "@/test-support/directory";

describe("directoryEntry", () => {
  it("returns nothing for a viewer with no organization whose directory is on", () => {
    expect(directoryEntry([org("a", { enabled: false }), org("b", { enabled: false })])).toEqual({
      shown: false,
      readOnly: false,
    });
    expect(directoryEntry([])).toEqual({ shown: false, readOnly: false });
  });

  it("returns the entry for a viewer in one organization whose directory is on", () => {
    expect(directoryEntry([org("a", { enabled: false }), org("b")])).toEqual({
      shown: true,
      readOnly: false,
    });
  });

  it("returns a read-only entry once every directory organization has lapsed", () => {
    expect(directoryEntry([org("a", { writable: false })])).toEqual({
      shown: true,
      readOnly: true,
    });
    expect(directoryEntry([org("a", { writable: false }), org("b")])).toEqual({
      shown: true,
      readOnly: false,
    });
  });

  it("ignores a lapsed organization whose directory is off", () => {
    expect(directoryEntry([org("a", { enabled: false, writable: false }), org("b")])).toEqual({
      shown: true,
      readOnly: false,
    });
  });
});

const people = [
  person("eva", "Eva Horáková", {
    jobTitle: "Support specialist",
    department: { id: "d-sup", name: "Support", archived: false },
    location: { id: "l-brn", name: "Brno", archived: false },
  }),
  person("jonas", "Jonas Weber", {
    jobTitle: "Product designer",
    markers: ["EXTERNAL_WORKER"],
    department: { id: "d-eng", name: "Engineering", archived: false },
    location: { id: "l-ber", name: "Berlin", archived: false },
  }),
  person("jakub", "Jakub Procházka", {
    jobTitle: "Backend developer",
    department: { id: "d-eng", name: "Engineering", archived: false },
  }),
  person("ada", "Ada Novak"),
];

const names = (rows: { name: string }[]) => rows.map((row) => row.name);

describe("visibleDirectoryPeople", () => {
  it("returns everyone for an empty search and no filters", () => {
    expect(names(visibleDirectoryPeople(people, NO_DIRECTORY_FILTERS))).toEqual([
      "Eva Horáková",
      "Jonas Weber",
      "Jakub Procházka",
      "Ada Novak",
    ]);
  });

  it("returns the people whose name or job title holds the search, ignoring case and accents", () => {
    const search = (query: string) =>
      names(visibleDirectoryPeople(people, { ...NO_DIRECTORY_FILTERS, query }));

    expect(search("horakova")).toEqual(["Eva Horáková"]);
    expect(search("  PROCH ")).toEqual(["Jakub Procházka"]);
    expect(search("design")).toEqual(["Jonas Weber"]);
    expect(search("developer")).toEqual(["Jakub Procházka"]);
    expect(search("nobody")).toEqual([]);
  });

  it("returns the people in the picked department and location", () => {
    expect(
      names(visibleDirectoryPeople(people, { ...NO_DIRECTORY_FILTERS, departmentId: "d-eng" }))
    ).toEqual(["Jonas Weber", "Jakub Procházka"]);
    expect(
      names(
        visibleDirectoryPeople(people, {
          ...NO_DIRECTORY_FILTERS,
          departmentId: "d-eng",
          locationId: "l-ber",
        })
      )
    ).toEqual(["Jonas Weber"]);
  });

  it("returns employees or external workers by the External worker marker", () => {
    expect(
      names(visibleDirectoryPeople(people, { ...NO_DIRECTORY_FILTERS, type: "external" }))
    ).toEqual(["Jonas Weber"]);
    expect(
      names(visibleDirectoryPeople(people, { ...NO_DIRECTORY_FILTERS, type: "employee" }))
    ).toEqual(["Eva Horáková", "Jakub Procházka", "Ada Novak"]);
  });
});

describe("directoryFiltersMoved", () => {
  it("returns whether the search or a filter narrows the list", () => {
    expect(directoryFiltersMoved(NO_DIRECTORY_FILTERS)).toBe(false);
    expect(directoryFiltersMoved({ ...NO_DIRECTORY_FILTERS, query: "  " })).toBe(false);
    expect(directoryFiltersMoved({ ...NO_DIRECTORY_FILTERS, query: "eva" })).toBe(true);
    expect(directoryFiltersMoved({ ...NO_DIRECTORY_FILTERS, type: "external" })).toBe(true);
  });
});

describe("directoryFilterOptions", () => {
  it("returns each department and location the list carries once, by name", () => {
    expect(directoryFilterOptions(people)).toEqual({
      departments: [
        { id: "d-eng", name: "Engineering", archived: false },
        { id: "d-sup", name: "Support", archived: false },
      ],
      locations: [
        { id: "l-ber", name: "Berlin", archived: false },
        { id: "l-brn", name: "Brno", archived: false },
      ],
    });
  });

  it("returns no options while the server sends no department or location", () => {
    expect(directoryFilterOptions([person("ada", "Ada Novak")])).toEqual({
      departments: [],
      locations: [],
    });
  });
});

describe("directoryOrganizations", () => {
  it("returns only the organizations whose directory is on, in their order", () => {
    const rows = [org("o-a"), org("o-b", { enabled: false }), org("o-c", { writable: false })];

    expect(directoryOrganizations(rows).map((row) => row.organizationId)).toEqual(["o-a", "o-c"]);
  });
});

describe("directoryLapsed", () => {
  it("returns true only for a directory that is on under a plan that fails the gate", () => {
    expect(directoryLapsed(org("o-a", { writable: false }))).toBe(true);
    expect(directoryLapsed(org("o-a"))).toBe(false);
    expect(directoryLapsed(org("o-a", { enabled: false, writable: false }))).toBe(false);
    expect(directoryLapsed(undefined)).toBe(false);
  });
});

describe("isExternalWorker", () => {
  it("returns true only with the External worker marker", () => {
    expect(isExternalWorker(person("eli", "Eli", { markers: ["EXTERNAL_WORKER"] }))).toBe(true);
    expect(isExternalWorker(person("ada", "Ada", { markers: ["NO_ACCOUNT"] }))).toBe(false);
  });
});

describe("labelName", () => {
  const archived = (name: string) => `${name} (archived)`;

  it("returns the name, marked when the entry is archived", () => {
    expect(labelName({ id: "d-1", name: "Sales", archived: false }, archived)).toBe("Sales");
    expect(labelName({ id: "d-1", name: "Sales", archived: true }, archived)).toBe(
      "Sales (archived)"
    );
  });
});

describe("formerNewestFirst", () => {
  it("returns the server's order when the viewer gets no end dates", () => {
    const rows = [
      former("frank", "Frank", "x", { startedAt: null, endedAt: null }),
      former("carol", "Carol", "x", { startedAt: null, endedAt: null }),
    ];

    expect(formerNewestFirst(rows).map((row) => row.name)).toEqual(["Frank", "Carol"]);
  });

  it("returns the ended spells latest end first, one row per spell", () => {
    const rows = [
      former("carol", "Carol", "2026-06-30T00:00:00.000Z"),
      former("frank", "Frank", "2026-08-15T00:00:00.000Z"),
      former("carol-2", "Carol", "2025-01-31T00:00:00.000Z"),
    ];

    expect(formerNewestFirst(rows).map((row) => row.endedAt)).toEqual([
      "2026-08-15T00:00:00.000Z",
      "2026-06-30T00:00:00.000Z",
      "2025-01-31T00:00:00.000Z",
    ]);
  });
});

describe("rowMarkers", () => {
  it("returns the server's markers in a fixed order, and You on the viewer's own row", () => {
    const row = person("me", "Me", { markers: ["ACCOUNT_DELETED", "EXTERNAL_WORKER"] });

    expect(rowMarkers(row, "u-me")).toEqual(["EXTERNAL_WORKER", "ACCOUNT_DELETED", "YOU"]);
    expect(rowMarkers(row, "u-someone-else")).toEqual(["EXTERNAL_WORKER", "ACCOUNT_DELETED"]);
  });

  it("returns the hold first on a former row the server marks held", () => {
    const row = former("filip", "Filip", "2025-12-31T00:00:00.000Z", {
      hold: true,
      markers: ["ACCOUNT_DELETED", "REJOINED"],
    });

    expect(rowMarkers(row, "u-me")).toEqual(["RETENTION_HOLD", "ACCOUNT_DELETED", "REJOINED"]);
  });

  it("returns Invite sent once the server sends it, and never You for a person without an account", () => {
    const row = person("ada", "Ada", {
      markers: ["INVITE_SENT", "NO_ACCOUNT"],
      user: { id: "e-ada", name: "Ada", initials: "A", avatarColor: "#000" },
    });

    expect(rowMarkers(row, null)).toEqual(["NO_ACCOUNT", "INVITE_SENT"]);
  });
});

describe("directoryDate", () => {
  it("returns the day, short month and year in the dictionary's locale", () => {
    expect(directoryDate("en-GB", "2026-06-30T10:00:00.000Z")).toBe("30 Jun 2026");
    expect(directoryDate("cs-CZ", "2026-06-30T10:00:00.000Z")).toBe("30. 6. 2026");
  });
});
