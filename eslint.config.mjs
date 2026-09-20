import { defineConfig, globalIgnores } from "eslint/config";
import eslintReact from "@eslint-react/eslint-plugin";
import expo from "eslint-plugin-expo";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// eslint-config-expo passed these to the core rule for JavaScript and to the
// TypeScript one for the rest; both still need them.
const unusedVars = {
  vars: "all",
  args: "none",
  ignoreRestSiblings: true,
  caughtErrors: "all",
  caughtErrorsIgnorePattern: "^_",
};

// eslint-plugin-import is the one part of eslint-config-expo not carried over. It
// enabled seven of its rules; four are subsumed by `tsc --noEmit` and none of the
// seven had a finding here. The plugin caps its ESLint peer range at 9 and has not
// published since 2025-06 — the profile this change exists to get away from. The
// maintained fork, eslint-plugin-import-x, is where to go if the three rules TypeScript
// does not cover are wanted back.
const eslintConfig = defineConfig([
  // Core rules and the React Native global set, lifted from eslint-config-expo
  // 57.0.2 rather than inherited from it. Expo curates these per SDK, so they
  // are a snapshot: an SDK bump no longer moves them on its own.
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { impliedStrict: true, jsx: true } },
      // What React Native adds on top of the browser set; the ten Expo also listed
      // that globals.browser already defines identically are left to it.
      globals: {
        ...globals.browser,
        __DEV__: "readonly",
        ErrorUtils: false,
        clearImmediate: false,
        exports: false,
        global: false,
        module: false,
        process: false,
        require: false,
        setImmediate: false,
      },
    },
    rules: {
      eqeqeq: ["warn", "smart"],
      "no-dupe-args": "error",
      "no-dupe-class-members": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-empty-character-class": "warn",
      "no-empty-pattern": "warn",
      "no-extend-native": "warn",
      "no-extra-bind": "warn",
      "no-redeclare": "warn",
      "no-undef": "error",
      "no-unreachable": "warn",
      "no-unsafe-negation": "warn",
      "no-unused-expressions": ["warn", { allowShortCircuit: true, enforceForJSX: true }],
      "no-unused-labels": "warn",
      "no-unused-vars": ["warn", unusedVars],
      "no-var": "error",
      "no-with": "warn",
      "unicode-bom": ["warn", "never"],
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  },

  {
    files: ["**/metro.config.js"],
    languageOptions: { globals: globals.node },
  },

  // TypeScript only, the way eslint-config-expo scoped it: metro.config.js and
  // the CommonJS test stubs are not TypeScript and require() is correct there.
  // The base is typescript-eslint's own recommended rather than Expo's hand-listed
  // set, so upstream keeps curating it; the five rules Expo turned on that
  // recommended leaves out are added back below, which makes the swap additive.
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.d.ts"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/array-type": ["warn", { default: "array" }],
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        { assertionStyle: "as", objectLiteralTypeAssertions: "allow" },
      ],
      // recommended's eslint-recommended switches the core rules off here without
      // turning these on, which would leave both checks absent on TypeScript.
      "@typescript-eslint/no-dupe-class-members": "error",
      "@typescript-eslint/no-redeclare": "warn",
      "@typescript-eslint/no-useless-constructor": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", unusedVars],
      "@typescript-eslint/no-unused-expressions": "warn",
      // Metro resolves assets through require(), so the asset extensions stay
      // allowed. The list is eslint-config-expo's.
      "@typescript-eslint/no-require-imports": [
        "warn",
        {
          allow: [
            "\\.(aac|aiff|avif|bmp|caf|db|gif|heic|html|jpeg|jpg|json|m4a|m4v|mov|mp3|mp4|mpeg|mpg|otf|pdf|png|psd|svg|ttf|wav|webm|webp|xml|yaml|yml|zip)$",
          ],
        },
      ],
    },
  },

  reactHooks.configs.flat.recommended,

  {
    plugins: { expo },
    rules: {
      "expo/use-dom-exports": "error",
      "expo/no-env-var-destructuring": "error",
      "expo/no-dynamic-env-var": "error",
    },
  },

  // strict rather than the recommended tier the ticket named: ADR 0002 settled the
  // frontend at strict after this was written. Its eight added rules fire nowhere
  // here and jsx-no-children-prop, which strict raises to error, had nothing to
  // report at warn either. Three of the eight are DOM rules that only an Expo DOM
  // component could ever reach.
  eslintReact.configs.strict,

  {
    rules: {
      // The inverse of @eslint-react's disable-conflict-eslint-plugin-react-hooks
      // preset: one entry per rule in it, switched off on this side instead, so
      // eslint-plugin-react-hooks stays authoritative (workspace ADR 0002). Nothing
      // upstream expresses this direction, so an added twin would arrive as ordinary
      // warning drift. Derived at 5.20.1 under strict: nine of the twelve are live.
      "@eslint-react/error-boundaries": "off",
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/globals": "off",
      "@eslint-react/immutability": "off",
      "@eslint-react/purity": "off",
      "@eslint-react/refs": "off",
      "@eslint-react/rules-of-hooks": "off",
      "@eslint-react/set-state-in-effect": "off",
      "@eslint-react/set-state-in-render": "off",
      "@eslint-react/static-components": "off",
      "@eslint-react/unsupported-syntax": "off",
      "@eslint-react/use-memo": "off",
    },
  },

  globalIgnores([
    // Continuous native generation output; never committed.
    "ios/**",
    "android/**",
    ".expo/**",
    "coverage/**",
    "dist/**",
    // Local tooling scratch space; may hold full checkouts.
    ".claude/**",
  ]),
]);

export default eslintConfig;
