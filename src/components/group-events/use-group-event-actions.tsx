import { useCallback, useState } from "react";

import {
  GroupEventEditor,
  type GroupEventEditorState,
} from "@/components/group-events/group-event-editor";
import { askDelete } from "@/components/group-events/scope-prompts";
import { useTranslation } from "@/i18n/use-translation";
import { targetOf } from "@/lib/group-events/draft";
import { useMemberGroups, type CalendarGroupEvent, type RequestListScope } from "@/lib/local-store";
import {
  canCreateGroupEvent,
  qk,
  useGroupEventGroups,
  useGroupEventWrites,
  useWriteFailure,
  type GroupEventDeleteRequest,
} from "@/lib/query";

/**
 * Create, edit and delete for the dashboard calendar, with the editor sheet they open. Callers
 * present it only once their own sheet or menu has gone. A create entry shows while the scope's
 * group, or any group in Mine, may take a new group event (D2, S3).
 */
export function useGroupEventActions(scope: RequestListScope) {
  const { t } = useTranslation();
  const groups = useGroupEventGroups().data;
  const { remove: removeEvent } = useGroupEventWrites();
  const writeFailure = useWriteFailure();
  const [editor, setEditor] = useState<GroupEventEditorState | null>(null);
  const memberGroups = useMemberGroups();
  const scopeGroupId = scope.kind === "group" ? scope.groupId : null;

  // In Mine the new event goes to a group the viewer is in, so it shows where they made it; a
  // group they only administer stays a pick away.
  const create = useCallback(
    (date: string) => {
      const memberGroup = groups?.find(
        (group) =>
          group.canCreate && memberGroups.some((member) => member.groupId === group.groupId)
      );
      setEditor({ kind: "create", date, groupId: scopeGroupId ?? memberGroup?.groupId ?? null });
    },
    [groups, memberGroups, scopeGroupId]
  );

  const edit = useCallback(
    (event: CalendarGroupEvent) =>
      setEditor({ kind: "edit", target: targetOf(event), groupName: event.groupName }),
    []
  );

  const remove = useCallback(
    (event: CalendarGroupEvent) => {
      const { event: stored, occurrenceDate } = targetOf(event);
      const send = (request: GroupEventDeleteRequest) => {
        removeEvent(stored.id, request).catch((error: unknown) =>
          writeFailure(error, {
            queryKeys: [qk.groupEventGroups()],
            retry: () => send(request),
          })
        );
      };
      void askDelete({ title: stored.title, recurring: stored.repeat !== null }, t).then(
        (answer) => {
          if (answer) send(answer.scope ? { scope: answer.scope, occurrenceDate } : {});
        }
      );
    },
    [removeEvent, writeFailure, t]
  );

  return {
    canCreate: canCreateGroupEvent(groups, scope),
    create,
    edit,
    remove,
    editor: <GroupEventEditor state={editor} onClose={() => setEditor(null)} />,
  };
}
