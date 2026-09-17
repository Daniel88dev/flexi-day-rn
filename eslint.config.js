const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
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
