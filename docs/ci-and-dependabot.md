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

SDK upgrades stay by hand: `pnpm expo install expo@^58 --fix`.
