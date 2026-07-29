import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

const packageRoot = resolve(import.meta.dir, "..");
const sourceRoot = join(packageRoot, "src");
const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as { dependencies?: Record<string, string>; scripts?: Record<string, string> };
const declaredPackages = new Set(Object.keys(manifest.dependencies ?? {}));
const builtins = new Set(["bun:sqlite", "fs", "path", "url"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

function packageName(specifier: string): string {
  return specifier.startsWith("@")
    ? specifier.split("/", 2).join("/")
    : (specifier.split("/", 1)[0] ?? specifier);
}

function importedSpecifiers(source: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const stringBindings = new Map<string, string>();
  const specifiers: string[] = [];

  const collectBindings = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer !== undefined
      && ts.isStringLiteralLike(node.initializer)
    ) {
      stringBindings.set(node.name.text, node.initializer.text);
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(sourceFile);

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteralLike(argument)) {
        specifiers.push(argument.text);
      } else if (argument !== undefined && ts.isIdentifier(argument)) {
        const resolved = stringBindings.get(argument.text);
        if (resolved !== undefined) specifiers.push(resolved);
        else specifiers.push("<unresolved-dynamic-import>");
      } else {
        specifiers.push("<unresolved-dynamic-import>");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

describe("web-server production boundary", () => {
  test("uses only declared package roots and package-local relative imports", () => {
    const violations = sourceFiles(sourceRoot).flatMap((file) =>
      importedSpecifiers(readFileSync(file, "utf8"), file).flatMap((specifier) => {
        const sourcePath = relative(packageRoot, file);
        if (specifier === "<unresolved-dynamic-import>") {
          return [`${sourcePath}: unresolved dynamic import`];
        }
        if (specifier.startsWith(".")) {
          const target = resolve(dirname(file), specifier);
          return target.startsWith(`${packageRoot}/`)
            ? []
            : [`${sourcePath}: relative import escapes package: ${specifier}`];
        }
        if (builtins.has(specifier) || specifier.startsWith("node:")) return [];
        const root = packageName(specifier);
        if (specifier !== root) return [`${sourcePath}: package subpath import: ${specifier}`];
        return declaredPackages.has(root)
          ? []
          : [`${sourcePath}: undeclared package import: ${specifier}`];
      })
    );

    expect(violations).toEqual([]);
  });

  test("declares only data/report runtime dependencies and real typecheck/build scripts", () => {
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      "@elysiajs/cors",
      "depa-data-expression",
      "depa-data-kon-spl-dsl",
      "depa-data-report-contract",
      "depa-data-report-logic",
      "depa-data-report-xlsx-support",
      "depa-data-spl-flow",
      "depa-data-web-shared",
      "elysia",
    ]);
    expect(manifest.scripts?.typecheck).toContain("tsc");
    expect(manifest.scripts?.build).toContain("tsconfig.json");
  });
});
