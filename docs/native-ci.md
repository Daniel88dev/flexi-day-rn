# Native CI

Every PR and every push to `main` runs two jobs in `.github/workflows/ci.yml`: `check` on Ubuntu
(lint, prettier, typecheck, Jest, and an advisory `npx expo install --check`), and `ios-e2e` on
the `xcode-27` macOS runner. `ios-e2e` builds the app in Release for the simulator, starts
`flexi-day-be` beside it and runs the Maestro flows in `.maestro/`. A dependency bump that breaks a
native module fails there.

The design and its trade-offs are in the research for fenro T-25, on the
`research/native-ci-guard` branch (`docs/research/native-ci-guard.md`).

## What the job does

1. Builds a Release simulator app, arm64 only, with `EXPO_PUBLIC_API_URL=http://localhost:8080`.
   Release embeds the JS bundle and skips the dev launcher, so no Metro runs. The build signs ad
   hoc and needs no Apple account.
2. Starts Postgres from Homebrew and `flexi-day-be` at the commit in the `FLEXI_DAY_BE_REF`
   repository variable, with the dev surface on and a token generated in the job. It seeds
   `POST /api/dev/scenario` with a password generated in the job.
3. Runs each flow in `.maestro/` against the simulator, as `owner@dev.local` with that password,
   and retries a failed flow once. On failure, the Maestro output and the backend log are uploaded
   as the `ios-e2e-<attempt>` artifact.

The job uses no secrets, so Dependabot PRs run all of it. Repository variables do reach Dependabot
runs; secrets do not.

Caches: `ios/Pods` keyed on `package-lock.json` and `app.json`, and ccache for the C and
Objective-C pods. Only pushes to `main` write them; PRs read them. DerivedData is not cached:
one build is about 3 GB.

## The pinned backend

The job runs `flexi-day-be` at `FLEXI_DAY_BE_REF`, never at its `main`, so a red backend does not
block this repo. Bump it on purpose when the app needs newer backend behaviour:

```bash
gh variable set FLEXI_DAY_BE_REF --repo Daniel88dev/flexi-day-rn \
  --body "$(git -C ../flexi-day-be rev-parse origin/main)"
```

Without the variable the job fails at its first step and says so.

## Dependabot and the Expo SDK

`.github/dependabot.yml` groups `expo`, `expo-*`, `@expo/*` and `jest-expo` into one patch-only
`expo-sdk` PR, and ignores the packages whose versions the SDK or ADR 0001 pins. Dependabot cannot
run `npx expo install --fix`, and an Expo patch can move those pins. On every `expo-sdk` PR:

```bash
gh pr checkout <number>
npx expo install --fix
npx expo install --check
git commit -am "Align SDK-pinned packages with npx expo install --fix"
git push
```

SDK upgrades stay by hand: `npx expo install expo@^58 --fix`.

## Running the flows locally

The flows need Maestro 2.10 (with Java 17 or newer), a Release build on a booted simulator, and a
backend seeded with `npm run dev:scenario` from the workspace root:

```bash
LANG=en_US.UTF-8 npm run prebuild
EXPO_PUBLIC_API_URL=http://localhost:8080 xcodebuild -workspace ios/FlexiDay.xcworkspace \
  -scheme FlexiDay -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' ARCHS=arm64 -derivedDataPath /tmp/flexi-day-dd
xcrun simctl install booted /tmp/flexi-day-dd/Build/Products/Release-iphonesimulator/FlexiDay.app
maestro test .maestro -e EMAIL=owner@dev.local -e PASSWORD=<the scenario password>
```

The Release app and the dev client share the bundle id, so installing one replaces the other.

## Adding a flow

One flow per screen, as `.maestro/<screen>.yaml`. Start it with `- runFlow: subflows/sign-in.yaml`,
which clears the app's state and Keychain and signs in through the real sign-in screen. Select by
visible text first; add a `testID` where the text is ambiguous or translated, and pin it with a
Jest test so a refactor that drops it fails in `check` rather than twenty minutes into `ios-e2e`.
