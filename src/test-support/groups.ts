import type {
  AdministeredGroup,
  GroupAccess,
  GroupDetail,
  GroupMember,
  UserYearQuota,
} from "@/lib/query/groups";

export const GROUP_ACCESS: GroupAccess = {
  canView: true,
  canAdmin: false,
  viaOrgAdmin: false,
  isMember: true,
};

/** Dev Team as `GET /api/group/:groupId` answers it to a member with view access. */
export function groupDetail(patch: Partial<GroupDetail> = {}): GroupDetail {
  return {
    id: "group-1",
    organization: { name: "Olivia Owner", sickDayBenefitActive: false },
    groupName: "Dev Team",
    defaultVacationDays: 20,
    defaultHomeOfficeDays: 0,
    defaultSickDays: 0,
    workingDays: [1, 2, 3, 4, 5],
    holidayCountry: null,
    managerUserId: "olivia",
    access: GROUP_ACCESS,
    ...patch,
  };
}

/** A tracked member with view access only, as `GET /api/group-user/:groupId` lists them. */
export function groupMember(
  userId: string,
  name: string,
  patch: Partial<GroupMember> = {}
): GroupMember {
  return {
    id: `membership-${userId}`,
    groupId: "group-1",
    userId,
    viewAccess: true,
    adminAccess: false,
    approverAccess: false,
    controlledUser: true,
    deletedAt: null,
    email: `${userId}@dev.local`,
    user: { id: userId, name, initials: "", avatarColor: "hsl(0 0% 50%)" },
    ...patch,
  };
}

export function userYearQuota(userId: string, patch: Partial<UserYearQuota> = {}): UserYearQuota {
  return {
    id: `quota-${userId}`,
    userId,
    groupId: "group-1",
    relatedYear: "2026",
    vacationDays: 25,
    homeOfficeDays: 10,
    sickDays: 5,
    carriedOverDays: 3,
    ...patch,
  };
}

/** Dev Support as `GET /api/group/administered` lists it to the org admin who is not a member. */
export function administeredGroup(patch: Partial<AdministeredGroup> = {}): AdministeredGroup {
  return {
    id: "group-2",
    groupName: "Dev Support",
    organization: { name: "Olivia Owner", sickDayBenefitActive: false },
    memberCount: 3,
    viaOrgAdmin: true,
    ...patch,
  };
}

/** The membership row both join paths answer with, 201. */
export function joinedMembership(groupId = "group-1") {
  return {
    id: "membership-nina",
    userId: "nina",
    groupId,
    viewAccess: true,
    adminAccess: false,
    approverAccess: false,
    controlledUser: true,
  };
}
