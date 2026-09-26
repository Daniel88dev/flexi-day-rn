# Native CI guard: iOS simulator build and Maestro flows on GitHub's macOS runners

Research for fenro task T-25 (map T-22), 2026-09-26. The question: can CI build this app for the
iOS Simulator and run a Maestro smoke flow per screen on GitHub-hosted macOS runners, so a
Dependabot bump that breaks a native module fails CI instead of passing it?

## Answer

Yes. Build a **Release** configuration for the simulator: it embeds the JS bundle, skips the dev
launcher and needs no Metro. Run it on the `xcode-27` runner label, which carries the Xcode build
used on the dev Mac. Start `flexi-day-be` and Postgres on the same runner and seed through the
existing `/api/dev/scenario` surface. The flows then sign in through the real sign-in screen with
a seeded password. Nothing in the backend has to change, and the job needs no secrets, so
Dependabot PRs can run it.

Cost: macOS minutes are free on a public repo. Expect roughly **20–25 minutes per PR** with warm
caches and **35–45 minutes** on a cache miss. Those figures are extrapolated from a local run
(below), not measured on a runner yet.

## What was verified locally

On the dev Mac (Apple M2 Pro, 10 cores, Xcode 27.0 `27A266a`), in a clean worktree of `main`:

| Step                                                                     | Time                        |
| ------------------------------------------------------------------------ | --------------------------- |
| `npm ci`                                                                 | 14 s                        |
| `expo prebuild --platform ios --no-install`                              | 6 s                         |
| `pod install` (local CocoaPods cache warm)                               | 1 min 19 s                  |
| `xcodebuild` Release, `generic/platform=iOS Simulator`, cold             | 10 min 3 s (1,152 compiles) |
| Same, no changes, warm DerivedData                                       | 49 s                        |
| `xcodebuild` Release, `ARCHS=arm64`, cold, while a simulator was booting | 13 min (578 compiles)       |

- The generic simulator destination builds a universal binary: arm64 and x86_64, twice the
  compiles. CI should pass `ARCHS=arm64 ONLY_ACTIVE_ARCH=YES`, since the runners are Apple silicon.
- The Release `.app` installed on a fresh iOS 27.0 simulator launched straight into the welcome
  screen, with no Metro running, NativeWind styles applied and the embedded fonts rendering. The
  NativeWind v5 RC compiles fine under the production bundler (`export:embed --dev false`).
- The simulator build signs "Sign to Run Locally" (`codesign --sign -`). No Apple account,
  certificate or profile is involved, so the personal team id in `app.json` does not matter in CI.
- What still compiles from source: React Native core and its dependencies come prebuilt
  (`RCT_USE_PREBUILT_RNCORE`, `RCT_USE_RN_DEP` default to on in the generated `Podfile`), and Expo
  modules are precompiled XCFrameworks by default on iOS since SDK 56
  ([Expo: precompiled modules](https://docs.expo.dev/guides/prebuilt-expo-modules/)). Nearly all
  of the 578 compiles are third-party pods: `RNScreens` (131), `RNReanimated` (119), `RNSVG` (94),
  `RNWorklets` (38), `ReactCodegen` (36), `RNGestureHandler` (25) and `react-native-safe-area-context` (17).
- DerivedData after one arm64 build is 2.8 GB. That is too big to be worth caching under the 10 GB
  per-repo Actions cache limit. ccache is the better cache.

## Runner images and Xcode

- Standard arm64 macOS runners are an M1 with **3 cores, 7 GB RAM and 14 GB SSD**, and they are
  "free and unlimited on public repositories"
  ([GitHub: hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)).
  A free account runs at most **5 macOS jobs at once**, and a job can run for up to 6 hours
  ([GitHub: limits](https://docs.github.com/en/actions/reference/limits)).
- GA labels are `macos-26` and `macos-15`; `macos-14` is deprecated
  ([runner-images README](https://github.com/actions/runner-images/blob/main/README.md)).
  `macos-26` defaults to Xcode 26.6 and ships the iOS 26.2/26.4/26.5 simulator runtimes
  ([macos-26 arm64 readme](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md)).
- Xcode 27 is on the **`xcode-27`** label, a public preview
  ([runner-images#14404](https://github.com/actions/runner-images/issues/14404)). The image is
  macOS 27.0 with Xcode 27.0 `27A266a` as its default, which is the exact build on the dev Mac,
  plus Xcode 27.1 and a 27.2 beta, and an iOS 27.0 simulator runtime
  ([xcode-27 arm64 readme](https://github.com/actions/runner-images/blob/main/images/macos/xcode-27-arm64-Readme.md)).
  "Preview" means the software can be unstable and queueing can be longer.
- SDK 57 needs Xcode 26.4 or newer and iOS 16.4 or newer
  ([Expo: SDK versions](https://docs.expo.dev/versions/latest/)), so both images can build it.
- **Recommendation: `xcode-27`**, pinned with
  `sudo xcode-select -s /Applications/Xcode_27.0.app`. It matches the toolchain the app ships
  with; iOS 27's scene-lifecycle rule (see `docs/device-testing.md`) already showed that Xcode 26
  and 27 can behave differently. Fall back to `macos-26` with Xcode 26.6 if the preview label
  queues badly. Move to `macos-27` once GitHub makes it GA.
- Nothing extra is preinstalled for this job: no ccache, no PostgreSQL, no Maestro. CocoaPods
  1.17.0, Node 24, Java 17/21 and `xcbeautify` are there (same readmes).

## Build configuration: Release, not the dev client

- In a Release build the dev launcher steps aside. `ExpoDevLauncherReactDelegateHandler` returns
  `nil` when `!EXAppDefines.APP_DEBUG`, and the app boots its root view from the embedded bundle
  (`node_modules/expo-dev-launcher/ios/ReactDelegateHandler/ExpoDevLauncherReactDelegateHandler.swift`,
  expo-dev-launcher 57.0.20). The launch test above confirms it.
- A Debug dev-client build would need Metro running on the runner, and it opens the launcher UI
  first. Flows would then have to drive the launcher, and the build would not be the bundle a
  user runs. Don't.
- Expo documents this path: `npx expo run:ios --configuration Release` with `--device generic`
  produces a simulator build for CI
  ([Expo CLI](https://docs.expo.dev/more/expo-cli/)). Expo's own e2e job builds `BareExpo` with
  `configuration: 'Release'` and `isSimulator: true`
  ([`start-ios-e2e-test.ts`](https://github.com/expo/expo/blob/416d06128a27fba9a89868b69c12d0f8227d83e8/apps/bare-expo/scripts/start-ios-e2e-test.ts)).
  Plain `xcodebuild` is more predictable in CI than `expo run:ios`, which also wants to boot and
  install:

  ```bash
  xcodebuild -workspace ios/FlexiDay.xcworkspace -scheme FlexiDay \
    -configuration Release -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' ARCHS=arm64 ONLY_ACTIVE_ARCH=YES \
    -derivedDataPath build | xcbeautify
  ```

- The backend URL is fixed at bundle time. A Release build has no `hostUri`, so
  `resolveApiUrl` in `src/lib/api.ts` falls back to `http://localhost:8080`, which is correct on
  the runner. Set `EXPO_PUBLIC_API_URL=http://localhost:8080` explicitly in the build step anyway,
  so a later change to the fallback cannot point CI somewhere else.
- Plain HTTP to `localhost` is allowed: `NSAllowsLocalNetworking` covers unqualified domains,
  `.local` and IP addresses
  ([Apple: NSAllowsLocalNetworking](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking)),
  and "the simulator doesn't support local network privacy", so no prompt appears
  ([Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)).

## Caching

- **ccache** for the C/C++/Objective-C pods: `brew install ccache`, then `USE_CCACHE=1` before
  `pod install`. The generated `Podfile` reads that variable (`ccache_enabled?`), so `app.json`
  stays as it is. Cache `~/Library/Caches/ccache` with `actions/cache`. ccache does not cover
  Swift, which was about a third of the compile time here, so a warm build still compiles Swift.
- **CocoaPods**: cache `ios/Pods` keyed on `ios/Podfile.lock`. The lockfile only exists after
  prebuild, so key on `package-lock.json` plus `app.json` instead, or run prebuild first.
- **Caches are written from `main`.** A PR run can read the base branch's caches but only writes
  to its own merge ref, and entries unused for 7 days are evicted
  ([GitHub: dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)).
  The existing `push: branches: [main]` trigger is what keeps them warm.
- **Later: fingerprint repack.** Expo's own `ios-build` job uses `expo/actions/fingerprint` and
  `expo/actions/repack-app-artifact`. When the native fingerprint has not changed, it repacks the
  last `.app` with a new JS bundle instead of recompiling
  ([expo test-suite.yml](https://github.com/expo/expo/blob/3aadbd360b29b4d985f984dbe44c6cc586509902/.github/workflows/test-suite.yml)).
  That would bring most PRs, which are JS-only, down to minutes. The action is marked
  "experimental and might change without notice"
  ([repack-app-artifact README](https://github.com/expo/actions/tree/main/repack-app-artifact)),
  so add it once the plain pipeline is stable.

## Maestro on the runner

- Install with `curl -Ls "https://get.maestro.mobile.dev" | bash`, pinned with `MAESTRO_VERSION`,
  on Java 17 or newer ([Maestro docs](https://docs.maestro.dev/llms-full.txt), "Install" and CLI
  sections). The current CLI is 2.10.0
  ([releases](https://github.com/mobile-dev-inc/maestro/releases)). Expo wraps the installer in a
  retry loop, because "a CDN 504 once left this step green with no binary installed"
  ([expo setup-maestro](https://github.com/expo/expo/blob/main/.github/actions/setup-maestro/action.yml)).
  Copy that.
- Boot one of the simulators the image already has (`xcrun simctl boot`, then
  `xcrun simctl bootstatus -b`), install the `.app`, and run `maestro test --format junit`. Start
  the boot before the build: a first boot is slow. On the dev Mac a brand-new device took over 6
  minutes while a build was compiling beside it.
- **The iOS driver starts slowly.** The default driver startup timeout is 120 s on iOS, and the
  docs suggest raising it to 180 s in CI (`MAESTRO_DRIVER_STARTUP_TIMEOUT=180000`). Expo sets
  180 s
  ([e2e-common.ts](https://github.com/expo/expo/blob/579528fb513598bade660212996fb3705784c57a/apps/bare-expo/scripts/lib/e2e-common.ts)).
  A September 2026 report confirms the CLI works on iOS 27.0 simulators but needs that timeout
  raised for the driver's cold start
  ([maestro#3606](https://github.com/mobile-dev-inc/maestro/issues/3606)).
- **Flakiness is real and Expo plans for it.** Expo retries a failed flow up to 3 times and
  annotates the retry as "Flaky e2e flow" (same `e2e-common.ts`). An open issue reports the iOS
  driver sometimes failing its first request with `kAXErrorServerNotFound`. Since Xcode 26, each
  failed driver session then starts a `simctl diagnose` that "can run for 10 minutes"
  ([maestro#3633](https://github.com/mobile-dev-inc/maestro/issues/3633)). Put `timeout-minutes`
  on the Maestro step and retry once per failed flow.
- Keychain state survives reinstalls on iOS, and this app keeps its session there.
  `launchApp: { clearKeychain: true }` resets it. On iOS, `clearState` reinstalls the whole app
  (Maestro docs, `clearKeychain` and `clearState`). Every flow should start with both, or chain
  flows on purpose after one sign-in.
- Permission prompts for `expo-location`, `expo-notifications` and `expo-image-picker` are set on
  launch: `launchApp: { permissions: { location: inuse, notifications: allow, photos: allow } }`.
  Maestro grants everything by default, and it taps **Allow** on the iOS notification prompt,
  which iOS never grants silently (Maestro docs, "Permissions").
- Time per flow: Expo's 26 September 2026 run spent 10.5 minutes in its iOS Maestro step
  ([run 36239038683](https://github.com/expo/expo/actions/runs/36239038683)). Its suite is much
  larger than ours and uses image comparison. For short smoke flows, plan on one driver cold start
  of 1–2 minutes plus 20–60 s per flow, so about 5–8 minutes for six to eight screens.

## How the flows sign in

**Run the real backend on the same runner.** It needs no backend change:

1. Postgres: service containers only work on Ubuntu runners
   ([GitHub: service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers)),
   and a macOS runner has no Docker. Install Postgres with Homebrew (`postgresql@17`), start it,
   and create the database.
2. Check out `Daniel88dev/flexi-day-be`, which is public, so no token is needed. Pin it to a ref
   held in a repository variable that defaults to `main`. Then `npm ci`, `npm run build`,
   `npm run db:migrate`, and start it in the background. `flexi-day-be`'s own CI already boots the
   app with six variables (`PORT`, `NODE_ENV=test`, `DATABASE`, `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL`, and `TRUSTED_ORIGINS` including `flexiday://`). Add
   `DEV_TOOLS_ENABLED=true` and a `DEV_TOOLS_TOKEN` generated in the job.
3. All five dev-surface gates in `flexi-day-be/docs/invariants.md` hold as they are: the router is
   mounted, `NODE_ENV` is not `production`, `DATABASE` is localhost, the caller is on loopback,
   and the token matches.
4. Seed with one request, whose body accepts a fixed password:
   `curl -X POST localhost:8080/api/dev/scenario -H "x-dev-token: $DEV_TOOLS_TOKEN" -H 'content-type: application/json' -d '{"password":"…"}'`.
   The workspace's `tools/dev-cli.mjs scenario` sends the same request.
5. Pass the email and password to Maestro with `-e`. A shared `subflows/sign-in.yaml` types them
   into the sign-in screen. That exercises the real native sign-in, the device id header and the
   Keychain.

Alternatives, rejected:

- **Stubbed API.** Maestro drives the app from outside and has no local request mocking, so it
  would take a fake server covering better-auth's sign-in and session endpoints plus the sync
  pull. That fake drifts from the backend, and drift is the opposite of what this guard is for.
- **App-side test mode** (a launch argument that injects a session). This puts a bypass into the
  shipping binary and still needs a backend for data.

The cost of the real backend is coupling: a broken `flexi-day-be@main` turns this repo's CI red.
The pinned-ref variable is the release valve.

## Dependabot grouping for an Expo app

The repo has no `dependabot.yml` yet; the sibling repos do, and the pattern below follows theirs.

- Expo's `bundledNativeModules.json` pins the SDK-owned versions. Some pins are exact:
  `react`/`react-dom` 19.2.3, `react-native` 0.86.3, `react-native-reanimated` 4.5.1,
  `react-native-worklets` 0.10.1, and `@react-native-community/datetimepicker` 9.1.0 once it is
  added. Others are tilde ranges: `react-native-screens`, `-gesture-handler`, `-safe-area-context`
  and every `expo-*`. `expo-image-picker`, `expo-location` and `expo-notifications` will land as
  `~57.0.x`.
- Dependabot cannot run `expo install --fix`, so it must not move SDK-pinned packages on its own.
  A dependency goes to the first group it matches, and `ignore` accepts `update-types` per
  dependency name
  ([Dependabot options](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)).

```yaml
- package-ecosystem: npm
  directory: /
  schedule: { interval: weekly }
  groups:
    expo-sdk:
      patterns: ["expo", "expo-*", "@expo/*", "jest-expo"]
      update-types: [patch]
    minor-and-patch:
      update-types: [minor, patch]
  ignore:
    # SDK upgrades are by hand: npx expo install expo@^58 --fix
    - dependency-name: "expo"
      update-types: ["version-update:semver-major", "version-update:semver-minor"]
    - dependency-name: "expo-*"
      update-types: ["version-update:semver-major", "version-update:semver-minor"]
    - dependency-name: "jest-expo"
      update-types: ["version-update:semver-major", "version-update:semver-minor"]
    # Exact SDK pins: only `expo install --fix` moves these
    - dependency-name: "react"
    - dependency-name: "react-dom"
    - dependency-name: "react-native"
    - dependency-name: "react-native-reanimated"
    - dependency-name: "react-native-worklets"
    - dependency-name: "@react-native-community/datetimepicker"
    # SDK-ranged: patches only, inside the tilde range
    - dependency-name: "react-native-screens"
      update-types: ["version-update:semver-major", "version-update:semver-minor"]
    - dependency-name: "react-native-gesture-handler"
      update-types: ["version-update:semver-major", "version-update:semver-minor"]
    - dependency-name: "react-native-safe-area-context"
      update-types: ["version-update:semver-major", "version-update:semver-minor"]
    # Pinned exactly by ADR 0001
    - dependency-name: "nativewind"
    - dependency-name: "react-native-css"
    - dependency-name: "tailwindcss"
    - dependency-name: "@tailwindcss/postcss"
    - dependency-name: "lightningcss"
```

- The `expo-sdk` group PR is where the native guard pays off. A patch of `expo` can move the
  exact pins above (a newer `react-native` patch, for instance), so whoever handles that PR runs
  `npx expo install --fix` on the branch and pushes.
- `npx expo install --check` "exits with non-zero in Continuous Integration"
  ([Expo CLI](https://docs.expo.dev/more/expo-cli/)). It is a cheap Ubuntu step, but keep it
  **advisory** (`continue-on-error`): the expected versions come from Expo's servers and move
  whenever Expo publishes a patch, so a required check would turn red with no code change. It
  fails today, on `expo` 57.0.23 against an expected ~57.0.25 and four other patch drifts.
- The job uses no secrets, and it must stay that way: workflows triggered by Dependabot get a
  read-only `GITHUB_TOKEN` and no Actions secrets
  ([GitHub: Dependabot on Actions](https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions)).
  A dev token generated inside the job keeps it that way.

## Recommended pipeline

Keep the Ubuntu `check` job as it is, plus the advisory `expo install --check`. Add one macOS job,
`ios-e2e`, on `xcode-27`, for every PR and every push to `main`, with
`concurrency: cancel-in-progress` per ref and `timeout-minutes: 60`. It stays one job, because
splitting the build from the flows costs a second runner setup and an artifact round trip for no
gain at this size.

| Step                                                                                      | Warm           | Cold           |
| ----------------------------------------------------------------------------------------- | -------------- | -------------- |
| checkout, Node, `npm ci`, restore ccache and Pods                                         | 2 min          | 2 min          |
| `brew install ccache postgresql@17`, start Postgres, boot simulator (background)          | 1–2 min        | 1–2 min        |
| `expo prebuild`, `pod install` (`USE_CCACHE=1`)                                           | 1–2 min        | 2–3 min        |
| backend: checkout, `npm ci`, build, migrate, start, seed (background, overlaps the build) | 0              | 0              |
| `xcodebuild` Release arm64                                                                | 8–12 min       | 20–30 min      |
| install Maestro, install the app, run flows (one retry)                                   | 6–9 min        | 6–9 min        |
| **Total**                                                                                 | **~20–25 min** | **~35–45 min** |

The build figures scale the local measurement to 3 M1 cores. An uncontended arm64 build on 10 M2
Pro cores should take about 330 s, half the 603 s universal build, since it runs half the
compiles. They agree with Expo's own `ios-build` job, a much bigger
app, which takes 17–36 minutes on `macos-26`. The first real run replaces these numbers.

Flows live in `.maestro/`, one per screen (dashboard, requests, clock, attendance, settings,
notifications), plus `subflows/sign-in.yaml`. Selectors are visible text first. The screens carry
only 4 `testID`s today, so add ids where text is ambiguous or localized (`en`/`cs`). Upload the
JUnit report and `~/.maestro/tests` as artifacts when a run fails.

Make the job a required check only after about two weeks of green runs on `main`.

## Main risks

1. **Maestro driver flakiness on iOS**, plus the 10-minute `simctl diagnose` after a failed driver
   session ([maestro#3633](https://github.com/mobile-dev-inc/maestro/issues/3633)). Mitigate with a
   180 s driver timeout, one retry per flow, and step timeouts.
2. **`xcode-27` is a preview label**: unstable software, possible queueing. `macos-26` with Xcode
   26.6 is the fallback. It is GA but differs from the shipping toolchain.
3. **Runner capacity**: 3 cores and 7 GB RAM running a compile, a simulator, Postgres and Node
   side by side. Memory pressure can slow the build or kill the simulator. If it does, split the
   build and the flows into two jobs and pass the `.app` as an artifact, as Expo does.
4. **Cross-repo coupling**: a red `flexi-day-be@main` blocks mobile PRs. Pin the backend ref
   through a repository variable.
5. **Cold-cache runs** after 7 days without a push to `main` cost 35–45 minutes.
6. **Dependabot cannot run `expo install --fix`**, so the `expo-sdk` group PR needs a hand step.
   The guard catches a broken native build; it cannot fix the pins.
7. **Push entitlements** from `expo-notifications` on an ad-hoc-signed simulator build were not
   exercised here. Simulator builds skip provisioning, so the risk is low. Check it when that
   module lands.
