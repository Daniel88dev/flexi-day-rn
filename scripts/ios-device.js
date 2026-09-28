#!/usr/bin/env node
// Builds, installs and launches the app on a paired iPhone. docs/device-testing.md, "Why
// `ios:device` is not `expo run:ios --device`", says why this is not the Expo CLI.

const { execFileSync } = require("node:child_process");
const { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const USAGE = `Usage: npm run ios:device -- [--configuration Debug|Release] [--device <udid|name>]

  --configuration  Debug (default) loads JavaScript from Metro; Release embeds the bundle.
  --device         UDID, devicectl identifier or name. Optional with a single connected iPhone.`;

function parseArgs(argv) {
  const options = { configuration: "Debug", device: undefined, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    const match = /^(--configuration|--device)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`unknown argument: ${arg}`);
    let value = match[2];
    if (value === undefined) {
      value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${match[1]} needs a value`);
      }
      i++;
    }
    if (match[1] === "--device") {
      options.device = value;
    } else {
      const configuration = ["Debug", "Release"].find(
        (c) => c.toLowerCase() === value.toLowerCase()
      );
      if (!configuration) throw new Error(`--configuration must be Debug or Release, not ${value}`);
      options.configuration = configuration;
    }
  }
  return options;
}

function readSigning(appJson) {
  const ios = appJson?.expo?.ios ?? {};
  if (!ios.appleTeamId) throw new Error("app.json has no expo.ios.appleTeamId");
  if (!ios.bundleIdentifier) throw new Error("app.json has no expo.ios.bundleIdentifier");
  return { teamId: ios.appleTeamId, bundleId: ios.bundleIdentifier };
}

function pickDevice(devices, selector) {
  const phones = devices.filter(
    (d) => d.hardwareProperties?.platform === "iOS" && d.hardwareProperties?.reality === "physical"
  );
  const describe = (d) => ({ udid: d.hardwareProperties.udid, name: d.deviceProperties?.name });
  const list = (ds) =>
    ds.map((d) => `  ${d.deviceProperties?.name} (${d.hardwareProperties.udid})`).join("\n");
  if (selector) {
    const wanted = selector.toLowerCase();
    const found = phones.find((d) =>
      [d.hardwareProperties.udid, d.identifier, d.deviceProperties?.name].some(
        (v) => typeof v === "string" && v.toLowerCase() === wanted
      )
    );
    if (!found) throw new Error(`no paired iPhone matches "${selector}"`);
    return describe(found);
  }
  if (phones.length === 0) throw new Error("no paired iPhone; see docs/device-testing.md");
  const connected = phones.filter((d) => d.connectionProperties?.tunnelState === "connected");
  if (connected.length === 0) {
    throw new Error(
      `iPhones are paired but none is connected; unlock one or plug it in:\n${list(phones)}`
    );
  }
  if (connected.length > 1) {
    throw new Error(`several iPhones are connected, pick one with --device:\n${list(connected)}`);
  }
  return describe(connected[0]);
}

function needsPodInstall(manifestMtime, lockfileMtime) {
  if (manifestMtime === null) return true;
  if (lockfileMtime === null) return false;
  return manifestMtime < lockfileMtime;
}

function releaseUrlWarning(configuration, envUrl, envFileContents) {
  if (configuration !== "Release" || envUrl) return null;
  const setsUrl = /^[ \t]*(?:export[ \t]+)?EXPO_PUBLIC_API_URL[ \t]*=[ \t]*[^\s#]/m;
  if (envFileContents.some((contents) => setsUrl.test(contents))) return null;
  return (
    "Warning: no EXPO_PUBLIC_API_URL in the environment or .env, so this Release build will call" +
    ' http://localhost:8080 on the phone. See "Production build" in docs/device-testing.md.'
  );
}

function xcodebuildArgs({ workspace, scheme, configuration, udid, teamId, derivedDataPath }) {
  return [
    "-workspace",
    workspace,
    "-scheme",
    scheme,
    "-configuration",
    configuration,
    "-destination",
    `id=${udid}`,
    "-derivedDataPath",
    derivedDataPath,
    "-allowProvisioningUpdates",
    "-allowProvisioningDeviceRegistration",
    `DEVELOPMENT_TEAM=${teamId}`,
    "CODE_SIGN_STYLE=Automatic",
    "COCOAPODS_PARALLEL_CODE_SIGN=true",
    "COMPILER_INDEX_STORE_ENABLE=NO",
  ];
}

function builtApp(derivedDataPath, configuration, scheme) {
  return join(derivedDataPath, "Build", "Products", `${configuration}-iphoneos`, `${scheme}.app`);
}

function run(command, args, options = {}) {
  console.log(`\n› ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", ...options });
}

function mtime(path) {
  return existsSync(path) ? statSync(path).mtimeMs : null;
}

function listDevices() {
  const dir = mkdtempSync(join(tmpdir(), "ios-device-"));
  const file = join(dir, "devices.json");
  try {
    execFileSync("xcrun", ["devicectl", "list", "devices", "--quiet", "--json-output", file]);
    return JSON.parse(readFileSync(file, "utf8")).result.devices;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const root = join(__dirname, "..");
  const { teamId, bundleId } = readSigning(
    JSON.parse(readFileSync(join(root, "app.json"), "utf8"))
  );
  // The files Expo loads for a production bundle.
  const envFiles = [".env", ".env.local", ".env.production", ".env.production.local"]
    .map((f) => join(root, f))
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, "utf8"));
  const warning = releaseUrlWarning(
    options.configuration,
    process.env.EXPO_PUBLIC_API_URL,
    envFiles
  );
  if (warning) console.warn(`\n${warning}\n`);
  const device = pickDevice(listDevices(), options.device);
  // CocoaPods quits without a UTF-8 locale, which a non-interactive shell does not set.
  const env = {
    ...process.env,
    LANG: /utf-?8/i.test(process.env.LANG ?? "") ? process.env.LANG : "en_US.UTF-8",
    RCT_NO_LAUNCH_PACKAGER: "true",
  };

  const iosDir = join(root, "ios");
  if (!existsSync(iosDir)) {
    run("npx", ["expo", "prebuild", "--platform", "ios"], { cwd: root, env });
  } else if (
    needsPodInstall(
      mtime(join(iosDir, "Pods", "Manifest.lock")),
      mtime(join(root, "package-lock.json"))
    )
  ) {
    run("pod", ["install"], { cwd: iosDir, env });
  }
  const workspace = readdirSync(iosDir).find((f) => f.endsWith(".xcworkspace"));
  if (!workspace) throw new Error("ios/ has no .xcworkspace; run npm run prebuild");
  const scheme = workspace.replace(/\.xcworkspace$/, "");
  const derivedDataPath = join(iosDir, "build");

  console.log(`Building ${options.configuration} for ${device.name} (${device.udid})`);
  run(
    "xcodebuild",
    xcodebuildArgs({
      workspace: join(iosDir, workspace),
      scheme,
      configuration: options.configuration,
      udid: device.udid,
      teamId,
      derivedDataPath,
    }),
    { cwd: root, env }
  );
  const app = builtApp(derivedDataPath, options.configuration, scheme);
  run("xcrun", ["devicectl", "device", "install", "app", "--device", device.udid, app]);
  try {
    run("xcrun", [
      "devicectl",
      "device",
      "process",
      "launch",
      "--terminate-existing",
      "--device",
      device.udid,
      bundleId,
    ]);
  } catch {
    const retry = ["devicectl", "device", "process", "launch", "--device", device.udid, bundleId];
    throw new Error(
      "Installed, but the launch failed. Unlock the phone, trust the developer under Settings ›" +
        " General › VPN & Device Management if it asks, then:\n" +
        `  xcrun ${retry.join(" ")}`
    );
  }
  if (options.configuration === "Debug") {
    console.log("\nA Debug build loads its JavaScript from Metro: keep `npm start` running.");
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  builtApp,
  needsPodInstall,
  parseArgs,
  pickDevice,
  readSigning,
  releaseUrlWarning,
  xcodebuildArgs,
};
