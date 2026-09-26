# Libraries for the phone's sheet, calendar, pickers and attachments

Research for fenro T-26 (map T-22), 2026-09-26. Checked against this repo's `package.json`: Expo
57.0.23, React Native 0.86.3, New Architecture on (`newArchEnabled: true`), reanimated 4.5.1,
worklets 0.10.1, gesture-handler 2.32, react-native-screens 4.26.2, expo-router 57, NativeWind
5.0.0-rc.0. Versions marked "Expo-pinned" come from `node_modules/expo/bundledNativeModules.json`,
the versions `npx expo install` picks for SDK 57.

"Prebuild" below means a native module that the current dev client does not contain: adding it
needs `npm run prebuild` and a rebuild through Xcode (see `CLAUDE.md`).

## Summary

| Piece                 | Pick                                                           | Prebuild             |
| --------------------- | -------------------------------------------------------------- | -------------------- |
| Clock sheet           | Expo Router route with `presentation: "formSheet"` and detents | No                   |
| Month calendar        | Custom grid, porting the web's lane layout                     | No                   |
| Date and time pickers | `@react-native-community/datetimepicker` 9.1.0 (Expo-pinned)   | Yes                  |
| Photo attachments     | `expo-image-picker` ~57.0.18                                   | Yes, plus Info.plist |
| File attachments      | `File.pickFileAsync` from `expo-file-system` (already linked)  | No                   |
| Upload of either      | `File#upload` from `expo-file-system`, multipart or binary     | No                   |

The two native additions, the date picker and the image picker, can land in one prebuild.

## Bottom sheet (clock sheet)

### Expo Router `formSheet`: recommended

- A route presented by the root `Stack` (`src/app/_layout.tsx` already renders one) with
  `presentation: "formSheet"`. Options: `sheetAllowedDetents` (ascending fractions or
  `"fitToContents"`), `sheetInitialDetentIndex`, `sheetGrabberVisible`, `sheetCornerRadius`,
  `sheetLargestUndimmedDetentIndex`, `sheetExpandsWhenScrolledToEdge`
  ([Expo Router modals](https://docs.expo.dev/router/advanced/modals/),
  [react-native-screens `types.tsx`](https://github.com/software-mansion/react-native-screens/blob/4.26.2/src/types.tsx)).
- It is UIKit's own sheet through react-native-screens 4.26, which is already installed. No new
  dependency, no prebuild, and no reanimated involvement.
- The content is an ordinary screen of core components, so NativeWind `className` works as it does
  everywhere else.
- Caveats from the docs: `flex: 1` content works with numeric detents but not with
  `fitToContents`, which needs explicit content sizing; on iOS `fitToContents` adds a small bottom
  inset padding; Android allows at most three detents
  ([Expo Router modals](https://docs.expo.dev/router/advanced/modals/)). On iOS 26+ an open issue
  reports Liquid Glass flaring on tap inside a formSheet
  ([screens#4605](https://github.com/software-mansion/react-native-screens/issues/4605)); worth a
  look on the phone during the prototype.
- A sheet is a route, so opening it is `router.push("/clock")`, and state that the running timer
  needs lives outside the sheet (the local store or a hook), not in a component that unmounts.
- sonner-native's `Toaster` wraps itself in `FullWindowOverlay` on iOS by default, a window above
  presented sheets, so the shell's existing `Toaster` stays visible over the sheet
  (`node_modules/sonner-native/lib/typescript/src/types.d.ts`, `fullWindowOverlay`).

### `@gorhom/bottom-sheet` 5.2.14: not recommended now

- JS-only (reanimated + gesture-handler), so no prebuild. Its peer range accepts reanimated 4
  (`react-native-reanimated: ">=3.16.0 || >=4.0.0-"`, `npm view @gorhom/bottom-sheet`), though
  the [README](https://github.com/gorhom/react-native-bottom-sheet) still says v5 is built for
  "Reanimated v3".
- Last release 5.2.14 on 2026-05-09, and no commits on the default branch since
  ([releases](https://github.com/gorhom/react-native-bottom-sheet/releases)). Bug reports from
  July to September 2026 against reanimated 4 are closed by the stale bot, not by fixes: a sheet
  mounting invisible when the JS thread is busy
  ([#2690](https://github.com/gorhom/react-native-bottom-sheet/issues/2690),
  [#2721](https://github.com/gorhom/react-native-bottom-sheet/issues/2721)).
- [#2737](https://github.com/gorhom/react-native-bottom-sheet/issues/2737), open, is reported on
  this repo's exact matrix (5.2.14, reanimated 4.5.1, worklets 0.10.1, gesture-handler 2.32.0, iOS
  Fabric): the scroll handlers re-enter `scrollTo` until the native stack overflows. The fix,
  [PR #2760](https://github.com/gorhom/react-native-bottom-sheet/pull/2760), is unmerged.
  [#2758](https://github.com/gorhom/react-native-bottom-sheet/issues/2758) reports a warning with
  reanimated 4.6.
- `BottomSheetView` and friends are third-party components, so `className` does not reach them;
  styling goes through `style` props or a core `View` inside.

### `@expo/ui` `BottomSheet`: viable, not needed

- `@expo/ui` ~57.0.18 (Expo-pinned) ships a SwiftUI `BottomSheet` with `presentationDetents` and
  RN children through `RNHostView`
  ([docs](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/)), and a
  `@expo/ui/community/bottom-sheet` drop-in for the gorhom API that presents a native sheet
  ([README](https://github.com/expo/expo/blob/main/packages/expo-ui/src/community/bottom-sheet/README.md)).
- Native module, so a prebuild. The community drop-in ignores `backgroundStyle` on iOS, has no
  footer, and its changelog shows a steady run of iOS sheet fixes through 57.0.17
  ([CHANGELOG](https://github.com/expo/expo/blob/main/packages/expo-ui/CHANGELOG.md)). It gives
  nothing formSheet does not already give this app.

### RN `Modal` with `animationType="slide"` (current More sheet)

- What `src/components/shell/more-sheet.tsx` does. No detents, no drag to dismiss, and the dim
  backdrop slides in with the content. Fine for a menu; the clock sheet's states and notices want
  detents and a grabber, which formSheet gives for free.

## Month calendar grid (dashboard)

### Custom grid: recommended

- The web dashboard already computes per-week lanes for multi-day bars and the "+N more" overflow
  in [`components/dashboard/leave-calendar.tsx`](https://github.com/Daniel88dev/flexi-day/blob/main/components/dashboard/leave-calendar.tsx)
  (`PlacedBar`, `lane`, the per-day overflow popover). That logic is pure and ports to a
  `src/lib/` module with unit tests; the view is seven-column week rows of core `View`s, so
  NativeWind styles it directly.
- Month swiping: a horizontal paged `FlatList` over a window of months, or a gesture-handler pan,
  both already installed. `react-native-pager-view` would add a native module for no gain.
- Monday-first, bank-holiday ranges and the per-person bars are all layout the app owns, so no
  library constraint applies.

### `react-native-calendars` 1.1314.0: poor fit

- JS-only, maintained by Wix, but the last release was 2026-01-29 and the last commit 2026-01-29
  ([repo](https://github.com/wix/react-native-calendars)).
- `firstDay={1}` gives a Monday start. Its `multi-period` marking draws a coloured stripe per
  period per day, typed as `{ color, startingDay?, endingDay? }`
  ([`src/calendar/day/marking`](https://github.com/wix/react-native-calendars/tree/master/src/calendar/day/marking)):
  no label, no name, no overflow count, and the caller keeps lanes aligned by array position. The
  web's labelled bars and "+N more" would need `dayComponent`, which leaves the library doing only
  the grid.
- Styling is a `theme` object of StyleSheet values, not `className`. It pulls in `lodash`, `xdate`
  and `recyclerlistview`.

### `@marceloterreiro/flash-calendar` 2.0.0: partial fit

- JS-only. 2.0.0 (2026-03-04) moved to FlashList v2, which becomes a required peer
  (`@shopify/flash-list >= 2.0.0`)
  ([release](https://github.com/MarceloPrado/flash-calendar/releases)).
- `useCalendar` / `buildCalendar` return a month as week rows of day metadata, with
  `calendarFirstDayOfWeek: "monday"` and `calendarFormatLocale`
  ([`useCalendar.ts`](https://github.com/MarceloPrado/flash-calendar/blob/main/packages/flash-calendar/src/hooks/useCalendar.ts)).
  Its drawing covers active date ranges (`calendarActiveDateRanges`), not stacked multi-day bars.
- The headless builder is the useful part, and it is a few dozen lines of date arithmetic; taking
  a dependency plus FlashList for it is not worth it unless the prototype wants `CalendarList`'s
  virtualised scrolling.

## Date and time pickers (request form)

### `@react-native-community/datetimepicker` 9.1.0: recommended

- Expo-pinned 9.1.0; latest 9.2.1 (2026-09-07)
  ([releases](https://github.com/react-native-datetimepicker/datetimepicker/releases)). Wraps
  `UIDatePicker`; the README states New Architecture support (Fabric on iOS)
  ([README](https://github.com/react-native-datetimepicker/datetimepicker)).
- Native module, so a prebuild; no Info.plist keys. Its config plugin only styles Android dialogs.
- `mode` `date` / `time`, iOS `display` `default` / `compact` / `inline` / `spinner`,
  `minimumDate` / `maximumDate`, `minuteInterval`, `accentColor`, `themeVariant`.
- Locale: iOS localises the picker from the app's declared localisations. `expo-localization`'s
  `supportedLocales` in `app.json` already writes `CFBundleLocalizations` = `en`, `cs` into the
  generated Info.plist, so Czech month and day names come without the discouraged `locale` prop.
- The web form uses `<input type="date">` and `<input type="time">`
  (`flexi-day/components/new-request-dialog.tsx`), so the OS picker on both sides is consistent.
- Styling is native, so `className` does not apply; wrap it in a core `View` for layout.

### Alternatives

- `@expo/ui/community/datetime-picker` offers the same props on a SwiftUI `DatePicker`
  ([Expo docs](https://docs.expo.dev/versions/latest/sdk/date-time-picker/) call `@expo/ui` a
  drop-in replacement). Also a prebuild. Worth it only if `@expo/ui` arrives for another reason.
- `react-native-ui-datepicker` 3.3.0: JS-only, a calendar with `single` / `range` / `multiple`
  modes, `firstDayOfWeek`, and a `classNames` prop advertised as NativeWind-compatible
  ([README](https://github.com/farhoudshapouran/react-native-ui-datepicker)). The option if the
  request form wants one inline range calendar instead of two pickers. Whether its `classNames`
  work under NativeWind v5's release candidate is untested and would need a prototype.
- `react-native-modal-datetime-picker` 18.0.0 was last published 2024-08-22; skip.

## Attachment pickers and upload

The backend accepts PNG, JPEG, WebP, HEIC and PDF, 10 MB each, five per request
(`flexi-day/lib/attachments/rules.ts`). Creating the attachment returns an upload target: a
presigned S3 POST (`fields` then the file, named `file`, last) or, locally, a PUT of the raw bytes
(`flexi-day/lib/api/types.ts`, `UploadTarget`; web upload in `flexi-day/lib/api/attachment-upload.ts`).

### Photos: `expo-image-picker` ~57.0.18

- Native module, so a prebuild. `launchImageLibraryAsync` uses `PHPickerViewController`, and "No
  permissions request is necessary for launching the image library"
  ([docs](https://docs.expo.dev/versions/latest/sdk/imagepicker/)).
- The config plugin writes `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription` and
  `NSMicrophoneUsageDescription` with default strings unless an option is set; passing `false`
  deletes the key ([plugin](https://github.com/expo/expo/blob/main/packages/expo-image-picker/plugin/src/withImagePicker.ts),
  [`applyPermissions`](https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/Permissions.ts)).
  For this app: set `photosPermission` and `cameraPermission` (if the camera is offered) and
  `microphonePermission: false`. Czech strings go through the app config's `locales`
  ([localisation guide](https://docs.expo.dev/guides/localization/#translating-app-metadata)).
- Assets carry `uri`, `fileName`, `fileSize`, `mimeType`, `width`, `height`.
- HEIC: with `quality: 1` and `preferredAssetRepresentationMode: Current` the original file is
  copied as is; otherwise a HEIC source stays `.heic`, and other formats are re-encoded to JPEG at
  `quality`
  ([`ImageUtils.swift`](https://github.com/expo/expo/blob/main/packages/expo-image-picker/ios/ImageUtils.swift)).
  `preferredAssetRepresentationMode: Compatible` asks iOS to transcode to JPEG first, which keeps
  photos viewable in every browser an approver uses and lets `quality` shrink them under 10 MB.
  The backend accepts HEIC either way.

### Files: `File.pickFileAsync` from `expo-file-system`

- `expo-file-system` 57.0.7 is already a dependency of `expo` and linked into the dev client
  (`ExpoFileSystem` in `ios/Podfile.lock`), so no prebuild.
- `File.pickFileAsync({ mimeTypes, multipleFiles })` opens `UIDocumentPickerViewController` with
  `asCopy: true`; its 56.0.0 changelog calls it at "feature parity with `expo-document-picker`"
  ([docs](https://docs.expo.dev/versions/latest/sdk/filesystem/),
  [CHANGELOG](https://github.com/expo/expo/blob/main/packages/expo-file-system/CHANGELOG.md)).
  The result is a `File`, which implements `Blob` (`size`, `type`).
- `expo-document-picker` ~57.0.2 does the same with the same picker call and needs a prebuild.
  Neither needs an Info.plist key. Its plugin only adds iCloud entitlements when
  `ios.usesIcloudStorage` is on
  ([plugin](https://github.com/expo/expo/blob/main/packages/expo-document-picker/plugin/src/withDocumentPickerIOS.ts));
  leave that off: the picker imports a copy (`asCopy: true`), which needs no entitlement, and the app
  has no iCloud container of its own.

### Upload: `File#upload`

- `new File(uri).upload(url, options)` takes `httpMethod`, `uploadType`
  (`UploadType.BINARY_CONTENT` or `UploadType.MULTIPART`), `headers`, `fieldName`, `mimeType`,
  `parameters` and `onProgress` (`node_modules/expo-file-system/build/NetworkTasks.types.d.ts`).
- The iOS multipart body writes every `parameters` entry first and the file part last
  ([`FileSystemUploadTask.swift`](https://github.com/expo/expo/blob/main/packages/expo-file-system/ios/FileSystemUploadTask.swift)),
  which is the order an S3 presigned POST requires. Pass `fieldName: "file"` explicitly: the
  native default is the file's name, not the `'file'` the TypeScript comment claims.
- The local target maps to `httpMethod: "PUT"`, `uploadType: BINARY_CONTENT`, `headers:
target.headers`.
- These requests go to the upload target, not `/api/*`, and carry no session, as on the web, so
  they sit outside `createApiFetch`.
- Fallback without the file system API: React Native's `FormData` accepts `{ uri, name, type }`
  parts and `XMLHttpRequest` reports `upload.onprogress`, which would let the web's
  `uploadToTarget` port almost unchanged. Not checked against a primary doc here.

## Open for the prototypes

- T-35 (clock sheet): check `fitToContents` against the sheet's changing states on the phone, and
  whether the iOS 26+ glass flare (screens#4605) shows.
- T-34 (calendar): port the lane layout and try a paged `FlatList` for month swipes.
- If the request form wants a single range calendar, prototype `react-native-ui-datepicker` under
  NativeWind v5 before choosing it over two native pickers.
