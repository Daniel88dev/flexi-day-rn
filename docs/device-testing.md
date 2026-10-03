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

## Known state (2026-10-03)

- Mac: Xcode 27.0, CocoaPods 1.17.0 from Homebrew, Node 24.
- Apple ID: `daniel.hrynusiw@gmail.com`, paid team `S6FC47MMXJ` since 2026-10-03. The free personal
  team `7DD5F92WWS` is retired.
- Phone: "Daniel's iPhone pro", iPhone 16 Pro on iOS 27.0, paired.
