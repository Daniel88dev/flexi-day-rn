# CI and Dependabot

Every PR and every push to `main` runs one job in `.github/workflows/ci.yml` on Ubuntu: lint,
prettier, typecheck, Jest, and an advisory `pnpm expo install --check`. There is no native build in
CI. A native change is checked by hand in the simulator (`pnpm run ios`) before its PR merges.

## Dependabot and the Expo SDK

`.github/dependabot.yml` groups `expo`, `expo-*`, `@expo/*` and `jest-expo` into one patch-only
`expo-sdk` PR, and ignores the packages whose versions the SDK or ADR 0001 pins. Dependabot cannot
run `pnpm expo install --fix`, and an Expo patch can move those pins. On every `expo-sdk` PR:

```bash
gh pr checkout <number>
pnpm expo install --fix
pnpm expo install --check
git commit -am "Align SDK-pinned packages with pnpm expo install --fix"
git push
```

SDK upgrades stay by hand: `pnpm expo install expo@^<sdk>`, then `pnpm expo install --fix`.

## Expo patches and the age gate

`pnpm expo install --fix` asks Expo's servers for the newest patch of each package, and Expo
publishes a batch of patches at once. Any of them younger than the 3-day `minimumReleaseAge` fails
the install (`ERR_PNPM_NO_MATURE_MATCHING_VERSION`). Install the newest mature patch of each one
with `pnpm add <pkg>@~<version>` instead, and leave the rest to the next `expo-sdk` PR.
`pnpm expo install --check` and `expo-doctor` report the gap as a patch mismatch until then.

`typescript` is excluded from Expo's version checks (`expo.install.exclude` in `package.json`).
It is an alias for `@typescript/typescript6`, whose versions do not follow the `typescript` patches
Expo asks for, and `typecheck` runs TypeScript 7 through `@typescript/native`.
