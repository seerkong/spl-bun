import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dir, "..");
const packageRoot = join(workspaceRoot, "packages");
const retiredDirectories = [
  ["domain", "operation", "contracts"],
  ["depa", "orm", "domain", "runtime"],
  ["depa", "orm", "capsule"],
  ["domain", "operation", "server"],
  ["domain", "context", "bundles"],
].map((segments) => segments.join("-"));
const retainedDirectories = [
  "composer",
  "core",
  "expression",
  "kon-spl-dsl",
  "report-contract",
  "report-logic",
  "report-xlsx-support",
  "spl-flow",
  "sqlite-adapter",
  "test-utils",
  "web-ide",
  "web-server",
  "web-shared",
];

describe("source-only workspace scope", () => {
  test("retains the source/data packages and physically omits extracted package owners", () => {
    const directories = readdirSync(packageRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(directories).toEqual(retainedDirectories);
    for (const directory of retiredDirectories) {
      expect(existsSync(join(packageRoot, directory))).toBe(false);
    }
  });

  test("remaining workspace manifests have no dependency on extracted package identities", () => {
    const extractedIdentityFragments = [
      ["domain", "operation", "contracts"].join("-"),
      ["depa", "orm", "domain", "runtime"].join("-"),
      ["depa", "orm", "capsule"].join("-"),
      ["domain", "operation", "server"].join("-"),
      ["domain", "context", "bundles"].join("-"),
    ];
    const violations = retainedDirectories.flatMap((directory) => {
      const manifestPath = join(packageRoot, directory, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      return [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.devDependencies ?? {}),
      ]
        .filter((dependency) => extractedIdentityFragments.some((fragment) => dependency.includes(fragment)))
        .map((dependency) => `${directory}: ${dependency}`);
    });

    expect(violations).toEqual([]);
  });

  test("shared Web API owns only data, Kon and Excel report routes", () => {
    const sharedSource = readFileSync(join(packageRoot, "web-shared/src/index.ts"), "utf8");
    const routeValues = Array.from(sharedSource.matchAll(/:\s*"(\/api\/[^"]+)"/g))
      .map((match) => match[1])
      .sort();

    expect(routeValues).toEqual(["/api/execute-kon", "/api/health", "/api/import-table", "/api/render-report", "/api/report-template"]);
  });
});
