# Which chart library fits the phone's report?

Research for T-139, under the Reports and Groups map (T-136). Checked on 2026-10-03 against this
repo at `0ce567e` (Expo SDK 57.0.25, React Native 0.86.3, New Architecture, reanimated 4.5.1,
worklets 0.10.1, gesture-handler 2.32, NativeWind `5.0.0-rc.0`).

## Recommendation

Draw the three charts by hand with **`react-native-svg`**, and lay a row of transparent
`Pressable` columns over each chart for touch, `testID` and accessibility labels.

- `react-native-svg` 15.15.5 is already in the lockfile and already linked into the dev client.
  Using it directly needs no prebuild and no new native code.
- The three charts are bars, stacked bars, dotted polylines, one dashed reference line and a
  y-axis. That is little geometry, and the series maths already lives in the web's
  `lib/report/series.ts`.
- Neither library gives per-bar accessibility or `testID`. The overlay does, and this repo
  requires a `testID` on every interactive element.
- Theme colours already reach SVG through `useTone()` in `src/components/ui/icon.tsx`, the same
  path every phosphor icon takes in light and dark mode.
- `victory-native` brings Skia: about 6 MB of app size, a Jest environment swap, and an open
  blank-canvas bug reproduced on this repo's exact version set.

Second choice: `react-native-gifted-charts`, which runs on the same `react-native-svg`. It cannot
draw the team usage chart's one line per member, and it has no accessibility props.

## What the web draws

From `flexi-day/components/report/`, all three on Recharts:

| Chart                  | Shape                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `team-usage-chart`     | Per month: one bar stacked by member, plus one dotted line per member over it. Toggles hide bars, lines or single members. The tooltip lists the month's members top of stack first, with a total. |
| `team-remaining-chart` | Per member: carry-over (translucent) under the year's grant, overdraft stacked below zero in the destructive colour, a zero reference line when overdrawn. Names angle below 90 px per bar.        |
| `member-quota-chart`   | Per month: used stacked under pending (translucent), with a dashed reference line at the monthly target.                                                                                           |

Animation is off in all three (`isAnimationActive={false}`), so nothing here needs reanimated.

## What the repo already has

- `react-native-svg` 15.15.5 is not in `package.json`, but npm installs it as a peer of
  `phosphor-react-native` 3.0.6 and `sonner-native` 0.27.0 (`npm ls react-native-svg`).
  Autolinking picked it up: `ios/Podfile.lock` lists `RNSVG (15.15.5)` and
  `ios/build/generated/autolinking/autolinking.json` links `RNSVG.podspec`.
- Expo SDK 57 pins `react-native-svg` to `15.15.4` (`node_modules/expo/bundledNativeModules.json`).
  `npx expo install react-native-svg` writes `~15.15.4`, which 15.15.5 satisfies, so the lockfile
  and the native build stay put. Add it as a direct dependency anyway, so a phosphor upgrade
  cannot drop it.
- `@shopify/react-native-skia` is not installed. Expo pins it to `2.6.2`.
- Jest already renders phosphor icons, and so `react-native-svg`, under `jest-expo` with no mock
  (`src/components/ui/__tests__/button.test.tsx` and others).
- `useTone()` resolves a CSS variable to a colour string through NativeWind's
  `useUnstableNativeVariable`, with a hex fallback per scheme. `className` does not reach
  third-party components, so every chart colour goes in as a prop whichever option wins.

## Comparison

| Criterion               | `react-native-svg` by hand                                                                                                                                          | `react-native-gifted-charts` 1.4.80                                                                                                                                     | `victory-native` 42.0.1 on Skia                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prebuild / native code  | None. Already linked.                                                                                                                                               | None. Pure JS on `react-native-svg`; the gradient peers are optional.                                                                                                   | Yes. Adds `@shopify/react-native-skia`, a native module, so a prebuild and a dev-client rebuild.                                                                                                                                                                                                                                                                                                        |
| Size added              | Only the chart code we write.                                                                                                                                       | JS only: 376 KB unpacked, plus `gifted-charts-core` at 547 KB unpacked (both counts include `.d.ts`).                                                                   | Skia adds about 6 MB to the iOS download. Victory is 795 KB unpacked, plus `d3-scale`, `d3-shape` and `d3-zoom`.                                                                                                                                                                                                                                                                                        |
| Touch tooltips          | Ours: tap a column `Pressable`, show the web's tooltip content as an RN view.                                                                                       | `renderTooltip` and `focusBarOnPress` on bars, stacked bars included. `pointerConfig` is for line charts.                                                               | `useChartPressState` gives scrub state as shared values; the tooltip is drawn in Skia or positioned by hand.                                                                                                                                                                                                                                                                                            |
| Accessibility labels    | Ours: an `accessibilityLabel` and a `testID` per column.                                                                                                            | None. No `accessib*` or `testID` anywhere in the package. Issue #1043 asks for it, open since 2025-03.                                                                  | None. A Skia canvas is one view. Issue #648 asks for it, open since 2026-02; the workaround given there is a hidden text layer.                                                                                                                                                                                                                                                                         |
| Dark mode               | `useTone()` colours as props, as phosphor does now.                                                                                                                 | Colours as props.                                                                                                                                                       | Colours as props, parsed by Skia. Nobody has checked whether Skia parses what `useUnstableNativeVariable` returns.                                                                                                                                                                                                                                                                                      |
| Jest / RNTL             | Works today with no setup.                                                                                                                                          | Renders through `react-native-svg`, so it should work as is.                                                                                                            | Needs `testEnvironment: "@shopify/react-native-skia/jestEnv.js"`, which replaces the `jest-expo` environment, plus a setup file and CanvasKit WASM.                                                                                                                                                                                                                                                     |
| Fit to the three charts | All three.                                                                                                                                                          | Stacks, negative stacks and reference lines work. A bar chart takes two overlay lines at most (`lineData`, `lineData2`), so team usage cannot draw one line per member. | All three: `StackedBar` splits positive and negative segments, lines come from `Line`. Axis labels need a Skia font from `useFont` or `matchFont`.                                                                                                                                                                                                                                                      |
| Maintenance             | Software Mansion. 15.15.5 on 2026-05-11, repo pushed 2026-10-01.                                                                                                    | One maintainer, frequent patches (1.4.79 and 1.4.80 both on 2026-10-01), 100 open issues.                                                                               | Formidable. 42.0.0 on 2026-08-25, 42.0.1 on 2026-08-31, 87 open issues. Skia itself releases about weekly.                                                                                                                                                                                                                                                                                              |
| Known crashes here      | `react-native-svg` #2878, an iOS `topSvgLayout` EXC_BAD_ACCESS, is open. The app already ships SVG on every screen through phosphor, so charts add no new exposure. | #888, an `isAnimated` crash on BarChart, is open (animation would stay off). #1219, the `pointerConfig` tooltip dead on iOS with the New Architecture, is open.         | Skia #4039 is open: a canvas stops presenting for good when two canvases coexist under a reanimated animated style and a `GestureDetector`. It was reported on Expo 57.0.18, RN 0.86.3, reanimated 4.5.1, worklets 0.10.1, and Skia 2.11.1 and 2.6.2. A report screen with three press-enabled charts matches it. Skia #3925, an iOS use-after-free in `RNSkPictureRenderer::performDraw`, is open too. |

## How the hand-drawn version would look

A sketch for T-143, not a design:

- One chart frame per chart: an `onLayout` width, a y-scale from the series' max and min
  (negative allowed for overdraft), gridlines and y ticks as SVG `Line` and `Text`, x labels as RN
  `Text` under the SVG so `className` and the app fonts apply.
- Bars as SVG `Rect`, stacked in the web's order. The rounded top (`radius={[3,3,0,0]}`) is a
  `Path`.
- Team usage lines as `Polyline` with `strokeDasharray="2 5"` and `strokeLinecap="round"`. The
  web's `type="monotone"` curve can come from `d3-shape`'s `curveMonotoneX` if a straight
  polyline reads badly.
- Reference lines as `Line` with `strokeDasharray`.
- Over the SVG, an absolutely positioned row of `Pressable` columns, one per month or member,
  each with a `testID`, an `accessibilityLabel` that reads out the tooltip's numbers, and an
  `onPress` that selects it. The selected column's tooltip shows as a card above or below the
  chart, in the web's wording.
- Member toggles and legends stay RN views with `className`, as on the web.

Testing: the geometry (scale, stacks, label angling) goes in `src/lib/report/` as plain functions
with unit tests. The chart components get RNTL smoke tests that press a column by `testID` and
read the tooltip text.

## Sources

- Web charts: `flexi-day/components/report/team-usage-chart.tsx`, `team-remaining-chart.tsx`,
  `member-quota-chart.tsx`.
- Repo: `package.json`, `package-lock.json`, `ios/Podfile.lock`,
  `ios/build/generated/autolinking/autolinking.json`, `node_modules/expo/bundledNativeModules.json`,
  `src/components/ui/icon.tsx`.
- npm registry (`npm view`, `npm pack`): versions, publish dates, peer dependencies and unpacked
  sizes of `react-native-svg`, `react-native-gifted-charts`, `gifted-charts-core`,
  `victory-native` and `@shopify/react-native-skia`.
- Package source, read from the tarballs: `gifted-charts-core/dist/BarChart/types.d.ts`
  (`lineData`, `lineData2`), `react-native-gifted-charts/dist/BarChart/RenderStackBars.js`
  (`renderTooltip`), `victory-native/src/cartesian/hooks/useChartPressState.ts`,
  `victory-native/src/cartesian/utils/getStackedBarSegments.ts`,
  `@shopify/react-native-skia/jestEnv.js` and `jestSetup.js`.
- React Native Skia docs, bundle size:
  <https://shopify.github.io/react-native-skia/docs/getting-started/bundle-size>; Jest setup:
  <https://shopify.github.io/react-native-skia/docs/getting-started/installation>.
- Victory Native releases: <https://github.com/FormidableLabs/victory-native-xl/releases>.
- Issues:
  [Skia #4039](https://github.com/Shopify/react-native-skia/issues/4039),
  [Skia #3925](https://github.com/Shopify/react-native-skia/issues/3925),
  [victory-native-xl #648](https://github.com/FormidableLabs/victory-native-xl/issues/648),
  [gifted-charts #1043](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/1043),
  [gifted-charts #1219](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/1219),
  [gifted-charts #888](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/888),
  [react-native-svg #2878](https://github.com/software-mansion/react-native-svg/issues/2878).
