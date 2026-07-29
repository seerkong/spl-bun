import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface SampleDb {
  dbPath: string;
  dispose: () => void;
}

export function createSampleSqliteDb(): SampleDb {
  const dir = mkdtempSync(join(tmpdir(), "spl-bun-"));
  const dbPath = join(dir, "sample.db");
  const db = new Database(dbPath, { create: true, readwrite: true });

  db.run("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, price REAL, active INTEGER)");
  db.run("CREATE TABLE departments (dept TEXT PRIMARY KEY, manager TEXT)");
  const insertItem = db.prepare("INSERT INTO items (name, price, active) VALUES (?, ?, ?)");
  insertItem.run("widget", 10.5, 1);
  insertItem.run("gadget", 12.0, 0);
  insertItem.run("sprocket", 7.25, 1);

  const insertDept = db.prepare("INSERT INTO departments (dept, manager) VALUES (?, ?)");
  insertDept.run("eng", "mike");
  insertDept.run("sales", "sara");

  db.close();

  const dispose = () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // On Windows the SQLite file can remain locked briefly; ignore cleanup errors.
    }
  };
  return { dbPath, dispose };
}
