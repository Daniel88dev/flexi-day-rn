# flexi-day-rn

The iPhone app for [Flexi Day](https://flexi-day.com), a vacation and day-off management product.
Expo SDK 58, Expo Router, TypeScript, NativeWind v5. It talks to
[flexi-day-be](https://github.com/Daniel88dev/flexi-day-be) and lives alongside the other repos in
[flexi-day-workspace](https://github.com/Daniel88dev/flexi-day-workspace).

## Requirements

- Node 24 (`.nvmrc`)
- pnpm, the version pinned by `packageManager` in `package.json`
- Xcode with the iOS platform installed, for the native build
- CocoaPods (`brew install cocoapods`)

## Commands

| Command               | What it does                                                                  |
| --------------------- | ----------------------------------------------------------------------------- |
| `pnpm start`          | Metro for the dev client                                                      |
| `pnpm run ios`        | generate `ios/` if needed, build and run the dev client                       |
| `pnpm run ios:device` | build, install and launch on a paired iPhone ([docs](docs/device-testing.md)) |
| `pnpm run prebuild`   | regenerate `ios/` from `app.json` (continuous native gen)                     |
| `pnpm run lint`       | eslint, with warnings failing the run                                         |
| `pnpm run typecheck`  | `tsc --noEmit` on TypeScript 7                                                |
| `pnpm run format`     | prettier over the repo                                                        |
| `pnpm run test`       | jest                                                                          |

`ios/` is generated and gitignored. Native configuration goes into `app.json` or a config plugin.
After any dependency change, run `pnpm run prebuild` before building the dev client: `Podfile.lock`
records paths inside `node_modules/.pnpm/`, which move when a dependency does.

## Environment

Both are optional and read as literal `process.env.EXPO_PUBLIC_*` expressions, so Expo inlines
them at build time. Copy [`.env.example`](.env.example) to `.env` to set them.

| Variable              | What it does                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | the backend. Without it the app targets the Metro host on port 8080, so a phone on the LAN reaches the Mac |
| `EXPO_PUBLIC_WEB_URL` | the web app the phone links out to for sign-up and password reset. Defaults to `https://flexi-day.com`     |

## Contributing

`main` is protected. Every change goes on a branch and merges by squash through a PR. CI runs
lint, prettier, typecheck and the tests. Dependabot's `expo-sdk` PRs need `pnpm expo install --fix`
run on their branch by hand ([docs](docs/ci-and-dependabot.md)).

## License

MIT. See [LICENSE](LICENSE).
