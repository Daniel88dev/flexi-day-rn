import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import * as ReactNative from "react-native";

import { NON_COMPONENT_APIS, WARMED_COMPONENTS } from "../warm-up";

const SRC = join(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// A type has no runtime export, so `in` drops it whether or not its import says `type`.
function reactNativeValueImports(source: string): string[] {
  const imports = source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"react-native"/g);
  return [...imports]
    .flatMap(([, specifiers]) => specifiers.split(","))
    .map(
      (specifier) =>
        specifier
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0]
    )
    .filter((name) => name !== "" && name in ReactNative);
}

function unwarmedComponentImports(): string[] {
  const known = new Set<string>([...WARMED_COMPONENTS, ...NON_COMPONENT_APIS]);
  return sourceFiles(SRC).flatMap((file) =>
    reactNativeValueImports(readFileSync(file, "utf8"))
      .filter((name) => /^[A-Z]/.test(name) && !known.has(name))
      .map((name) => `${name} (${relative(SRC, file)})`)
  );
}

describe("WARMED_COMPONENTS", () => {
  it("covers every component the app imports from react-native", () => {
    expect(unwarmedComponentImports()).toEqual([]);
  });
});
