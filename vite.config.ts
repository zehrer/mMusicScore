import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args: string[]) => {
  try {
    return execFileSync("git", args, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};

// Shown in Help → About. package.json sets major.minor; the patch number counts the commits since
// the version line last changed, so every pushed build gets the next one (0.2.0, 0.2.1, …).
const [major, minor] = JSON.parse(readFileSync("package.json", "utf8")).version.split(".");
const bumped = git("log", "-1", "--format=%H", "-G", '"version":', "--", "package.json");
const version = `${major}.${minor}.${(bumped && git("rev-list", "--count", `${bumped}..HEAD`)) || 0}`;
const commit = git("rev-parse", "--short", "HEAD") || "dev";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the app below the repository name.
  base: command === "build" ? "/mMusicScore/" : "/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_BUILD__: JSON.stringify(`${commit} · ${new Date().toISOString().slice(0, 10)}`),
  },
  test: {
    environment: "jsdom",
    exclude: ["**/.claude/**", "**/node_modules/**"],
  },
}));
