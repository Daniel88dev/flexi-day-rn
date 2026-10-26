import { CaretDownIcon, MagnifyingGlassIcon, XCircleIcon } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { FilterChip } from "@/components/report/filter-chip";
import { OptionSheet, type SheetOption } from "@/components/report/option-sheet";
import { StackScreen } from "@/components/shell/stack-screen";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import {
  NO_DIRECTORY_FILTERS,
  directoryFilterOptions,
  directoryFiltersMoved,
  directoryOrganizations,
  formerNewestFirst,
  visibleDirectoryPeople,
  type DirectoryFilters,
  type DirectoryOrganization,
  type DirectoryPerson,
  type FormerDirectoryPerson,
} from "@/lib/directory";
import {
  ApiError,
  useDirectoryOrganizations,
  useDirectoryPeople,
  useFormerDirectoryPeople,
  useRereadDirectoryOnFocus,
} from "@/lib/query";
import { useViewer } from "@/lib/viewer/use-viewer";

import { FormerRow, PersonRow } from "./directory-row";
import {
  DirectoryNoMatch,
  DirectoryNote,
  DirectoryOffline,
  DirectorySkeleton,
  LapsedBanner,
} from "./directory-states";

type Segment = "current" | "former";
type Sheet = "organization" | "department" | "location" | "type" | null;

/** A refusal (off, not a member, gone) is no outage: Retry would answer the same. */
const refused = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500;

export function OrganizationLine({
  organization,
  pickable,
  onPick,
}: {
  organization: DirectoryOrganization;
  pickable: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  if (!pickable) {
    return (
      <Text testID="directory-organization" className="mt-0.5 text-[14px] text-muted-foreground">
        {organization.name}
      </Text>
    );
  }
  return (
    <Pressable
      testID="directory-organization-picker"
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={`${t.directory.pickOrganization}, ${organization.name}`}
      hitSlop={6}
      className="mt-0.5 flex-row items-center gap-1 self-start active:opacity-70"
    >
      <Text className="text-[14.5px] font-semibold text-primary">{organization.name}</Text>
      <Icon icon={CaretDownIcon} tone="primary" size={12} weight="bold" />
    </Pressable>
  );
}

function SegmentSwitch({ value, onChange }: { value: Segment; onChange: (next: Segment) => void }) {
  const { t } = useTranslation();
  const segments: [Segment, string][] = [
    ["current", t.directory.current],
    ["former", t.directory.former],
  ];
  return (
    <View className="mb-3 flex-row rounded-full bg-muted p-1">
      {segments.map(([segment, label]) => (
        <Pressable
          key={segment}
          testID={`directory-segment-${segment}`}
          onPress={() => onChange(segment)}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: value === segment }}
          className={cn(
            "h-9 flex-1 items-center justify-center rounded-full",
            value === segment && "bg-card"
          )}
        >
          <Text
            className={cn(
              "text-[14.5px] font-semibold",
              value === segment ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { t } = useTranslation();
  return (
    <View className="relative">
      <Field
        testID="directory-search"
        icon={MagnifyingGlassIcon}
        value={value}
        onChangeText={onChange}
        placeholder={t.directory.search}
        accessibilityLabel={t.directory.search}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <Pressable
          testID="directory-search-clear"
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel={t.directory.clearSearch}
          hitSlop={8}
          className="absolute top-0 right-3 bottom-0 justify-center active:opacity-60"
        >
          <Icon icon={XCircleIcon} tone="faint" size={18} weight="fill" />
        </Pressable>
      ) : null}
    </View>
  );
}

function ListHeading({ count, byEndDate }: { count: number; byEndDate: boolean }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-baseline justify-between px-1 pt-4 pb-2">
      <Text className="text-[11px] font-bold tracking-[1px] text-faint uppercase">
        {t.directory.count(count)}
      </Text>
      {byEndDate ? <Text className="text-[12px] text-faint">{t.directory.byEndDate}</Text> : null}
    </View>
  );
}

function PeopleList({
  people,
  organizationId,
  filters,
  onClear,
  viewerUserId,
}: {
  people: DirectoryPerson[];
  organizationId: string;
  filters: DirectoryFilters;
  onClear: () => void;
  viewerUserId: string | null;
}) {
  const { t } = useTranslation();
  const shown = visibleDirectoryPeople(people, filters);
  if (shown.length === 0) {
    if (directoryFiltersMoved(filters)) return <DirectoryNoMatch onClear={onClear} />;
    return <DirectoryNote testID="directory-empty" message={t.directory.noPeople} />;
  }
  return (
    <>
      <ListHeading count={shown.length} byEndDate={false} />
      <View testID="directory-list" className="overflow-hidden rounded-[24px] bg-card">
        {shown.map((person, index) => (
          <PersonRow
            key={person.employmentId}
            person={person}
            organizationId={organizationId}
            viewerUserId={viewerUserId}
            first={index === 0}
          />
        ))}
      </View>
    </>
  );
}

function FormerList({
  rows,
  organizationId,
  filters,
  onClear,
  viewerUserId,
}: {
  rows: FormerDirectoryPerson[];
  organizationId: string;
  filters: DirectoryFilters;
  onClear: () => void;
  viewerUserId: string | null;
}) {
  const { t } = useTranslation();
  const shown = formerNewestFirst(visibleDirectoryPeople(rows, filters));
  if (shown.length === 0) {
    if (directoryFiltersMoved(filters)) return <DirectoryNoMatch onClear={onClear} />;
    return <DirectoryNote testID="directory-former-empty" message={t.directory.noFormer} />;
  }
  return (
    <>
      <ListHeading count={shown.length} byEndDate />
      <View testID="directory-former-list" className="overflow-hidden rounded-[24px] bg-card">
        {shown.map((row, index) => (
          <FormerRow
            key={row.employmentId}
            person={row}
            organizationId={organizationId}
            viewerUserId={viewerUserId}
            first={index === 0}
          />
        ))}
      </View>
    </>
  );
}

function Directory({ organizations }: { organizations: DirectoryOrganization[] }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>("current");
  const [filters, setFilters] = useState<DirectoryFilters>(NO_DIRECTORY_FILTERS);
  const [sheet, setSheet] = useState<Sheet>(null);

  const organization =
    organizations.find((candidate) => candidate.organizationId === pickedId) ?? organizations[0];
  const organizationId = organization?.organizationId ?? null;
  const people = useDirectoryPeople(organizationId);
  const formerAllowed = people.data?.formerList === true;
  const showFormer = formerAllowed && segment === "former";
  const former = useFormerDirectoryPeople(organizationId, showFormer);
  const read = showFormer ? former : people;

  const listed: DirectoryPerson[] = useMemo(
    () => (showFormer ? (former.data ?? []) : (people.data?.people ?? [])),
    [showFormer, former.data, people.data]
  );
  const options = useMemo(() => directoryFilterOptions(listed), [listed]);

  if (!organization)
    return <DirectoryNote testID="directory-unavailable" message={t.directory.unavailable} />;

  const clear = () => setFilters(NO_DIRECTORY_FILTERS);
  const patch = (next: Partial<DirectoryFilters>) =>
    setFilters((current) => ({ ...current, ...next }));
  const pickOrganization = (id: string | null) => {
    if (id) setPickedId(id);
    setSegment("current");
    clear();
    setSheet(null);
  };

  const lapsed = organization.enabled && !organization.writable;
  const admin = organization.role !== "MEMBER";
  const viewerUserId = viewer?.id ?? null;

  const labelOf = (list: { id: string; name: string }[], id: string | null) =>
    list.find((item) => item.id === id)?.name ?? null;
  const typeLabel =
    filters.type === "external"
      ? t.directory.externalWorkers
      : filters.type === "employee"
        ? t.directory.employees
        : null;

  const filterSheet = (
    kind: "department" | "location" | "type",
    title: string,
    choices: SheetOption[],
    picked: string | null,
    apply: (value: string | null) => void
  ) => (
    <OptionSheet
      testID={`directory-${kind}-sheet`}
      open={sheet === kind}
      onClose={() => setSheet(null)}
      title={title}
      options={choices}
      picked={picked === null ? [] : [picked]}
      allLabel={t.directory.any}
      onPick={(value) => {
        apply(value);
        setSheet(null);
      }}
    />
  );

  let body;
  if (read.isPending && read.fetchStatus !== "idle") body = <DirectorySkeleton />;
  else if (read.isError && refused(read.error))
    body = <DirectoryNote testID="directory-unavailable" message={t.directory.unavailable} />;
  else if (read.isError || !read.data)
    body = <DirectoryOffline onRetry={() => void read.refetch()} />;
  else if (showFormer)
    body = (
      <FormerList
        rows={former.data ?? []}
        organizationId={organization.organizationId}
        filters={filters}
        onClear={clear}
        viewerUserId={viewerUserId}
      />
    );
  else
    body = (
      <PeopleList
        people={people.data?.people ?? []}
        organizationId={organization.organizationId}
        filters={filters}
        onClear={clear}
        viewerUserId={viewerUserId}
      />
    );

  return (
    <>
      <ScrollView
        testID="directory-scroll"
        className="flex-1"
        contentContainerClassName="px-4 pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={read.isRefetching} onRefresh={() => void read.refetch()} />
        }
      >
        <Text
          accessibilityRole="header"
          className="font-display text-[30px] font-semibold text-foreground"
        >
          {t.directory.title}
        </Text>
        <OrganizationLine
          organization={organization}
          pickable={organizations.length > 1}
          onPick={() => setSheet("organization")}
        />
        <View className="h-3" />
        {lapsed ? (
          <LapsedBanner
            message={t.directory.lapsed(organization.name)}
            adminLine={admin ? t.directory.lapsedAdmin : null}
          />
        ) : null}
        {formerAllowed ? (
          <SegmentSwitch
            value={segment}
            onChange={(next) => {
              setSegment(next);
              clear();
            }}
          />
        ) : null}
        <SearchField value={filters.query} onChange={(query) => patch({ query })} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-4 mt-3"
          contentContainerClassName="gap-2 px-4"
        >
          {options.departments.length > 0 ? (
            <FilterChip
              testID="directory-filter-department"
              name={t.directory.department}
              label={labelOf(options.departments, filters.departmentId) ?? t.directory.department}
              active={filters.departmentId !== null}
              onPress={() => setSheet("department")}
            />
          ) : null}
          {options.locations.length > 0 ? (
            <FilterChip
              testID="directory-filter-location"
              name={t.directory.location}
              label={labelOf(options.locations, filters.locationId) ?? t.directory.location}
              active={filters.locationId !== null}
              onPress={() => setSheet("location")}
            />
          ) : null}
          <FilterChip
            testID="directory-filter-type"
            name={t.directory.type}
            label={typeLabel ?? t.directory.type}
            active={filters.type !== null}
            onPress={() => setSheet("type")}
          />
        </ScrollView>
        {body}
      </ScrollView>

      {organizations.length > 1 ? (
        <OptionSheet
          testID="directory-organizations"
          open={sheet === "organization"}
          onClose={() => setSheet(null)}
          title={t.directory.pickOrganization}
          options={organizations.map((candidate) => ({
            value: candidate.organizationId,
            label: candidate.name,
          }))}
          picked={[organization.organizationId]}
          onPick={pickOrganization}
        />
      ) : null}
      {filterSheet(
        "department",
        t.directory.department,
        options.departments.map(({ id, name }) => ({ value: id, label: name })),
        filters.departmentId,
        (departmentId) => patch({ departmentId })
      )}
      {filterSheet(
        "location",
        t.directory.location,
        options.locations.map(({ id, name }) => ({ value: id, label: name })),
        filters.locationId,
        (locationId) => patch({ locationId })
      )}
      {filterSheet(
        "type",
        t.directory.type,
        [
          { value: "employee", label: t.directory.employees },
          { value: "external", label: t.directory.externalWorkers },
        ],
        filters.type,
        (type) => patch({ type: type === "employee" || type === "external" ? type : null })
      )}
    </>
  );
}

function Title() {
  const { t } = useTranslation();
  return (
    <Text
      accessibilityRole="header"
      className="font-display px-4 text-[30px] font-semibold text-foreground"
    >
      {t.directory.title}
    </Text>
  );
}

function DirectoryBody() {
  const { t } = useTranslation();
  const organizations = useDirectoryOrganizations();
  useRereadDirectoryOnFocus();

  if (organizations.isPending) {
    return (
      <View>
        <Title />
        <View className="px-4">
          <DirectorySkeleton />
        </View>
      </View>
    );
  }
  if (organizations.isError || !Array.isArray(organizations.data)) {
    return (
      <View>
        <Title />
        <View className="px-4">
          <DirectoryOffline onRetry={() => void organizations.refetch()} />
        </View>
      </View>
    );
  }
  const open = directoryOrganizations(organizations.data);
  if (open.length === 0) {
    return (
      <View>
        <Title />
        <DirectoryNote testID="directory-unavailable" message={t.directory.unavailable} />
      </View>
    );
  }
  return <Directory organizations={open} />;
}

/** Pushed from the More sheet's People section; read only, live from the server. */
export function DirectoryScreen() {
  const { t } = useTranslation();
  return (
    <StackScreen testID="directory" title={t.directory.title} hideTitle>
      <DirectoryBody />
    </StackScreen>
  );
}
