CREATE TABLE `bankHolidays` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`region` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bankHolidays_country_date_idx` ON `bankHolidays` (`country`,`date`);--> statement-breakpoint
CREATE TABLE `groupMirrors` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`sourceGroupId` text NOT NULL,
	`targetGroupId` text NOT NULL,
	`organizationId` text NOT NULL,
	`deletedAt` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `groupMirrors_organizationId_idx` ON `groupMirrors` (`organizationId`);--> statement-breakpoint
CREATE TABLE `groupUsers` (
	`id` text PRIMARY KEY NOT NULL,
	`groupId` text NOT NULL,
	`organizationId` text NOT NULL,
	`userId` text NOT NULL,
	`viewAccess` integer NOT NULL,
	`adminAccess` integer NOT NULL,
	`approverAccess` integer NOT NULL,
	`controlledUser` integer NOT NULL,
	`deletedAt` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `groupUsers_groupId_idx` ON `groupUsers` (`groupId`);--> statement-breakpoint
CREATE INDEX `groupUsers_organizationId_idx` ON `groupUsers` (`organizationId`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`organizationId` text NOT NULL,
	`groupName` text NOT NULL,
	`defaultVacationDays` integer NOT NULL,
	`defaultHomeOfficeDays` integer NOT NULL,
	`defaultSickDays` integer NOT NULL,
	`workingDays` text NOT NULL,
	`holidayCountry` text,
	`managerUserId` text NOT NULL,
	`mainApprovalUser` text,
	`tempApprovalUser` text,
	`deletedAt` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `groups_organizationId_idx` ON `groups` (`organizationId`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `syncState` (
	`id` integer PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`cursor` text,
	`lastPulledAt` text,
	`generation` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "syncState_single_row_chk" CHECK("syncState"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `userYearQuotas` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`groupId` text NOT NULL,
	`organizationId` text NOT NULL,
	`relatedYear` text NOT NULL,
	`vacationDays` integer NOT NULL,
	`homeOfficeDays` integer NOT NULL,
	`sickDays` integer NOT NULL,
	`carriedOverDays` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `userYearQuotas_userId_groupId_relatedYear_idx` ON `userYearQuotas` (`userId`,`groupId`,`relatedYear`);--> statement-breakpoint
CREATE INDEX `userYearQuotas_organizationId_idx` ON `userYearQuotas` (`organizationId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`updatedAt` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vacations` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`groupId` text NOT NULL,
	`organizationId` text NOT NULL,
	`requestId` text NOT NULL,
	`requestedDay` text NOT NULL,
	`startTime` text,
	`endTime` text,
	`vacationType` text NOT NULL,
	`halfDay` integer NOT NULL,
	`approvedAt` text,
	`approvedBy` text,
	`rejectedAt` text,
	`rejectedBy` text,
	`rejectionReason` text,
	`note` text,
	`createdByUserId` text,
	`deletedAt` text,
	`deletedByUserId` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vacations_vacationType_chk" CHECK("vacations"."vacationType" in ('VACATION', 'HOME_OFFICE', 'SICK', 'SICK_DAY', 'PAID_TIME_OFF', 'NON_PAID_LEAVE', 'STUDY_LEAVE', 'BANK_HOLIDAY', 'OTHER'))
);
--> statement-breakpoint
CREATE INDEX `vacations_groupId_requestedDay_idx` ON `vacations` (`groupId`,`requestedDay`);--> statement-breakpoint
CREATE INDEX `vacations_userId_requestedDay_idx` ON `vacations` (`userId`,`requestedDay`);--> statement-breakpoint
CREATE INDEX `vacations_requestId_idx` ON `vacations` (`requestId`);--> statement-breakpoint
CREATE INDEX `vacations_organizationId_idx` ON `vacations` (`organizationId`);