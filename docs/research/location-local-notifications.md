# Location and scheduled local notifications on iOS

Research for fenro T-27 (map T-22), 2026-09-26. Scope: `flexi-day-rn` on Expo SDK 57 with CNG,
signed by a free personal Apple team, no background tracking. Sources are Apple's developer
documentation, the Expo SDK 57 docs, and the `sdk-57` branch of the Expo source.

## Gist

Foreground location and local notifications both work on the free personal team. Neither needs a
capability. `expo-location` gives the app one-shot fixes through `CLLocationManager.requestLocation`,
with no timeout option and no temporary-full-accuracy call, so the web's two passes carry over with
a JavaScript timer around each. A scheduled reminder cannot be cancelled while the app isn't
running: background tasks are opportunistic, and a silent push needs APNs, which the free team
cannot sign for. Reminders are best-effort until the paid program, and even then a silent push is
not guaranteed.

## What the free personal team allows

Apple's [capability table](https://developer.apple.com/help/account/reference/supported-capabilities-ios)
has a column for free "Apple Developer" accounts. Read from the page's HTML:

| Capability                   | Free team | Needed for                                         |
| ---------------------------- | --------- | -------------------------------------------------- |
| Push notifications           | no        | APNs: remote alerts and silent (background) pushes |
| Time Sensitive Notifications | no        | the `timeSensitive` interruption level             |
| Background modes             | yes       | `processing` for `expo-background-task`            |

Foreground location and local notifications are not capabilities. Location needs only an
Info.plist usage string, and local notifications need only the user's authorization.

One trap: the `expo-notifications` config plugin writes `aps-environment` into the entitlements
whenever it runs and the key is missing
([source](https://github.com/expo/expo/blob/sdk-57/packages/expo-notifications/plugin/src/withNotificationsIOS.ts)),
and its docs say the APNs entitlement "is always set to 'development'"
([docs](https://docs.expo.dev/versions/latest/sdk/notifications/)). That is the Push
Notifications capability, which the free team lacks, so listing the plugin in `app.json` would
break signing. Local notifications don't need the plugin. `expo-notifications` is not in prebuild's
auto-applied list
([source](https://github.com/expo/expo/blob/sdk-57/packages/@expo/prebuild-config/src/plugins/withDefaultPlugins.ts)),
so leave it out of `plugins`, and check that `npx expo install` didn't add it.

The "silent push to reschedule reminders" idea therefore depends on the paid program.

## Location

### Setup under CNG

- `expo-location` is on prebuild's legacy auto-plugin list
  ([source](https://github.com/expo/expo/blob/sdk-57/packages/@expo/prebuild-config/src/plugins/withDefaultPlugins.ts)),
  so its plugin runs as soon as the package is installed, listed or not. It writes
  `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`,
  `NSLocationAlwaysUsageDescription` and `NSMotionUsageDescription`, each defaulting to a generic
  "Allow $(PRODUCT_NAME) to access your location" string
  ([source](https://github.com/expo/expo/blob/sdk-57/packages/expo-location/plugin/src/withLocation.ts)).
  Passing `false` for an option deletes its key
  ([`applyPermissions`](https://github.com/expo/expo/blob/sdk-57/packages/@expo/config-plugins/src/ios/Permissions.ts)).
  List the plugin with a real `locationWhenInUsePermission` string and `false` for the Always and
  motion keys. The app never asks for Always.
- `isIosBackgroundLocationEnabled` stays unset, so no `location` background mode is added
  ([docs](https://docs.expo.dev/versions/latest/sdk/location/)).
- The app ships in English and Czech. The Czech prompt text goes in a locale file referenced from
  `app.json` `locales`, under its `ios` object
  ([docs](https://docs.expo.dev/guides/localization/)).
- Privacy manifest: Core Location is not a
  [required-reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api).
  What applies is the collected-data declaration: `NSPrivacyCollectedDataTypePreciseLocation`
  and/or `NSPrivacyCollectedDataTypeCoarseLocation` in `NSPrivacyCollectedDataTypes`
  ([Apple](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype)),
  linked to the user, not tracking, for app functionality. This only matters for App Store
  submission. Expo's [privacy guide](https://docs.expo.dev/guides/apple-privacy/) only shows
  `NSPrivacyAccessedAPITypes` under `ios.privacyManifests`. Whether that key passes
  `NSPrivacyCollectedDataTypes` through needs a check at prebuild when it matters.
- A native module means `npm run prebuild` and a dev-client rebuild (repo `CLAUDE.md`).

### Permission flow

`requestForegroundPermissionsAsync` calls `requestWhenInUseAuthorization`, and rejects with
`ERR_LOCATION_INFO_PLIST` if the usage string is missing
([source](https://github.com/expo/expo/blob/sdk-57/packages/expo-location/ios/Requesters/EXForegroundPermissionRequester.m)).
Apple's rules for that call
([docs](<https://developer.apple.com/documentation/corelocation/cllocationmanager/requestwheninuseauthorization()>)):

- The prompt appears only while the status is `notDetermined`, and only with the app in the
  foreground. From any other status the call does nothing.
- The options are Allow While Using App (does not expire), Allow Once (expires when the app is no
  longer in use, "reverting to Not Determined status"), and Don't Allow ("no further authorization
  requests are allowed").

The response carries `status`, `canAskAgain`, `ios.scope` (`whenInUse`, `always`, `none`) and
`ios.accuracy` (`full` or `reduced`)
([docs](https://docs.expo.dev/versions/latest/sdk/location/)).

Apple advises asking "only when someone engages a part of your app that requires that data"
([docs](https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services)).
That matches the backend rule: the coordinates come from the platform's own prompt at the clock
instant, never a custom prompt (`flexi-day-be/docs/attendance.md`, Location). So the clock action
itself triggers the system prompt when the organization has `locationEnabled`, with no pre-prompt
screen of our own.

### Approximate location ("Precise Location" off)

- `desiredAccuracy` is ignored. Every fix is reduced
  ([docs](https://developer.apple.com/documentation/corelocation/cllocationmanager/accuracyauthorization)).
- A reduced fix "is usually within 1–20 kilometers of the actual location" and updates "at most a
  few times per hour"
  ([docs](https://developer.apple.com/documentation/corelocation/kcllocationaccuracyreduced)).
  It still reports a positive `horizontalAccuracy`, so the backend stores it like any other coarse
  fix and a later sharper one replaces it.
- Core Location can ask for temporary full accuracy through
  `requestTemporaryFullAccuracyAuthorization(withPurposeKey:)`, with a purpose string under
  `NSLocationTemporaryUsageDescriptionDictionary`. It fails if the app is in the background or
  already has full accuracy, and the grant expires once the app stops being in use
  ([docs](<https://developer.apple.com/documentation/corelocation/cllocationmanager/requesttemporaryfullaccuracyauthorization(withpurposekey:completion:)>)).
- `expo-location` SDK 57 does not expose that call. The iOS module has no such function
  ([source](https://github.com/expo/expo/blob/sdk-57/packages/expo-location/ios/LocationModule.swift)),
  and the plugin writes no temporary-usage key. Using it would take a local Expo module plus a
  config plugin. The web takes whatever the browser gives, so the phone can do the same: send the
  reduced fix and don't ask again.

### Copying the web's coarse → precise passes

`getCurrentPositionAsync` creates a `CLLocationManager` with `desiredAccuracy` mapped from the
`Accuracy` enum (`Balanced` → 100 m, `High` → 10 m, `Highest` → best) and calls `requestLocation()`
once
([LocationRequester](https://github.com/expo/expo/blob/sdk-57/packages/expo-location/ios/Providers/LocationRequester.swift),
[BaseLocationProvider](https://github.com/expo/expo/blob/sdk-57/packages/expo-location/ios/Providers/BaseLocationProvider.swift),
[LocationAccuracy](https://github.com/expo/expo/blob/sdk-57/packages/expo-location/ios/LocationAccuracy.swift)).
Apple says `requestLocation()` "may take several seconds". If the desired accuracy would take too
long it delivers a less accurate location instead of failing, and it reports `locationUnknown`
only when it cannot get a fix at all
([docs](<https://developer.apple.com/documentation/corelocation/cllocationmanager/requestlocation()>)).
Apple publishes no typical time to fix. The clock sheet prototype should measure it on the phone.

There is no `timeout` option on iOS ([docs](https://docs.expo.dev/versions/latest/sdk/location/)).
The mapping:

| Web (`geolocation.ts`)                                      | Phone                                                                                                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| coarse: `enableHighAccuracy: false`, 8 s, `maximumAge` 60 s | `getLastKnownPositionAsync({ maxAge: 60_000 })`, falling back to `getCurrentPositionAsync({ accuracy: Balanced })` raced against an 8 s timer |
| precise: `enableHighAccuracy: true`, 30 s, `maximumAge` 0   | `getCurrentPositionAsync({ accuracy: Highest })` raced against a 30 s timer                                                                   |
| each fix → `POST /api/attendance/sessions/:id/location`     | same endpoint and body `{ end, latitude, longitude, accuracy }` through `createApiFetch`                                                      |

The race only abandons the promise. The native request keeps running until Core Location answers,
and its result is dropped. Both timers together stay well under the backend's two-minute window.
The body carries no timestamp, so the backend measures that window from the clock event to the
request's arrival. A last-known fix up to 60 s old goes through the same way the web's
`maximumAge` fix does.

If the user leaves the app mid-pass: on iOS an app is "in use" in the foreground "and for a short
time" after it moves to the background
([docs](https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services)).
Without a location background mode, the normal suspension rules apply. The app has about five
seconds after entering the background before it is suspended, unless it holds a
`beginBackgroundTask` assertion
([docs](https://developer.apple.com/documentation/uikit/extending-your-app-s-background-execution-time)),
and starting location updates from the background fails
([docs](<https://developer.apple.com/documentation/corelocation/cllocationmanager/requestwheninuseauthorization()>)).
None of the Expo modules checked here exposes `beginBackgroundTask`. In practice the coarse pass
usually lands, and a precise pass still in flight when the user leaves is lost, or finishes on
return and is silently dropped by the backend if it is more than two minutes late. That matches
the web, where a closed tab loses the same pass. Adding the `location` background mode for this
would be background location use, which the ticket rules out.

### Denied, Allow Once, Ask Next Time

- **Don't Allow**: `status: "denied"`, `canAskAgain: false`. The request call does nothing, and
  `getCurrentPositionAsync` throws, because it checks the permission first
  ([source](https://github.com/expo/expo/blob/sdk-57/packages/expo-location/ios/LocationModule.swift)).
  Skip both passes silently, the way the web returns on `PERMISSION_DENIED`. Only the Settings app
  reverses it. The backend treats declining as "not a state the product has an opinion about", so
  the app shouldn't nag or deep-link to Settings unprompted.
- **Allow Once**: `granted` for the current use, then back to `notDetermined` once the app is no
  longer in use (Apple, above). The next clock prompts again.
- **Ask Next Time Or When I Share** (the Settings option): Apple's docs don't describe it by name.
  From the app's side it presents as `notDetermined`, the same as after Allow Once: `status:
"undetermined"`, `canAskAgain: true`, and the clock action prompts each time. The prototype
  should confirm this on the phone.
- Location Services off system-wide: `hasServicesEnabledAsync()` returns false. Treat it like a
  denial.

Before each clock: `getForegroundPermissionsAsync()`. If undetermined, request (the prompt lands at
the clock tap, in context). If granted, run the passes. If denied, do nothing. The clock itself
never waits on any of this.

## Scheduled local notifications

### Setup

- Install `expo-notifications`, leave its plugin out of `app.json` (see the trap above), and call
  `setNotificationHandler` so a reminder shows while the app is in the foreground
  ([docs](https://docs.expo.dev/versions/latest/sdk/notifications/)).
- No capability, entitlement or APNs key is involved. `getDevicePushTokenAsync` is the only part
  that needs APNs, and the app doesn't call it.

### Triggers

From the SDK 57 types
([source](https://github.com/expo/expo/blob/sdk-57/packages/expo-notifications/src/Notifications.types.ts)):

- Cross-platform: `date` (one-off), `daily`, `weekly` (weekday `1`–`7`, `1` = Sunday), `monthly`,
  `yearly`, `timeInterval` (on iOS a repeating interval must be at least 60 s).
- iOS only: `calendar`, which maps to `UNCalendarNotificationTrigger` date components (year,
  month, day, weekday, hour, minute, `timezone`, `repeats`)
  ([Apple](https://developer.apple.com/documentation/usernotifications/uncalendarnotificationtrigger)).

### The 64 pending limit

Apple: "the system keeps the soonest-firing 64 notifications (with automatically rescheduled
notifications counting as a single notification) and discards the rest"
([UILocalNotification](https://developer.apple.com/documentation/uikit/uilocalnotification)).
That is the deprecated class's page, the only Apple page that states the number. The
UserNotifications pages and Expo's docs don't repeat it. Past the limit nothing errors: the later
requests are dropped without notice. `getAllScheduledNotificationsAsync()` shows what survived.

A repeating trigger counts once, but it cannot skip a single day. One-off `date` triggers over a
rolling window can: 14 days of clock-in and clock-out reminders is 28 requests, well inside 64.

### Cancelling or replacing

- `scheduleNotificationAsync({ identifier, content, trigger })` accepts an `identifier` and returns
  it ([source](https://github.com/expo/expo/blob/sdk-57/packages/expo-notifications/src/scheduleNotificationAsync.ts)).
  Scheduling with an identifier already in use replaces the pending request
  ([Apple](https://developer.apple.com/documentation/usernotifications/unnotificationrequest/identifier)).
  Deterministic ids such as `clock-in:2026-09-28` let the app replace or cancel one day's reminder
  with `cancelScheduledNotificationAsync(id)`.
- **While the app isn't running, nothing can cancel a reminder reliably.** The options:

| Route                                                                   | Free team                                                                                   | What it guarantees                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reconcile on foreground, after each sync pull and after an in-app clock | yes                                                                                         | Correct whenever the app runs. Nothing otherwise.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `expo-background-task`                                                  | yes (Background modes; adds `processing` and a `BGTaskSchedulerPermittedIdentifiers` entry) | A `BGProcessingTaskRequest` with network required and a minimum interval of 15 minutes. The system picks the time from battery, network and usage, it stops if the user force-quits the app, and it doesn't run in the simulator ([docs](https://docs.expo.dev/versions/latest/sdk/background-task/), [source](https://github.com/expo/expo/blob/sdk-57/packages/expo-background-task/ios/BackgroundTaskScheduler.swift)). It can't be aimed at 08:50. |
| Silent push (`content-available`)                                       | **no**: APNs needs the Push Notifications capability                                        | Needs the `remote-notification` background mode. Apple treats it as low priority and doesn't guarantee delivery. It may throttle ("don't try to send more than two or three per hour"), keeps only the newest held one, and discards it if the app was force-quit ([docs](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app)).                                                                        |
| Server-sent alert push instead of a local reminder                      | **no**                                                                                      | The server knows the clock state and sends a reminder only when the person hasn't clocked. This is the only route that is correct by construction.                                                                                                                                                                                                                                                                                                     |

On the free team a reminder can fire after the person has already clocked in on the web. The copy
should stay true either way ("Clock in if you haven't yet"), and tapping the reminder should open
the clock sheet after a sync pull, so it shows the real state.

### Permission timing and provisional authorization

- The first `requestPermissionsAsync` prompts. Later calls don't, and the recorded answer comes
  back. Apple advises asking in context, for example when the person turns reminders on, rather
  than at launch
  ([docs](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications)).
- `allowProvisional: true` grants authorization without a prompt, but provisional notifications
  arrive quietly: no banner, no sound, no lock screen, Notification Center history only. Choosing
  Keep → Deliver Immediately still delivers quietly (same Apple page). That defeats a clock
  reminder, so request full authorization when reminders are switched on.
- Check `getPermissionsAsync()` before each reschedule. The person can change the setting at any
  time (same Apple page).
- `interruptionLevel: "timeSensitive"`, which breaks through Focus and Notification Summary, needs
  the Time Sensitive Notifications capability, which the free team lacks
  ([Apple](https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive)).
  Reminders stay at `active`, so a Focus mode can hold them.

## For the tickets this blocks

- **Reminder times (T-31)**: the device schedules the reminders from what the local store holds.
  Use one-off `date` triggers over a rolling window (14 days, 2 per day), with deterministic ids,
  and rebuild them on foreground, after each sync pull and after each clock. Stay under 64. Don't
  rely on background cancellation. A server-driven push is a paid-program follow-up.
- **Clock sheet prototype (T-35)**: the clock tap triggers the system location prompt (no custom
  screen). Run the two passes with JavaScript timers (8 s, 30 s) and never block the clock on them.
  On the phone, measure time to fix, the reduced-accuracy result, and the "Ask Next Time" state.
- **Free team**: foreground location and local notifications are unaffected. Don't list the
  `expo-notifications` plugin. Silent push, remote reminders and Time Sensitive delivery wait for
  the paid program.
