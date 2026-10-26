import {
  contactButtons,
  directoryDate,
  headerPicture,
  profileEditPath,
  retentionLines,
  rowPicture,
  sectionRetention,
  selfNotice,
  valueActions,
  type DirectoryProfile,
} from "@/lib/directory";
import {
  directoryOrganization as org,
  directoryPerson as person,
  directoryProfile as profile,
} from "@/test-support/directory";

const PHONE = { e164: "+420602111061", display: "+420 602 111 061", country: null };

describe("rowPicture", () => {
  it("returns the Profile photo before the Account picture", () => {
    expect(
      rowPicture(person("a", "Ann", { photoUrl: "https://s/small", image: "https://acct" }))
    ).toBe("https://s/small");
  });

  it("returns the Account picture without a Profile photo, and null for initials", () => {
    expect(rowPicture(person("a", "Ann", { image: "https://acct" }))).toBe("https://acct");
    expect(rowPicture(person("a", "Ann"))).toBeNull();
  });
});

describe("headerPicture", () => {
  it("returns the full-size Profile photo, which opens the viewer", () => {
    const shown = profile("a", "Ann", {
      photoUrl: "https://s/small",
      image: "https://acct",
      sections: {
        photo: { level: "READ", photo: { smallUrl: "https://s/small", fullUrl: "https://s/full" } },
      },
    });
    expect(headerPicture(shown)).toEqual({ uri: "https://s/full", viewable: true });
  });

  it("returns the Account picture, which opens nothing, when no Profile photo is readable", () => {
    expect(headerPicture(profile("a", "Ann", { image: "https://acct" }))).toEqual({
      uri: "https://acct",
      viewable: false,
    });
    expect(
      headerPicture(profile("a", "Ann", { sections: { photo: { level: "READ", photo: null } } }))
    ).toEqual({ uri: null, viewable: false });
  });
});

describe("contactButtons", () => {
  it("returns Call, Message and Email from Work contact", () => {
    const shown = profile("a", "Ann", {
      sections: { workContact: { level: "READ", workEmail: "ann@acme.cz", workPhone: PHONE } },
    });
    expect(contactButtons(shown)).toEqual({
      call: "tel:+420602111061",
      message: "sms:+420602111061",
      email: "mailto:ann@acme.cz",
    });
  });

  it("returns null for a button whose value is empty", () => {
    const shown = profile("a", "Ann", {
      sections: { workContact: { level: "READ", workEmail: null, workPhone: PHONE } },
    });
    expect(contactButtons(shown)).toEqual({
      call: "tel:+420602111061",
      message: "sms:+420602111061",
      email: null,
    });
  });

  it("returns no row for a viewer without Work contact or on a former profile", () => {
    expect(contactButtons(profile("a", "Ann"))).toBeNull();
    const former = profile("a", "Ann", {
      ended: true,
      sections: { workContact: { level: "READ", workEmail: "ann@acme.cz", workPhone: PHONE } },
    });
    expect(contactButtons(former)).toBeNull();
  });
});

describe("valueActions", () => {
  it("returns Call and Copy for a Work contact phone", () => {
    expect(valueActions({ kind: "phone", phone: PHONE, copyable: true })).toEqual([
      { kind: "call", url: "tel:+420602111061" },
      { kind: "copy", text: "+420 602 111 061" },
    ]);
  });

  it("returns Email and Copy for a Work contact email", () => {
    expect(valueActions({ kind: "email", email: "ann@acme.cz", copyable: true })).toEqual([
      { kind: "email", url: "mailto:ann@acme.cz" },
      { kind: "copy", text: "ann@acme.cz" },
    ]);
  });

  it("returns no Copy for a value outside Work contact", () => {
    expect(valueActions({ kind: "phone", phone: PHONE, copyable: false })).toEqual([
      { kind: "call", url: "tel:+420602111061" },
    ]);
    expect(valueActions({ kind: "email", email: "ann@home.cz", copyable: false })).toEqual([
      { kind: "email", url: "mailto:ann@home.cz" },
    ]);
  });
});

describe("selfNotice", () => {
  it("returns nothing on someone else's profile", () => {
    expect(selfNotice(profile("a", "Ann"), org("o-a"))).toBeNull();
  });

  it("returns the edit page on the viewer's own profile", () => {
    expect(selfNotice(profile("a", "Ann", { self: true }), org("o-a"))).toEqual({
      lapsed: false,
      editPath: "/directory/person/edit/?organizationId=o-a&employmentId=e-a",
    });
  });

  it("returns the lapsed notice once the organization has lapsed", () => {
    expect(
      selfNotice(profile("a", "Ann", { self: true }), org("o-a", { writable: false }))
    ).toEqual({
      lapsed: true,
      editPath: "/directory/person/edit/?organizationId=o-a&employmentId=e-a",
    });
  });
});

describe("profileEditPath", () => {
  it("returns the web edit page with both ids encoded", () => {
    expect(profileEditPath("o 1", "e&2")).toBe(
      "/directory/person/edit/?organizationId=o%201&employmentId=e%262"
    );
  });
});

describe("sectionRetention", () => {
  const former: DirectoryProfile = profile("a", "Ann", {
    ended: true,
    retention: {
      hold: null,
      sections: {
        card: { status: "KEPT_UNTIL_ERASED" },
        workContact: { status: "REMOVED_ON", date: "2026-10-30" },
        photo: { status: "REMOVES_ON", date: "2027-09-30" },
      },
    },
  });

  it("returns a removal date for the heading of a Section still held", () => {
    expect(sectionRetention(former, "photo")).toEqual({ removesOn: "2027-09-30", removedOn: null });
  });

  it("returns the purge date for a Section retention removed", () => {
    expect(sectionRetention(former, "workContact")).toEqual({
      removesOn: null,
      removedOn: "2026-10-30",
    });
  });

  it("returns neither for a Section kept or not mentioned, or a profile without retention", () => {
    expect(sectionRetention(former, "card")).toEqual({ removesOn: null, removedOn: null });
    expect(sectionRetention(former, "job")).toEqual({ removesOn: null, removedOn: null });
    expect(sectionRetention(profile("a", "Ann"), "photo")).toEqual({
      removesOn: null,
      removedOn: null,
    });
  });
});

describe("retentionLines", () => {
  it("returns every Section the server mentions, in the profile's order", () => {
    const former = profile("a", "Ann", {
      ended: true,
      retention: {
        hold: null,
        sections: {
          personal: { status: "REMOVES_ON", date: "2029-09-30" },
          card: { status: "KEPT_UNTIL_ERASED" },
          job: { status: "ON_HOLD" },
        },
      },
    });
    expect(retentionLines(former)).toEqual([
      { section: "card", retention: { status: "KEPT_UNTIL_ERASED" } },
      { section: "job", retention: { status: "ON_HOLD" } },
      { section: "personal", retention: { status: "REMOVES_ON", date: "2029-09-30" } },
    ]);
  });

  it("returns nothing without retention", () => {
    expect(retentionLines(profile("a", "Ann"))).toEqual([]);
  });
});

describe("directoryDate on a calendar day", () => {
  it("returns the day a YYYY-MM-DD names, whatever the device's zone", () => {
    expect(directoryDate("en-GB", "2026-11-24")).toBe("24 Nov 2026");
    expect(directoryDate("cs-CZ", "2026-11-24")).toBe("24. 11. 2026");
  });
});
