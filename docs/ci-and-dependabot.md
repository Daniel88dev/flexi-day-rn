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

## Expo patches and the trust policy

Expo publishes SDK 57 patches without provenance, while its SDK 58 releases carry it, so pnpm's
`trustPolicy: no-downgrade` rejects every new 57.x version as a possible takeover
(`ERR_PNPM_TRUST_DOWNGRADE`). `trustPolicyExclude` in `pnpm-workspace.yaml` lists each one by
exact version, so an `expo-sdk` patch bump fails its install until the new versions join the list.
Before adding one, check that `pnpm view <pkg>@<version> _npmUser` names a maintainer that
`pnpm view <pkg> maintainers` lists. Then add the versions the error names. The error shows at
most 20, so run `pnpm install` again until it passes. A plain install also drops the versions the
lockfile no longer holds (`trustPolicyExcludePrune`). If Dependabot cannot open the PR at all, make
the same patch bump by hand on a branch.

The move to SDK 58 removes the whole list.
