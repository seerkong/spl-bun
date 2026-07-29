/**
 * Convert HSQLDB demo.script to SQLite format
 *
 * This script converts the esProc Java demo database to SQLite3 syntax
 * for use in the TypeScript implementation.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = "E:/infra-dev/src/esProc/database/demo/demo.script";
const OUTPUT_PATH = join(__dirname, "..", "data", "demo-init.sql");

/**
 * Check if identifier contains non-ASCII characters or Unicode escapes
 */
function needsQuoting(identifier: string): boolean {
  // Check for actual non-ASCII characters
  if (/[^\x00-\x7F]/.test(identifier)) {
    return true;
  }
  // Check for Unicode escape sequences like \u5458
  if (/\\u[0-9a-fA-F]{4}/.test(identifier)) {
    return true;
  }
  return false;
}

/**
 * Quote identifier if it contains non-ASCII characters
 */
function quoteIfNeeded(identifier: string): string {
  if (needsQuoting(identifier)) {
    return `"${identifier}"`;
  }
  return identifier;
}

/**
 * Process column definitions, quoting non-ASCII identifiers
 */
function processColumnDefs(columnsPart: string): string {
  // Split by comma, but be careful with nested parentheses
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of columnsPart) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  // Process each column definition
  const processedParts = parts.map((part) => {
    // Handle PRIMARY KEY constraint
    if (part.toUpperCase().startsWith("PRIMARY KEY")) {
      return part;
    }

    // Extract column name (first word before space)
    const firstSpace = part.indexOf(" ");
    if (firstSpace === -1) return part;

    const colName = part.substring(0, firstSpace);
    const rest = part.substring(firstSpace);

    return quoteIfNeeded(colName) + rest;
  });

  return processedParts.join(",");
}

function convertHsqlToSqlite(content: string): string {
  const lines = content.split("\n");
  const output: string[] = [];

  output.push("-- Demo SQLite database initialization");
  output.push("-- Auto-converted from esProc HSQLDB demo.script");
  output.push("-- Generated for esProc TypeScript implementation");
  output.push("");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip HSQLDB-specific commands
    if (
      trimmed.startsWith("SET ") ||
      trimmed.startsWith("ALTER SEQUENCE") ||
      trimmed.startsWith("GRANT ") ||
      trimmed.startsWith("CREATE USER") ||
      trimmed.startsWith("CREATE SCHEMA")
    ) {
      continue;
    }

    // Convert CREATE MEMORY TABLE
    if (trimmed.startsWith("CREATE MEMORY TABLE PUBLIC.")) {
      // Extract table name and columns
      const withoutPrefix = trimmed.substring("CREATE MEMORY TABLE PUBLIC.".length);

      // Find the opening parenthesis
      const parenIndex = withoutPrefix.indexOf("(");
      if (parenIndex === -1) continue;

      let tableName = withoutPrefix.substring(0, parenIndex);
      let columnsPart = withoutPrefix.substring(parenIndex + 1);

      // Remove trailing ) and ;
      if (columnsPart.endsWith(";")) columnsPart = columnsPart.slice(0, -1);
      if (columnsPart.endsWith(")")) columnsPart = columnsPart.slice(0, -1);

      // Handle quoted table names like "DEPARTMENT"
      tableName = tableName.replace(/^"(.*)"$/, "$1");

      // Quote table name if needed
      tableName = quoteIfNeeded(tableName);

      // Convert column types
      columnsPart = columnsPart
        .replace(/CHARACTER\(\d+\)/g, "TEXT")
        .replace(/VARCHAR\(\d+\)/g, "TEXT")
        .replace(/\bSMALLINT\b/g, "INTEGER")
        .replace(/\bTIMESTAMP\b/g, "TEXT")
        .replace(/DECIMAL\(\d+,\d+\)/g, "REAL")
        .replace(/\bDOUBLE\b/g, "REAL")
        .replace(/VARBINARY\(\d+\)/g, "BLOB")
        .replace(/\bDATE\b/g, "TEXT");

      // Process column definitions to quote non-ASCII names
      columnsPart = processColumnDefs(columnsPart);

      const converted = `CREATE TABLE IF NOT EXISTS ${tableName}(${columnsPart});`;
      output.push(converted);
      continue;
    }

    // Convert INSERT statements
    if (trimmed.startsWith("INSERT INTO ")) {
      let converted = trimmed;

      // Remove PUBLIC. prefix
      converted = converted.replace("INSERT INTO PUBLIC.", "INSERT INTO ");

      // Handle quoted table names
      converted = converted.replace(/INSERT INTO "(\w+)"/, "INSERT INTO $1");

      // Quote non-ASCII table names
      const match = converted.match(/^INSERT INTO ([^\s(]+)/);
      if (match && needsQuoting(match[1])) {
        converted = converted.replace(
          /^INSERT INTO ([^\s(]+)/,
          `INSERT INTO "${match[1]}"`
        );
      }

      // Add semicolon if missing
      if (!converted.endsWith(";")) {
        converted += ";";
      }

      output.push(converted);
      continue;
    }
  }

  return output.join("\n");
}

// Ensure data directory exists
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

// Read input file
console.log(`Reading from: ${INPUT_PATH}`);
const inputContent = readFileSync(INPUT_PATH, "utf-8");

// Convert
console.log("Converting HSQLDB to SQLite...");
const outputContent = convertHsqlToSqlite(inputContent);

// Write output
console.log(`Writing to: ${OUTPUT_PATH}`);
writeFileSync(OUTPUT_PATH, outputContent, "utf-8");

// Count statistics
const tableCount = (outputContent.match(/CREATE TABLE/g) || []).length;
const insertCount = (outputContent.match(/INSERT INTO/g) || []).length;

console.log(`Done! Created ${tableCount} tables with ${insertCount} insert statements.`);
