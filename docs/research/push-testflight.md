# Push to a TestFlight build

Research for fenro task T-326 (map T-324), gathered 2026-10-17. The question: what Apple, Expo
and EAS require for a push sent by `flexi-day-be` straight to APNs to reach the TestFlight build of
`com.flexiday.app`, built by `eas build --platform ios --profile production --auto-submit` on EAS
cloud, while dev clients keep building through Xcode.

Earlier research: `docs/research/push-delivery.md` on branch `research/push-delivery` of
`flexi-day-be` (T-24). This note does not repeat it.

## Summary

- **The planned key does not exist.** Apple documents topic-specific APNs keys as single
  environment. A key valid for both Sandbox and Production is, per every source found, team
  scoped. Two workable shapes, compared under [The key](#the-key):
  1. Keep `SCNLNZW72W` (Sandbox, topic-specific) for dev clients and add a Production
     topic-specific key for TestFlight. Two `.p8` files. Matches Apple's recommendation.
  2. Create one team-scoped "Sandbox & Production" key. One `.p8`, but it can send to every app on
     the team. Apple's page says new team-scoped keys are Sandbox or Production; third-party guides
     from 2026 say the portal still offers "Sandbox & Production" for team-scoped keys.
     Unconfirmed against Apple.
- **Environments:** a TestFlight install registers with production APNs and a dev client built
  through Xcode with sandbox APNs. The provisioning profile decides, not `__DEV__`.
- **Entitlement:** `expo-notifications` writes `aps-environment` = `development`. Signing for App
  Store distribution turns it into `production` in the `.ipa`. Nothing needs setting.
- **Capability sync:** dropping `plugins/without-push-entitlement.js` makes `eas build` turn Push
  Notifications back on, which invalidates the App Store profile EAS holds. The first build after
  it must be interactive and replace the profile, exactly as for Sign in with Apple. No new build
  profile.
- **App side:** `getDevicePushTokenAsync()` returns only the token. The runtime signal is
  `Application.getIosPushNotificationServiceEnvironmentAsync()` from `expo-application`, already a
  dependency: `"development"` means sandbox, anything else means production. Expo's own
  `getExpoPushTokenAsync()` uses exactly that rule.
- **EAS push setup:** decline it. Set `cli.promptToConfigurePushNotifications: false` in
  `eas.json` so `eas build` stops asking.

## The key

### What Apple documents

From [Establishing a token-based connection to APNs][apple-token]:

- Team-scoped keys "restrict usage to either Sandbox or Production". At most two per environment.
  Existing team-scoped keys that work in both environments "will continue to be supported", but
  Apple recommends environment-specific keys.
- Topic-specific keys sign "for specific team topics within a single environment". Up to 200 per
  environment, up to 400 topics per key. "A topic-specific key can have at most one related key
  in the same environment", and tokens from a key and its related key may share a connection.
- Apple announced both key kinds in February 2025 ([forum announcement][apple-announce]).

From [Create a private key][apple-create-key]: configuring APNs on a new key asks for "the
environment configuration and type of key (Team Scoped or Topic Specific)". A related key for a
topic-specific key is created from the key's detail page: Edit next to Apple Push Notification
service, then **Create Related Key**, then choose its environment. Account Holder or Admin only.
The `.p8` downloads once.

No Apple page lists the environment menu's options for each key type. Secondary sources agree that
"Sandbox & Production" exists and needs **Team Scoped (All Topics)**:
[OneSignal][onesignal] ("Sandbox-only or Production-only keys will be rejected on save"),
[a 2026-10-08 PR in pagis][pagis] ("A key for both environments can only be Team Scoped"), and
[Nunify, 2026-06-02][nunify]. Treat "a topic-specific key cannot be Sandbox & Production" as
confirmed by Apple's wording and "a team-scoped Sandbox & Production key can still be created" as
unconfirmed.

### Can a key's environment change after creation?

Not documented. [Revoke, edit, and download keys][apple-edit-key] lists only the name and the
enabled services as editable. The documented way to cover a second environment with a
topic-specific key is a related key. Unconfirmed: whether the portal lets an existing key's
environment be changed.

### The existing key

`SCNLNZW72W` is a **Sandbox, topic-specific** key for `com.flexiday.app` (T-47). It cannot sign
production pushes. The two options:

|                               | A: keep `SCNLNZW72W`, add a Production topic-specific key | B: one team-scoped Sandbox & Production key       |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `.p8` files the backend holds | 2 (plus the Sign in with Apple key)                       | 1 (plus the Sign in with Apple key)               |
| Scope if leaked               | `com.flexiday.app` only, one environment each             | Every app on team `S6FC47MMXJ`, both environments |
| Apple's recommendation        | Yes                                                       | No, kept only for existing keys                   |
| Can be created today          | Yes, per Apple's docs                                     | Unconfirmed against Apple                         |
| Backend picks key by          | Registration's environment                                | Nothing, one key                                  |

Option A is the one Apple's docs support. It also means the map's "one new key" becomes "one new
Production key", and the key-storage tickets (T-325, T-328) carry three `.p8` files, not two. A
related key versus an unrelated second Production topic-specific key makes no difference here: the
backend opens one connection per host anyway.

### The JWT

From [Establishing a token-based connection to APNs][apple-token]:

- Header `{"alg": "ES256", "kid": "<10-char Key ID>"}`, claims
  `{"iss": "<10-char Team ID>", "iat": <seconds since epoch>}`, signed with the `.p8` (ES256 only).
  Sent as `authorization: bearer <jwt>`.
- Refresh "no more than once every 20 minutes and no less than once every 60 minutes". An `iat`
  older than an hour gets `403 ExpiredProviderToken`; a new token more often than every 20 minutes
  on one connection gets `429 TooManyProviderTokenUpdates`.
- APNs ties a connection to the key used on its first push. A token from an unrelated key, another
  environment or a team-scoped key on the same connection is an error (`403
UnrelatedKeyIdInToken`). Under option A, keep one connection per environment, each with its own
  key and its own cached JWT.

Hosts ([Sending notification requests to APNs][apple-send]): `api.sandbox.push.apple.com` for
development, `api.push.apple.com` for production, port 443 or 2197.

## Environments

### Which token each build gets

[`aps-environment`][apple-aps-env]: "Xcode sets the value of the entitlement based on your app's
current provisioning profile. For example, if you're using a development provisioning profile,
Xcode sets the value to `development`. Production provisioning profile and [TestFlight] use
`production`." The `development` environment is the sandbox.

- **TestFlight build** from EAS: App Store profile, so production. Its tokens go to
  `api.push.apple.com`.
- **Dev client** from `npm run ios:device`: development profile, so sandbox, including the
  `--configuration Release` build, which is still signed with a development profile. `__DEV__` is
  false there and the token is still sandbox, so `__DEV__` is the wrong signal.
- **Simulator:** registers with the sandbox (T-24 note). It has no provisioning profile.

A TestFlight install and a dev client replace each other on the phone (`docs/releasing.md`), so
the same phone flips between a sandbox and a production token. The app re-registers on every
launch, as Apple asks ([Registering your app with APNs][apple-register]), so the stored
registration follows.

### Wrong host versus dead token

From [Handling notification responses from APNs][apple-responses]:

| Response                                                                    | Meaning                                                                                                                             | What the backend does                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `400 BadDeviceToken`                                                        | "The specified device token is invalid. Verify that the request contains a valid token and that the token matches the environment." | Not proof of a dead token. See below.               |
| `410 Unregistered`                                                          | Token inactive for the topic; body carries `timestamp`                                                                              | Delete the registration                             |
| `410 ExpiredToken`                                                          | Token expired                                                                                                                       | Delete the registration                             |
| `400 DeviceTokenNotForTopic`                                                | Token belongs to another app                                                                                                        | Delete the registration                             |
| `403 BadEnvironmentKeyIdInToken`                                            | The key's environment does not match the host                                                                                       | Configuration bug: alert, never touch registrations |
| `403 InvalidProviderToken`, `ExpiredProviderToken`, `UnrelatedKeyIdInToken` | JWT problem                                                                                                                         | Configuration bug: alert, never touch registrations |

A sandbox token sent to the production host comes back as `BadDeviceToken`, and so does a
malformed token. Apple says not to retry either as is, and that `BadDeviceToken` makes APNs drop
the connection sooner. Suggested rule, not from Apple: on `BadDeviceToken`, send once to the other
environment's host with that environment's key. If it lands, correct the registration's stored
environment. If it also fails with `BadDeviceToken`, delete the registration. Only a `410`, or
`BadDeviceToken` from both hosts, deletes. Since the app reports its environment from the profile
(below), the retry should be rare and worth a log line.

In the development environment each response also carries `apns-unique-id`, which the Push
Notifications Console's delivery log can look up ([same page][apple-responses]).

## The entitlement in an EAS production build

- `expo-notifications` 57.0.22, `plugin/build/withNotificationsIOS.js`: the plugin takes an
  undocumented `mode` option, default `'development'`, and writes
  `aps-environment = mode` only when the entitlement is not already set. Prebuild runs the plugin
  whenever the package is installed (this repo's `CLAUDE.md`), so `app.json` does not need to list
  it unless an option is passed.
- Expo's SDK 57 docs ([source][expo-notif-v57]): "The iOS APNs entitlement is _always_ set to
  'development'. Xcode automatically changes this to 'production' in the archive generated by a
  release build." The v57 option table does not list `mode` at all.
- Apple's [`aps-environment`][apple-aps-env] page says the same from the profile side.

So the `.ipa` carries `production`, set by Xcode's signing from EAS's App Store profile. Expo's
plugin only supplies the key; EAS sets nothing itself. Leave `mode` unset: `production` would make
the dev client's development profile disagree with its entitlements.

This depends on the App Store profile carrying Push. A profile generated while Push is off on the
App ID has no `aps-environment`, and the signed app would get none. Check on the first push build
with the command in `docs/releasing.md` ("Associated Domains"): the `codesign` output must show
`aps-environment` `production`. Not verified here: no build with the entitlement exists yet.

The dev client keeps `development` from the plugin, and the development profile Xcode creates
matches it. `scripts/ios-device.js` passes `-allowProvisioningUpdates`, so Xcode refreshes the
development profile once Push is back on the App ID.

## Capability sync once the strip plugin goes

What EAS does ([iOS capabilities][expo-caps], eas-cli v24.10.0, the installed version):

- `eas build` compares the introspected entitlements with the App ID. An entitlement present
  enables the capability; a capability enabled remotely but absent locally is disabled. Push
  Notifications maps to `aps-environment` and is synced ([`capabilityList.ts`][eas-caplist]).
  `EXPO_NO_CAPABILITY_SYNC=1` skips it.
- The sync only runs when the CLI holds an Apple session. In
  [`SetUpTargetBuildCredentials.ts`][eas-target], `bestEffortAppStoreAuthenticateAsync()` returns
  at once in non-interactive mode ([`context.ts`][eas-context]), so `--non-interactive` never
  syncs.
- Enabling a capability means "You will need to regenerate any provisioning profiles that use this
  bundle identifier" ([iOS capabilities][expo-caps], manual setup). EAS checks its stored profile
  against Apple and treats any status other than `ACTIVE` as invalid
  ([`validateProvisioningProfile.ts`][eas-validate]). Interactively it then offers to reuse and
  repair the profile or to create a new one ([`SetUpProvisioningProfile.ts`][eas-profile]).

What this means here:

1. Today every interactive `eas build` turns Push **off** on the App ID, because the strip plugin
   removes `aps-environment`. Unless build 5 ran with `EXPO_NO_CAPABILITY_SYNC=1`, Push is off now
   (not checked: needs the portal).
2. The push-client ticket removes `./plugins/without-push-entitlement` from `app.json` and deletes
   the file. Prebuild then keeps `aps-environment` `development`.
3. The first `eas build --platform ios --profile production --auto-submit` after it runs
   **interactively** and signs in to Apple when asked. The sync enables Push, the App Store
   profile turns invalid, and EAS offers to repair or replace it. Accept. This is the same step as
   `docs/native-sign-in-setup.md` section 5.2. The release loop already runs without
   `--non-interactive`, so the only new thing is answering the Apple login and profile prompts.
4. No new build profile in `eas.json`, and no `EXPO_NO_CAPABILITY_SYNC`. Later builds sync with no
   change and ask nothing.
5. Check the `.ipa`'s entitlements as above.

A note on `docs/releasing.md`: it says `--non-interactive` "neither syncs capabilities nor
replaces the profile". The first half holds. The second half is out of date: in v24.10.0 a
non-interactive build tries the App Store Connect API key EAS stores for submissions
(`tryAuthenticateAppStoreWithEasAscApiKeyAsync`) and can then repair the profile. It still cannot
enable Push, so a non-interactive first build would produce a profile without push. The rule
"run the first build after a capability change interactively" stands.

## The app side

- [`getDevicePushTokenAsync()`][expo-notif-v57] returns `{ type: 'ios', data }` with the hex
  token and nothing about the environment (installed source,
  `expo-notifications/build/getDevicePushTokenAsync.js`).
- `expo-application` 57.0.3, already in `package.json`, exports
  `getIosPushNotificationServiceEnvironmentAsync()`. Its native side reads `aps-environment` from
  the app's `embedded.mobileprovision` (`ios/EXApplication/EXProvisioningProfile.m`). Its JSDoc
  promises `'development'`, `'production'`, or `null` on the simulator.
- `expo-notifications`' own `getExpoPushTokenAsync()` decides sandbox with exactly this call:
  `development` only when the answer is `'development'`, otherwise production, errors included
  (`src/getExpoPushTokenAsync.ts`, `shouldUseDevelopmentNotificationService`).

Use the same rule, with one adjustment for the simulator. The simulator answers `null` and
registers with the sandbox, while an App Store or TestFlight install may also answer `null` if
Apple strips the embedded profile. Unconfirmed: whether a
TestFlight install still carries `embedded.mobileprovision`; a forum thread reports TestFlight
removing it on macOS ([thread 767609][apple-forum-tf]). So the rule is:

| `getIosPushNotificationServiceEnvironmentAsync()` | Device                                     | Environment              |
| ------------------------------------------------- | ------------------------------------------ | ------------------------ |
| `'development'`                                   | any                                        | sandbox                  |
| `'production'`                                    | any                                        | production               |
| `null`                                            | simulator (`expo-device` `isDevice` false) | sandbox                  |
| `null`                                            | real device                                | production               |
| throws                                            | real device                                | production, as Expo does |

This beats `__DEV__` or the build profile: it reads the same profile that decided the token's
environment, so a Release-configuration dev client reports sandbox correctly.

## EAS offers to decline

- `eas build` asks "Would you like to set up Push Notifications for your project?" whenever no
  push key is on EAS and `expo-notifications` is installed
  ([`IosCredentialsProvider.ts`][eas-provider]). **Yes** creates an APNs key on the Apple account
  and stores it on Expo's servers. That key would count against Apple's per-environment limits and
  serve nobody. Answer **No, don't ask again**, which writes
  `"cli": { "promptToConfigurePushNotifications": false }` into `eas.json`, or add that line in the
  push-client ticket so the prompt never shows.
- `eas credentials -p ios` has push key actions too (`CreatePushKey`, `AssignPushKey`). Leave them
  alone; the backend's key lives in 1Password (`docs/releasing.md`, "Credentials").
- Non-interactive builds skip the prompt entirely.

## What changes in the plan

- "One new topic-specific key set to Sandbox & Production" is not a key Apple documents. Pick A
  (add a Production topic-specific key, keep `SCNLNZW72W`) or B (one team-scoped Sandbox &
  Production key, unconfirmed). With A the backend holds two APNs keys and chooses by the
  registration's environment.
- The first release build with push needs the interactive Apple login and profile repair. No new
  profile, no CI change.
- `eas.json` gains `cli.promptToConfigurePushNotifications: false`.
- The app reports its environment from `expo-application`, not from `__DEV__`.

## Open points

- Whether the portal still lets a new team-scoped key be "Sandbox & Production" (option B). Check
  in the Keys › + › Configure screen before choosing.
- Whether an existing key's APNs environment can be edited.
- Whether Push is currently on or off on the App ID `com.flexiday.app`.
- Whether a TestFlight install keeps `embedded.mobileprovision`. The table above gives the right
  answer either way on a real device.
- The first push build's `.ipa` entitlements, checked with `codesign`.

## Sources

Apple:

- [Establishing a token-based connection to APNs][apple-token]
- [Handling notification responses from APNs][apple-responses]
- [Sending notification requests to APNs][apple-send]
- [Registering your app with APNs][apple-register]
- [`aps-environment` entitlement][apple-aps-env]
- [Create a private key][apple-create-key], [Revoke, edit, and download keys][apple-edit-key]
- [New features for APNs token authentication, February 2025][apple-announce]

Expo and EAS:

- [`expo-notifications` SDK 57 docs][expo-notif-v57]
- [EAS iOS capabilities][expo-caps]
- eas-cli v24.10.0: [`SetUpTargetBuildCredentials.ts`][eas-target], [`context.ts`][eas-context],
  [`SetUpProvisioningProfile.ts`][eas-profile], [`validateProvisioningProfile.ts`][eas-validate],
  [`capabilityList.ts`][eas-caplist], [`IosCredentialsProvider.ts`][eas-provider]
- Installed packages: `expo-notifications` 57.0.22, `expo-application` 57.0.3

Secondary, for the portal's key menu only: [OneSignal][onesignal], [pagis PR #179][pagis],
[Nunify][nunify], [Apple forum thread 767609][apple-forum-tf].

[apple-token]: https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns
[apple-responses]: https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns
[apple-send]: https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
[apple-register]: https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns
[apple-aps-env]: https://developer.apple.com/documentation/bundleresources/entitlements/aps-environment
[apple-create-key]: https://developer.apple.com/help/account/keys/create-a-private-key/
[apple-edit-key]: https://developer.apple.com/help/account/keys/revoke-edit-and-download-keys/
[apple-announce]: https://developer.apple.com/forums/thread/774646
[apple-forum-tf]: https://developer.apple.com/forums/thread/767609
[expo-notif-v57]: https://github.com/expo/expo/blob/main/docs/pages/versions/v57.0.0/sdk/notifications.mdx
[expo-caps]: https://docs.expo.dev/build-reference/ios-capabilities/
[eas-target]: https://github.com/expo/eas-cli/blob/v24.10.0/packages/eas-cli/src/credentials/ios/actions/SetUpTargetBuildCredentials.ts
[eas-context]: https://github.com/expo/eas-cli/blob/v24.10.0/packages/eas-cli/src/credentials/context.ts
[eas-profile]: https://github.com/expo/eas-cli/blob/v24.10.0/packages/eas-cli/src/credentials/ios/actions/SetUpProvisioningProfile.ts
[eas-validate]: https://github.com/expo/eas-cli/blob/v24.10.0/packages/eas-cli/src/credentials/ios/validators/validateProvisioningProfile.ts
[eas-caplist]: https://github.com/expo/eas-cli/blob/v24.10.0/packages/eas-cli/src/credentials/ios/appstore/capabilityList.ts
[eas-provider]: https://github.com/expo/eas-cli/blob/v24.10.0/packages/eas-cli/src/credentials/ios/IosCredentialsProvider.ts
[onesignal]: https://documentation.onesignal.com/docs/en/ios-p8-token-based-connection-to-apns
[pagis]: https://github.com/pagis-co/pagis/pull/179
[nunify]: https://help.nunify.com/en/articles/15344396-app-store-creating-an-apple-push-notification-apns-key
