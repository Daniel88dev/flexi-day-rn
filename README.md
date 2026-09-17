# flexi-day-rn

The iPhone app for [Flexi Day](https://flexi-day.com), a vacation and day-off management product.
Expo SDK 57, Expo Router, TypeScript, NativeWind v5. It talks to
[flexi-day-be](https://github.com/Daniel88dev/flexi-day-be) and lives alongside the other repos in
[flexi-day-workspace](https://github.com/Daniel88dev/flexi-day-workspace).

## Requirements

- Node 24 (`.nvmrc`)
- Xcode with the iOS platform installed, for the native build
- CocoaPods (`brew install cocoapods`)

## Commands

| Command              | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| `npm start`          | Metro for the dev client                                          |
| `npm run ios`        | generate `ios/` if needed, build and run the dev client           |
| `npm run ios:device` | the same, on a plugged-in iPhone ([docs](docs/device-testing.md)) |
| `npm run prebuild`   | regenerate `ios/` from `app.json` (continuous native gen)         |
| `npm run lint`       | eslint                                                            |
| `npm run typecheck`  | `tsc --noEmit`                                                    |
| `npm run format`     | prettier over the repo                                            |
| `npm run test`       | jest                                                              |

`ios/` is generated and gitignored. Native configuration goes into `app.json` or a config plugin.

## Contributing

`main` is protected. Every change goes on a branch and merges by squash through a PR. CI runs
lint, prettier, typecheck and the tests; there is no native build in CI.

## License

MIT. See [LICENSE](LICENSE).
