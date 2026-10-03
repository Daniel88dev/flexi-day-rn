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
straight to APNs with its own key, which lives in 1Password. Answer "no" if EAS offers to set up
push notifications.

## Associated Domains

Invite links on `https://www.flexi-day.com/join/` open the app through the Associated Domains
capability; [`device-testing.md`](device-testing.md) has the whole setup. A capability added to the
App ID makes the App Store profile EAS holds invalid, so the first build after it needs a new one.

`eas build` syncs the App ID's capabilities with the entitlements in the introspected config
(`npx expo config --type introspect`), then checks the profile against the App ID. Run that first
build interactively, without `--non-interactive`, and sign in to Apple when it asks.
`--non-interactive` neither syncs capabilities nor replaces the profile. EAS enables Associated
Domains if the portal step was skipped, and offers to replace the invalid profile.
`eas credentials -p ios` shows the profile and can remove it before the build, which then creates
a new one.

The sync runs both ways, so it also turns off capabilities the entitlements lack.
`plugins/without-push-entitlement.js` strips `aps-environment`, so every `eas build` turns Push
Notifications off on the App ID until the push client keeps the entitlement, unless the build runs
with `EXPO_NO_CAPABILITY_SYNC=1`.

Check the entitlements of the `.ipa` EAS built (download it from the build page):

```bash
unzip -q <build>.ipa -d /tmp/ipa
codesign -d --entitlements - --xml /tmp/ipa/Payload/FlexiDay.app
```

## When Apple rejects an upload

`eas submit` reports success as soon as the upload lands; Apple's processing comes after. A
rejected binary never appears in TestFlight, and the only signal is an `ITMS-` email to the account
holder. Fix the cause and build again; the new build number comes on its own.

- **ITMS-90683, missing purpose string:** a linked library compiles in an API that needs an
  `NS…UsageDescription` key, whether the app calls it or not. Give the key a string in `app.json`,
  through the owning library's config plugin option where it has one, rather than `false`. Build 1
  failed this way on `NSMotionUsageDescription` from `expo-location`.
