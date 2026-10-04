# Running the dev client on a phone

The everyday loop is the iOS Simulator. A real iPhone matters for the Keychain, the local network
prompt, push and anything else the simulator fakes. Both go through Xcode; TestFlight builds are
in [`releasing.md`](releasing.md).

The signing sections below still describe the free personal team and its seven-day profiles. The
app now signs with the paid team in `app.json`, and fenro task T-68 (the push client) rewrites them.

## Mac prerequisites

- Xcode with the iOS platform installed and selected: `xcode-select -p` prints the Xcode path.
- CocoaPods: `brew install cocoapods`. The Homebrew formula bundles its own Ruby, so the system Ruby
  does not matter.
- A UTF-8 locale in the shell that runs `pod install`. Without one CocoaPods dies with
  `Unicode Normalization not appropriate for ASCII-8BIT`. Terminal.app sets `LANG` by default; a
  shell that does not needs `export LANG=en_US.UTF-8`; `npm run ios:device` sets it for the
  commands it runs.
- The Apple ID added under Xcode › Settings › Accounts. Xcode creates the personal team and an
  "Apple Development" certificate the first time it signs. The team id lives in `app.json` as
  `ios.appleTeamId`, so `expo prebuild` stamps it into the generated project and
  `npm run ios:device` passes it to `xcodebuild`; nothing has to be clicked in Xcode after a
  regeneration. The id is the `OU` of the certificate subject, not the value in
  parentheses in its name:

  ```bash
  security find-certificate -c "Apple Development" -p | openssl x509 -noout -subject
  ```

## Simulator

```bash
npm run ios
```

Generates `ios/` if missing, runs `pod install`, builds, installs on the default simulator and
starts Metro. `npm start` alone is enough once the dev client is installed.
`npm run prebuild` regenerates `ios/` from scratch, pods included, so the next `npm run ios` runs
`pod install` again.

## Phone, first time

1. Plug the phone in over USB. Tap **Trust** on the phone and enter its passcode.
2. On the phone: Settings › Privacy & Security › Developer Mode › on. The phone restarts and asks
   once more after the restart.
3. Xcode › Window › Devices and Simulators shows the phone. Leave **Connect via network** on so
   later builds install over Wi-Fi.
4. Build, install and launch:

   ```bash
   npm run ios:device
   ```

   With one connected iPhone the script picks it; paired phones that are locked away or out of
   reach are skipped. With more than one, name it with
   `npm run ios:device -- --device <udid|name>` (`xcrun devicectl list devices` lists them). It
   generates `ios/` first if it is missing, and reruns `pod install` when `package-lock.json` is
   newer than `ios/Pods/Manifest.lock`, which is when a dependency change can add or bump a native
   module. A change to `app.json` or a config plugin still needs `npm run prebuild` first. It
   then signs with the team from `app.json` and registers the device on the free account. The default
   is a Debug dev client, which loads its JavaScript from Metro, so keep `npm start` running.
   The launch needs the phone unlocked; if it was locked, the install still lands and the script
   prints the `devicectl` command that launches it.

5. First launch fails with "Untrusted Developer". On the phone: Settings › General › VPN & Device
   Management › the Apple ID under Developer App › Trust. Launch again.
6. The app asks for local network access the first time it talks to Metro or the backend. Allow it.
   Denying it silently breaks both; Settings › Privacy & Security › Local Network turns it back on.

## iOS 27 needs the scene lifecycle

Xcode 27 links against the iOS 27 SDK, and iOS 27 terminates any such app at launch unless it
adopts the UIKit scene lifecycle: the icon opens and the app closes at once, no dialog. The
iOS 26.5 simulator does not enforce this, so the simulator can work while the phone does not. Expo
57.0.23 supports the scene lifecycle behind an opt-in, set in `app.json` through
`expo-build-properties` as `ios.enableSceneSupport: true`. Keep it on; prebuild then writes the
`UIApplicationSceneManifest` and the scene delegate into the generated project.

## Reading a launch crash on the phone

`devicectl` reports only an exit code or "terminated due to signal 5" for a launch crash, and
there is no CLI to pull the crash report. lldb over the device tunnel shows the trap:

```bash
xcrun devicectl device process launch --start-stopped --device <udid> com.flexiday.app --json-output /tmp/l.json
PID=$(node -e 'console.log(require("/tmp/l.json").result.process.processIdentifier)')
(sleep 25; xcrun devicectl device process resume --device <udid> --pid $PID) &
lldb --batch -o "device select <udid>" -o "device process attach --pid $PID" \
  -o "script import time; time.sleep(12)" -o "continue" \
  -o "script import time; time.sleep(20)" -o "thread info" -o "bt 40"
```

The sleeps matter: `--batch` runs the next command before the attach has settled, and the process
stays suspended until `resume` from a second shell. The phone has to be unlocked, or SpringBoard
ends the launch on its own.

## Why `ios:device` is not `expo run:ios --device`

`expo run:ios --device` only passes `-allowProvisioningUpdates` and
`-allowProvisioningDeviceRegistration` to `xcodebuild` when the generated project names no team.
`ios.appleTeamId` in `app.json` always writes one, so Expo builds without the flags, and Xcode then
cannot create a profile when its store holds none for `com.flexiday.app`:

```text
No profiles for 'com.flexiday.app' were found ... Automatic signing is disabled and unable to
generate a profile.
```

`scripts/ios-device.js` runs `xcodebuild` itself with both flags, `DEVELOPMENT_TEAM` read from
`app.json` and `CODE_SIGN_STYLE=Automatic`, builds into `ios/build`, installs with
`xcrun devicectl device install app` and launches with `xcrun devicectl device process launch`.
Keep `appleTeamId` in `app.json`: it makes prebuild produce the same signed project on every
machine.

## Every seven days

Free provisioning expires after seven days; the app then refuses to open, and Xcode eventually
drops the expired profile from `~/Library/Developer/Xcode/UserData/Provisioning Profiles/`. Run
`npm run ios:device` again, with the same `--configuration` as the build on the phone. The script
lets Xcode create a new profile whether the store is empty or not; no Xcode UI needed. A new
profile has to be trusted again on the phone (step 5 above) before the app opens.
Other free-account limits: at most ten app ids per week and three signed apps per device at once.

## Production build

A Release build embeds the JavaScript bundle and runs without Metro, against the production
backend:

1. Put the production URL in `.env`. If `.env` already exists, note what it holds and set
   `EXPO_PUBLIC_API_URL=https://api.flexi-day.com` in it by hand. Otherwise create it:

   ```bash
   echo "EXPO_PUBLIC_API_URL=https://api.flexi-day.com" > .env
   ```

   The bundling step inside the Xcode build reads `.env` itself, so the URL is baked into the app.
   Without it the script warns that the app will call `http://localhost:8080` on the phone.

2. Build, install and launch:

   ```bash
   npm run ios:device -- --configuration Release
   ```

3. After each new profile the phone asks for trust again: Settings › General › VPN & Device
   Management › the Apple ID under Developer App › Trust.
4. Put `.env` back the way step 1 found it: restore the old contents, or delete the file if step 1
   created it. Otherwise every later Debug build and `npm start` targets production too.

`plugins/without-push-entitlement` was verified on a free-team Release device build on
2026-09-28: the signed app carries no `aps-environment` entitlement and the personal team signs
it.

## Reaching the backend

The phone cannot use `localhost`. `src/lib/api.ts` picks the base URL:

1. `EXPO_PUBLIC_API_URL`, when set in `.env`. Copy `.env.example` and edit.
2. Otherwise the host Metro is served from, on port `8080`. On the simulator that is the Mac; on a
   phone it is the Mac's LAN address, read from `Constants.expoConfig.hostUri`.

So with the backend on the same Mac as Metro no `.env` is needed for either target. The backend
listens on every interface, so `curl http://<mac-lan-ip>:8080/health` from another machine on the
Wi-Fi is the quickest check. The generated `Info.plist` allows plain HTTP to local network addresses
(`NSAllowsLocalNetworking`); any other HTTP host needs HTTPS.

Native requests carry no `Origin` header, so the backend's CORS list does not apply to the phone.
better-auth's `trustedOrigins` still has to include the `flexiday://` scheme for the sign-in flow;
that lands with the native session work.

Sign-in on the phone uses the real flow against the LAN backend. `npm run dev:scenario` at the
workspace root seeds users and prints their password.

On the simulator a dev build skips the form: `flexiday://dev-sign-in?ticket=…&to=/path` redeems a
dev sign-in ticket minted by the backend's `/api/dev/sign-in-ticket` and lands on `to`; the
workspace `ui-test` skill has the whole loop.

## Invite links open the app

An invite email links to `https://www.flexi-day.com/join/?token=<secret>`. Associated Domains is
the capability that lets iOS hand that link to the app instead of Safari. Three pieces make it
work:

- `ios.associatedDomains` in `app.json` lists `applinks:www.flexi-day.com`. Prebuild writes it into
  `ios/FlexiDay/FlexiDay.entitlements` as `com.apple.developer.associated-domains`.
- The web serves `https://www.flexi-day.com/.well-known/apple-app-site-association` as
  `application/json`. It names `S6FC47MMXJ.com.flexiday.app` for `/join/*` only, so no other web
  page opens the app. The path needs the trailing slash. `/join?token=` stays in Safari.
- The App ID `com.flexiday.app` has Associated Domains enabled, and the profile the build signs
  with includes it.

The last piece is a one-time step. Enabling a capability makes every existing profile for the App
ID invalid, so regenerate each one:

1. developer.apple.com › Account › Certificates, IDs & Profiles › Identifiers › `com.flexiday.app`.
   Tick **Associated Domains** under Capabilities, press **Save**, then **Confirm**. With automatic
   signing Xcode can usually enable the capability on the App ID by itself, so this tick is the
   sure path rather than a hard requirement.
2. `npm run prebuild`, then `npm run ios:device`. The script passes `-allowProvisioningUpdates`,
   so Xcode replaces the development profile with one that carries the capability.
   `expo run:ios --device` would not, and its build fails with "Provisioning profile … doesn't
   include the com.apple.developer.associated-domains entitlement"; see
   [Why `ios:device` is not `expo run:ios --device`](#why-iosdevice-is-not-expo-runios---device).
   Xcode's Signing & Capabilities tab, with automatic signing on, refreshes the development
   profile as well.
3. The App Store profile is EAS's to refresh; see "Associated Domains" in
   [`releasing.md`](releasing.md).

The simulator needs no profile, so `npm run prebuild` and `npm run ios` are enough there.

Check what a Debug build is signed with. A Release build lands in
`ios/build/Build/Products/Release-iphoneos/` instead.

```bash
codesign -d --entitlements - --xml ios/build/Build/Products/Debug-iphoneos/FlexiDay.app
```

The output lists `com.apple.developer.associated-domains` with `applinks:www.flexi-day.com`, and no
`aps-environment`.

Expo Router turns both link forms into the same route. The `https` link's path becomes the route
(`/join/`), and in `flexiday://join?token=` the host `join` does. Both arrive with `token` as a
search param. The Groups build adds the join screen at `src/app/join.tsx`, outside `(app)`, so both
URLs land there and it renders signed out. Once that route exists, open it on the simulator with a
token issued by the local backend:

```bash
xcrun simctl openurl booted "flexiday://join?token=<secret>"
```

A dev build talks to the local backend. A real invite link tapped on a phone running one opens the
join screen and then gets a 404, because the token only exists in production. That is expected.
Test the `https` link end to end on a TestFlight build.

## Google sign-in needs a rebuild

`@react-native-google-signin/google-signin` ships native code, so the rule in
[`CLAUDE.md`](../CLAUDE.md) for such packages applies: `npm run prebuild`, then a dev-client
rebuild. Its config plugin registers the reversed iOS client id from `app.json` (`iosUrlScheme`) as
a URL scheme. That is not a capability, so no provisioning profile changes.

The sheet opens on the iOS 27 simulator: the Google button raises the system prompt for
`accounts.google.com`, and Cancel there comes back as "Sign-in was cancelled."

## Microsoft sign-in needs no rebuild

`expo-auth-session` is JavaScript only, and the native modules it relies on (`expo-web-browser`,
`expo-crypto`, `expo-application`, `expo-linking`) were already in the dev client. Metro alone
picks it up. The redirect `flexiday://auth` rides on the app's existing scheme.

The sheet opens on the iOS 27 simulator: the Microsoft button raises the system prompt for
`login.microsoftonline.com`, Continue opens Microsoft's sign-in page in the auth session browser,
and closing it comes back as "Sign-in was cancelled."

## Known state (2026-10-03)

- Mac: Xcode 27.0, CocoaPods 1.17.0 from Homebrew, Node 24.
- Apple ID: `daniel.hrynusiw@gmail.com`, paid team `S6FC47MMXJ` since 2026-10-03. The free personal
  team `7DD5F92WWS` is retired.
- Phone: "Daniel's iPhone pro", iPhone 16 Pro on iOS 27.0, paired.
