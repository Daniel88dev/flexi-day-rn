# Releasing to TestFlight

Release builds compile on EAS Build in the cloud, signed with EAS-managed credentials, and go to
App Store Connect through EAS Submit. Dev-client builds stay on Xcode
([`device-testing.md`](device-testing.md)).

## Accounts and ids

| What                         | Value                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| Apple Developer Program team | `S6FC47MMXJ`, Individual, account `daniel.hrynusiw@gmail.com` |
| Bundle id                    | `com.flexiday.app`, registered with Push Notifications        |
| App Store Connect app        | "Flexi Day", Apple ID `6818769107`, SKU `flexi-day-ios`       |
| EAS project                  | `@daniel88dev/flexi-day`, id in `app.json`                    |
| EAS plan                     | Free (2026-10: 15 iOS builds a month, low-priority queue)     |

## The loop

```bash
eas build --platform ios --profile production --auto-submit
```

1. EAS uploads the working tree, minus everything `.gitignore` lists, builds it and submits the
   `.ipa` to App Store Connect (`submit.production.ios.ascAppId` in `eas.json`).
2. Apple processes the upload for 5 to 30 minutes and emails the account holder either way.
3. In App Store Connect › TestFlight, add the build to the internal testing group if the group
   does not distribute automatically. Internal testers skip beta review.
4. Testers install from the TestFlight app on the phone.

A build that installs from TestFlight replaces a dev client on the same phone, and the reverse,
because both are `com.flexiday.app`.

## Versions

`version` in `app.json` is the marketing version; raise it by hand for a release. The build number
lives on EAS (`cli.appVersionSource: remote`) and the production profile increments it on every
build, so App Store Connect never sees the same one twice. `eas build:version:get -p ios` reads it.

## Environment

`.env` is gitignored, so the builder never sees it. The production profile in `eas.json` sets
`EXPO_PUBLIC_API_URL=https://api.flexi-day.com`; `EXPO_PUBLIC_WEB_URL` falls back to
`https://flexi-day.com` in code. A new `EXPO_PUBLIC_*` variable needs a production value there too.

The profile pins Node to an exact version (`"node"` in `eas.json`), not `.nvmrc`'s `24`, because
the builder runs `npm ci` with the npm that ships with that Node, and `package-lock.json` only
installs cleanly under the npm major that wrote it. Move the pin together with the local Node.

## Export compliance

`ios.config.usesNonExemptEncryption: false` in `app.json` answers Apple's encryption question for
every build: the app uses only HTTPS and hashing, both exempt. Without it TestFlight holds each build
until someone answers by hand. Adding encryption of its own means revisiting this.

## Credentials

EAS holds the Apple distribution certificate, the App Store provisioning profile and an App Store
Connect API key, all created on the first `eas build` and `eas submit`. `eas credentials -p ios`
shows and rotates them. Later builds ask no Apple questions.

The APNs key (`.p8`) is not an EAS credential and EAS should not create one: the backend sends push
straight to APNs with its own key, which lives in 1Password. `cli.promptToConfigurePushNotifications`
is `false` in `eas.json`, so `eas build` never offers to set up push notifications. Never accept an
EAS push key, and leave the push key actions in `eas credentials` alone.

## Associated Domains

Invite links on `https://www.flexi-day.com/join/` open the app through the Associated Domains
capability; [`device-testing.md`](device-testing.md) has the whole setup. A capability added to the
App ID makes the App Store profile EAS holds invalid, so the first build after it needs a new one.

`eas build` syncs the App ID's capabilities with the entitlements in the introspected config
(`npx expo config --type introspect`), then checks the profile against the App ID. Run that first
build interactively, without `--non-interactive`, and sign in to Apple when it asks. EAS enables
Associated Domains if the portal step was skipped, and offers to replace the invalid profile.
`eas credentials -p ios` shows the profile and can remove it before the build, which then creates
a new one.

`--non-interactive` never syncs capabilities, because the sync needs an Apple sign-in. Since
eas-cli 24.10 it does try the App Store Connect API key EAS stores for submissions and can repair
the profile with it, but a profile repaired that way carries only the capabilities the App ID
already has. A capability the build has to turn on still needs the interactive build.

The sync runs both ways, so it also turns off capabilities the entitlements lack.

## Push notifications

Prebuild runs the `expo-notifications` config plugin, which writes `aps-environment` as
`development`; its `mode` option stays unset. Signing with the App Store profile turns it into
`production` in the `.ipa`, so a TestFlight install registers with production APNs and an Xcode dev
client with the sandbox. The app reads which one from the embedded profile
(`src/lib/push/environment.ts`), never from `__DEV__`.

Until the push client landed, a plugin stripped the entitlement, and every interactive `eas build`
turned Push Notifications off on the App ID. The first build with the entitlement turns it back on,
which makes the App Store profile invalid. Run that build interactively, the same step as
[section 5.2 of the sign-in runbook](native-sign-in-setup.md#52-the-first-eas-build-once):

1. `eas build --platform ios --profile production --auto-submit`, without `--non-interactive`.
2. Sign in to Apple when it asks. The sync enables Push Notifications on `com.flexiday.app`.
3. Accept when EAS offers to repair or replace the invalid profile.
4. If EAS offers to create a push key, decline. `eas.json` should stop it asking.

Later builds find nothing to change and ask nothing. Check the first one's `.ipa` with the commands
below: the output has to list `aps-environment` as `production`.

Check the entitlements of the `.ipa` EAS built (download it from the build page):

```bash
unzip -q <build>.ipa -d /tmp/ipa
codesign -d --entitlements - --xml /tmp/ipa/Payload/FlexiDay.app
```

## Sign in with Apple

Sign in with Apple is a second capability on the App ID. It invalidates the App Store profile the
same way and needs the same interactive build once. That step, and the order it runs in after the
portal work, is section 5.2 of the sign-in runbook,
[The first `eas build`, once](native-sign-in-setup.md#52-the-first-eas-build-once).

## When Apple rejects an upload

`eas submit` reports success as soon as the upload lands; Apple's processing comes after. A
rejected binary never appears in TestFlight, and the only signal is an `ITMS-` email to the account
holder. Fix the cause and build again; the new build number comes on its own.

- **ITMS-90683, missing purpose string:** a linked library compiles in an API that needs an
  `NS…UsageDescription` key, whether the app calls it or not. Give the key a string in `app.json`,
  through the owning library's config plugin option where it has one, rather than `false`. Build 1
  failed this way on `NSMotionUsageDescription` from `expo-location`.
