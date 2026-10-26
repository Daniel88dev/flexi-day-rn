import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Locale } from "@/i18n";
import {
  sectionRetention,
  showSectionPath,
  type ContactValues,
  type DirectoryProfile,
  type PersonalValues,
  type SensitiveSectionKey,
  type ShownSection,
} from "@/lib/directory";
import { holdPrivacyCover } from "@/lib/privacy-cover";
import { apiRequest } from "@/lib/query";

type Opened = { contact?: ContactValues; personal?: PersonalValues };
type Asking = Partial<Record<SensitiveSectionKey, "pending" | "failed">>;
type Shown = { person: string; opened: Opened; asking: Asking };

export type ShownSectionState<K extends SensitiveSectionKey> = {
  values: Opened[K];
  pending: boolean;
  failed: boolean;
  show: () => void;
};

const SECTIONS: SensitiveSectionKey[] = ["contact", "personal"];

/**
 * The Sensitive sections opened on one profile screen. The values live in this state only, never
 * in the query cache, so a re-read of the profile leaves them alone and writes no read-log row.
 * Leaving the screen, Reports to included, closes them; coming back means a new Show. The
 * person's own Sections open by themselves, since reading them writes nothing.
 */
export function useShownSections(profile: DirectoryProfile, language: Locale) {
  const person = `${profile.organizationId}/${profile.employmentId}`;
  const [shown, setShown] = useState<Shown>({ person, opened: {}, asking: {} });
  const [focused, setFocused] = useState(true);
  // Bumped on leaving, so a Show that answers after the person left is dropped.
  const visitRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        visitRef.current += 1;
        setFocused(false);
        setShown((current) => ({ person: current.person, opened: {}, asking: {} }));
      };
    }, [])
  );

  const current = useMemo<Shown>(
    () => (shown.person === person ? shown : { person, opened: {}, asking: {} }),
    [shown, person]
  );

  const show = useCallback(
    (section: SensitiveSectionKey) => {
      const startedIn = visitRef.current;
      const update = (change: (state: Shown) => Shown) =>
        setShown((state) => {
          if (visitRef.current !== startedIn) return state;
          return change(state.person === person ? state : { person, opened: {}, asking: {} });
        });
      update((state) => ({ ...state, asking: { ...state.asking, [section]: "pending" } }));
      apiRequest<ShownSection>(
        showSectionPath(profile.organizationId, profile.employmentId, section, language),
        { method: "POST" }
      ).then(
        (answer) =>
          update((state) => ({
            ...state,
            opened: { ...state.opened, [section]: answer },
            asking: { ...state.asking, [section]: undefined },
          })),
        () => update((state) => ({ ...state, asking: { ...state.asking, [section]: "failed" } }))
      );
    },
    [person, profile.organizationId, profile.employmentId, language]
  );

  const open = SECTIONS.some((section) => current.opened[section] !== undefined);
  useEffect(() => (open ? holdPrivacyCover() : undefined), [open]);

  useEffect(() => {
    if (!profile.self || !focused) return;
    for (const section of SECTIONS) {
      if (
        profile.sections[section] &&
        !sectionRetention(profile, section).removedOn &&
        !current.opened[section] &&
        current.asking[section] === undefined
      ) {
        show(section);
      }
    }
  }, [profile, focused, current, show]);

  return function stateOf<K extends SensitiveSectionKey>(section: K): ShownSectionState<K> {
    return {
      values: current.opened[section] as Opened[K],
      pending: current.asking[section] === "pending",
      failed: current.asking[section] === "failed",
      show: () => show(section),
    };
  };
}
