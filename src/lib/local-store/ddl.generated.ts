// Generated from src/lib/local-store/drizzle by `npm run store:ddl`. Do not edit by hand.

export const STORE_DDL: readonly string[] = [
  "CREATE TABLE `bankHolidays` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`date` text NOT NULL,\n\t`name` text NOT NULL,\n\t`country` text NOT NULL,\n\t`region` text,\n\t`createdAt` text NOT NULL,\n\t`updatedAt` text NOT NULL,\n\t`generation` integer DEFAULT 0 NOT NULL\n);",
  "CREATE INDEX `bankHolidays_country_date_idx` ON `bankHolidays` (`country`,`date`);",
  "CREATE TABLE `groupMirrors` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`userId` text NOT NULL,\n\t`sourceGroupId` text NOT NULL,\n\t`targetGroupId` text NOT NULL,\n\t`organizationId` text NOT NULL,\n\t`deletedAt` text,\n\t`createdAt` text NOT NULL,\n\t`updatedAt` text NOT NULL,\n\t`generation` integer DEFAULT 0 NOT NULL\n);",
  "CREATE INDEX `groupMirrors_organizationId_idx` ON `groupMirrors` (`organizationId`);",
  "CREATE TABLE `groupUsers` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`groupId` text NOT NULL,\n\t`organizationId` text NOT NULL,\n\t`userId` text NOT NULL,\n\t`viewAccess` integer NOT NULL,\n\t`adminAccess` integer NOT NULL,\n\t`approverAccess` integer NOT NULL,\n\t`controlledUser` integer NOT NULL,\n\t`deletedAt` text,\n\t`createdAt` text NOT NULL,\n\t`updatedAt` text NOT NULL,\n\t`generation` integer DEFAULT 0 NOT NULL\n);",
  "CREATE INDEX `groupUsers_groupId_idx` ON `groupUsers` (`groupId`);",
  "CREATE INDEX `groupUsers_organizationId_idx` ON `groupUsers` (`organizationId`);",
  "CREATE TABLE `groups` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`organizationId` text NOT NULL,\n\t`groupName` text NOT NULL,\n\t`defaultVacationDays` integer NOT NULL,\n\t`defaultHomeOfficeDays` integer NOT NULL,\n\t`defaultSickDays` integer NOT NULL,\n\t`workingDays` text NOT NULL,\n\t`holidayCountry` text,\n\t`managerUserId` text NOT NULL,\n\t`mainApprovalUser` text,\n\t`tempApprovalUser` text,\n\t`deletedAt` text,\n\t`createdAt` text NOT NULL,\n\t`updatedAt` text NOT NULL,\n\t`generation` integer DEFAULT 0 NOT NULL\n);",
  "CREATE INDEX `groups_organizationId_idx` ON `groups` (`organizationId`);",
  "CREATE TABLE `organizations` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`name` text NOT NULL,\n\t`generation` integer DEFAULT 0 NOT NULL\n);",
  'CREATE TABLE `syncState` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`userId` text NOT NULL,\n\t`cursor` text,\n\t`lastPulledAt` text,\n\t`generation` integer DEFAULT 0 NOT NULL,\n\tCONSTRAINT "syncState_single_row_chk" CHECK("syncState"."id" = 1)\n);',
  "CREATE TABLE `userYearQuotas` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`userId` text NOT NULL,\n\t`groupId` text NOT NULL,\n\t`organizationId` text NOT NULL,\n\t`relatedYear` text NOT NULL,\n\t`vacationDays` integer NOT NULL,\n\t`homeOfficeDays` integer NOT NULL,\n\t`sickDays` integer NOT NULL,\n\t`carriedOverDays` integer NOT NULL,\n\t`createdAt` text NOT NULL,\n\t`updatedAt` text NOT NULL,\n\t`generation` integer DEFAULT 0 NOT NULL\n);",
  "CREATE INDEX `userYearQuotas_userId_groupId_relatedYear_idx` ON `userYearQuotas` (`userId`,`groupId`,`relatedYear`);",
  "CREATE INDEX `userYearQuotas_organizationId_idx` ON `userYearQuotas` (`organizationId`);",
  "CREATE TABLE `users` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`name` text NOT NULL,\n\t`image` text,\n\t`updatedAt` text NOT NULL,\n\t`generation` integer DEFAULT 0 NOT NULL\n);",
  "CREATE TABLE `vacations` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`userId` text NOT NULL,\n\t`groupId` text NOT NULL,\n\t`organizationId` text NOT NULL,\n\t`requestId` text NOT NULL,\n\t`requestedDay` text NOT NULL,\n\t`startTime` text,\n\t`endTime` text,\n\t`vacationType` text NOT NULL,\n\t`halfDay` integer NOT NULL,\n\t`approvedAt` text,\n\t`approvedBy` text,\n\t`rejectedAt` text,\n\t`rejectedBy` text,\n\t`rejectionReason` text,\n\t`note` text,\n\t`createdByUserId` text,\n\t`deletedAt` text,\n\t`deletedByUserId` text,\n\t`createdAt` text NOT NULL,\n\t`updatedAt` text NOT NULL,\n\t`generation` integer DEFAULT 0 NOT NULL,\n\tCONSTRAINT \"vacations_vacationType_chk\" CHECK(\"vacations\".\"vacationType\" in ('VACATION', 'HOME_OFFICE', 'SICK', 'SICK_DAY', 'PAID_TIME_OFF', 'NON_PAID_LEAVE', 'STUDY_LEAVE', 'BANK_HOLIDAY', 'OTHER'))\n);",
  "CREATE INDEX `vacations_groupId_requestedDay_idx` ON `vacations` (`groupId`,`requestedDay`);",
  "CREATE INDEX `vacations_userId_requestedDay_idx` ON `vacations` (`userId`,`requestedDay`);",
  "CREATE INDEX `vacations_requestId_idx` ON `vacations` (`requestId`);",
  "CREATE INDEX `vacations_organizationId_idx` ON `vacations` (`organizationId`);",
];
