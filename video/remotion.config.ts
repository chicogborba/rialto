/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// The bundled headless shell crashes on some macOS setups; use the installed Chrome when present.
import { existsSync } from "node:fs";
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (existsSync(systemChrome)) Config.setBrowserExecutable(systemChrome);
