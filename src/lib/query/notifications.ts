import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "./keys";
import { useRereadOnFocus } from "./reread-on-focus";
import { apiRequest } from "./runtime";
import { useWriteFailure } from "./use-write-failure";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  /** The web page it is about, absolute or relative; `notificationRoute` places it on the phone. */
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const PATH = "/api/notifications";
const LIST_KEY = qk.notifications(false);

type Patch = (list: AppNotification[]) => AppNotification[];

export function useNotifications() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async ({ signal }) => {
      const list = await apiRequest<unknown>(PATH, { signal });
      // Anything but a list would take every tab's header down with the bell.
      if (!Array.isArray(list)) throw new Error("The notifications answer is not a list.");
      return list as AppNotification[];
    },
  });
}

const ALL = [qk.allNotifications()];

/** Coming back to the list, or to a tab with the bell, reads the notifications again. */
export function useRereadNotificationsOnFocus(): void {
  useRereadOnFocus(ALL);
}

/** The bell's dot: any notification not yet read. Nothing read yet shows none. */
export function useHasUnreadNotifications(): boolean {
  const { data } = useNotifications();
  return data?.some((notification) => notification.readAt === null) ?? false;
}

type Write<TVariables> = {
  send: (variables: TVariables) => Promise<unknown>;
  apply: (variables: TVariables) => Patch;
  /** Takes back only what `apply` changed, so a failure leaves other writes and newer reads alone. */
  undo: (variables: TVariables, before: AppNotification[]) => Patch;
};

const WRITE_KEY = ["notifications", "write"];

/**
 * One notification write, as the list shows it: the change lands in the list at once, a failure
 * takes it back and goes to the shared write-failure handling, and the list is read again once the
 * last write in flight settles.
 */
function useNotificationWrite<TVariables>({ send, apply, undo }: Write<TVariables>) {
  const queryClient = useQueryClient();
  const writeFailure = useWriteFailure();

  const mutation = useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: send,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: qk.allNotifications() });
      const before = queryClient.getQueryData<AppNotification[]>(LIST_KEY);
      if (!before) return { undo: null };
      queryClient.setQueryData(LIST_KEY, apply(variables)(before));
      return { undo: undo(variables, before) };
    },
    onError: (error, variables, context) => {
      const revert = context?.undo;
      if (revert) {
        queryClient.setQueryData<AppNotification[]>(LIST_KEY, (list) => list && revert(list));
      }
      writeFailure(error, { queryKeys: [], retry: () => mutation.mutate(variables) });
    },
    onSettled: () => {
      // A read while another write is still in flight would drop that write's change from the list.
      if (queryClient.isMutating({ mutationKey: WRITE_KEY }) > 1) return;
      return queryClient.invalidateQueries({ queryKey: qk.allNotifications() });
    },
  });

  return mutation;
}

const now = () => new Date().toISOString();

const markRead =
  (ids: ReadonlySet<string>): Patch =>
  (list) =>
    list.map((row) => (ids.has(row.id) && row.readAt === null ? { ...row, readAt: now() } : row));

const markUnread =
  (ids: ReadonlySet<string>): Patch =>
  (list) =>
    list.map((row) => (ids.has(row.id) ? { ...row, readAt: null } : row));

const unreadIds = (list: AppNotification[]) =>
  new Set(list.filter((row) => row.readAt === null).map((row) => row.id));

/** Puts rows of `before` that are gone from the list back, each under the row it followed. */
const restore =
  (before: AppNotification[], only?: string): Patch =>
  (list) => {
    const out = [...list];
    before.forEach((row, index) => {
      if ((only !== undefined && row.id !== only) || out.some((kept) => kept.id === row.id)) {
        return;
      }
      const above = before
        .slice(0, index)
        .map((earlier) => out.findIndex((kept) => kept.id === earlier.id))
        .findLast((at) => at >= 0);
      out.splice(above === undefined ? 0 : above + 1, 0, row);
    });
    return out;
  };

export type NotificationBusy = "markAllRead" | "clearAll";

export function useNotificationWrites() {
  const markOneRead = useNotificationWrite({
    send: (id: string) => apiRequest(`${PATH}/${encodeURIComponent(id)}/read`, { method: "POST" }),
    apply: (id) => markRead(new Set([id])),
    undo: (id, before) => markUnread(unreadIds(before).has(id) ? new Set([id]) : new Set()),
  });
  const remove = useNotificationWrite({
    send: (id: string) => apiRequest(`${PATH}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    apply: (id) => (list) => list.filter((row) => row.id !== id),
    undo: (id, before) => restore(before, id),
  });
  const markAllRead = useNotificationWrite({
    send: () => apiRequest(`${PATH}/read-all`, { method: "POST" }),
    apply: () => (list) => markRead(unreadIds(list))(list),
    undo: (_, before) => markUnread(unreadIds(before)),
  });
  const clearAll = useNotificationWrite({
    send: () => apiRequest(PATH, { method: "DELETE" }),
    apply: () => () => [],
    undo: (_, before) => restore(before),
  });

  const busy: NotificationBusy | null = markAllRead.isPending
    ? "markAllRead"
    : clearAll.isPending
      ? "clearAll"
      : null;

  return {
    busy,
    markRead: (id: string) => markOneRead.mutate(id),
    remove: (id: string) => remove.mutate(id),
    markAllRead: () => markAllRead.mutate(undefined),
    clearAll: () => clearAll.mutate(undefined),
  };
}
