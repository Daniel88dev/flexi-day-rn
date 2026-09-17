# Running the dev client on a phone

The everyday loop is the iOS Simulator. A real iPhone matters for the Keychain, the local network
prompt, push and anything else the simulator fakes. Both go through Xcode with a free Apple ID: no
Apple Developer Program, no EAS, no TestFlight.

## Mac prerequisites

- Xcode with the iOS platform installed and selected: `xcode-select -p` prints the Xcode path.
- CocoaPods: `brew install cocoapods`. The Homebrew formula bundles its own Ruby, so the system Ruby
  does not matter.
- A UTF-8 locale in the shell that runs `pod install`. Without one CocoaPods dies with
  `Unicode Normalization not appropriate for ASCII-8BIT`. Terminal.app sets `LANG` by default; a
  shell that does not needs `export LANG=en_US.UTF-8`.
- The Apple ID added under Xcode › Settings › Accounts. Xcode creates the personal team and an
  "Apple Development" certificate the first time it signs. The team id lives in `app.json` as
  `ios.appleTeamId`, so `expo prebuild` stamps it into the generated project and nothing has to be
  clicked in Xcode after a regeneration. The id is the `OU` of the certificate subject, not the value in
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
4. Build and install:

   ```bash
   npm run ios:device
   ```

   Pick the phone from the list. Xcode signs with the personal team and registers the device on
   the free account.

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

## Every seven days

Free provisioning expires after seven days; the app then refuses to open. Run `npm run ios:device`
again. Xcode re-provisions on its own thanks to `-allowProvisioningUpdates`; no Xcode UI needed.
Other free-account limits: at most ten app ids per week and three signed apps per device at once.

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

## Known state (2026-09-17)

- Mac: Xcode 27.0, CocoaPods 1.17.0 from Homebrew, Node 24.
- Apple ID: `daniel.hrynusiw@gmail.com`, personal team `7DD5F92WWS`.
- Phone: "Daniel's iPhone pro", iPhone 16 Pro on iOS 27.0, paired.
