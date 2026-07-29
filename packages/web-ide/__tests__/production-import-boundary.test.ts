import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

const packageRoot = resolve(import.meta.dir, "..");
const sourceRoot = join(packageRoot, "src");
const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as { dependencies?: Record<string, string> };
const declaredPackages = new Set(Object.keys(manifest.dependencies ?? {}));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|vue)$/.test(entry.name) ? [path] : [];
  });
}

function scriptSource(source: string, fileName: string): string {
  if (!fileName.endsWith(".vue")) return source;
  return Array.from(source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1] ?? "")
    .join("\n");
}

function importedSpecifiers(source: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    scriptSource(source, fileName),
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

function packageName(specifier: string): string {
  const segments = specifier.split("/");
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : (segments[0] ?? specifier);
}

describe("web-ide production boundary", () => {
  test("uses only package-local files and declared public package roots", () => {
    const violations = sourceFiles(sourceRoot).flatMap((file) =>
      importedSpecifiers(readFileSync(file, "utf8"), file).flatMap((specifier) => {
        if (specifier.startsWith(".") || isAbsolute(specifier)) {
          const target = resolve(dirname(file), specifier);
          const path = relative(packageRoot, target);
          return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
            ? []
            : [`${relative(packageRoot, file)}: import escapes package: ${specifier}`];
        }
        if (specifier.startsWith("node:") || specifier.startsWith("bun:")) return [];
        const root = packageName(specifier);
        if (specifier !== root) return [`package subpath import: ${specifier}`];
        return declaredPackages.has(root) ? [] : [`undeclared package import: ${specifier}`];
      })
    );

    expect(violations).toEqual([]);
  });

  test("declares only the Kon IDE's public UI and shared-contract dependencies", () => {
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      "@tanstack/vue-table",
      "depa-data-web-shared",
      "vue",
      "vue-router",
    ]);
  });
});
