import { compileExpression, evaluateExpression, makeDbHandle, makeFileHandle, makeCursorHandle } from "../src/index";

const scope = { a: 2, b: 5, name: null, text: "Hello", nums: [1, 2, 3] };

describe("expression parser and evaluator", () => {
  test("respects operator precedence and parentheses", () => {
    expect(evaluateExpression("a + b * 2", scope)).toBe(12);
    expect(evaluateExpression("(a + b) * 2", scope)).toBe(14);
    expect(evaluateExpression("-a + b", scope)).toBe(3);
  });

  test("logical operators and null semantics", () => {
    expect(evaluateExpression("a > 1 and b < 10", scope)).toBe(true);
    expect(evaluateExpression("name == null", scope)).toBe(true);
    expect(evaluateExpression("name != null", scope)).toBe(false);
    expect(evaluateExpression("name or a", scope)).toBe(true);
  });

  test("assignment, member access, and set operators", () => {
    const local = { a: 1, obj: { x: 10 }, left: [1, 2, 3], right: [3, 4] } as Record<string, unknown>;
    expect(evaluateExpression("a = 5", local)).toBe(5);
    expect(local.a).toBe(5);
    expect(evaluateExpression("a += 2", local)).toBe(7);
    expect(local.a).toBe(7);
    expect(evaluateExpression("obj.x", local)).toBe(10);
    expect(evaluateExpression("left.count()", local)).toBe(3);
    expect(evaluateExpression("left.sum()", local)).toBe(6);
    expect(evaluateExpression("left.avg()", local)).toBe(2);
    expect(evaluateExpression("left.min()", local)).toBe(1);
    expect(evaluateExpression("left.max()", local)).toBe(3);
    expect(evaluateExpression("left.first()", local)).toBe(1);
    expect(evaluateExpression("left.last()", local)).toBe(3);
    expect(evaluateExpression("left.calc(\"_ * 2\")", local)).toEqual([2, 4, 6]);
    expect(evaluateExpression("[1,2,3]", local)).toEqual([1, 2, 3]);
    expect(evaluateExpression("{x: 1, y: 2}", local)).toEqual({ x: 1, y: 2 });
    expect(evaluateExpression("left & right", local)).toEqual([1, 2, 3, 4]);
    expect(evaluateExpression("left ^ right", local)).toEqual([3]);
    expect(evaluateExpression("left \\ right", local)).toEqual([1, 2]);
    expect(evaluateExpression("5 \\ 2", local)).toBe(2);
    expect(evaluateExpression("left | right", local)).toEqual([1, 2, 3, 3, 4]);
    expect(evaluateExpression("true || false", local)).toBe(true);
    expect(evaluateExpression("a = 1, a = a + 2", local)).toBe(3);
    expect(evaluateExpression("a = 1, a += 2", local)).toBe(3);
  });

  test("control flow functions", () => {
    expect(evaluateExpression("if(a > 1, \"yes\", \"no\")", scope)).toBe("yes");
    expect(evaluateExpression("if(a < 1, \"yes\", \"no\")", scope)).toBe("no");
    expect(evaluateExpression("case(a, 1, \"one\", 2, \"two\", 3, \"three\")", scope)).toBe("two");
  });

  test("control flow param variants", () => {
    const condScope = { a: 1, b: 2 };
    expect(evaluateExpression("ifp(\"a:b, b:4; 0\", ctx)", { ctx: condScope })).toBe(2);
    expect(evaluateExpression("casep(\"a,1:'one',2:'two';'none'\", ctx)", { ctx: { a: 2 } })).toBe("two");
  });

  test("math helpers", () => {
    expect(evaluateExpression("round(3.14159, 2)", scope)).toBeCloseTo(3.14);
    expect(evaluateExpression("ceil(1.2)", scope)).toBe(2);
    expect(evaluateExpression("floor(1.8)", scope)).toBe(1);
    expect(typeof evaluateExpression("rand()", scope)).toBe("number");
  });

  test("functions basic set", () => {
    expect(evaluateExpression("len(text)", scope)).toBe(5);
    expect(evaluateExpression("upper(text)", scope)).toBe("HELLO");
    expect(evaluateExpression("lower(text)", scope)).toBe("hello");
    expect(evaluateExpression("trim(\"  hi  \" )", scope)).toBe("hi");
    expect(evaluateExpression("replace(text, \"l\", \"x\")", scope)).toBe("Hexxo");
    expect(evaluateExpression("pos(text, \"el\")", scope)).toBe(2);
    expect(evaluateExpression("left(text, 2)", scope)).toBe("He");
    expect(evaluateExpression("right(text, 2)", scope)).toBe("lo");
    expect(evaluateExpression("mid(text, 2, 3)", scope)).toBe("ell");
    expect(evaluateExpression("nvl(name, \"unknown\")", scope)).toBe("unknown");
    expect(evaluateExpression("sum(nums)", scope)).toBe(6);
    expect(evaluateExpression("avg(nums)", scope)).toBeCloseTo(2);
    expect(evaluateExpression("median(nums)", scope)).toBe(2);
    expect(evaluateExpression("top(2, nums)", scope)).toEqual([2, 3]);
  });

  test("datetime helpers", () => {
    const d = new Date("2024-01-01T00:00:00Z");
    const s = { d };
    expect(evaluateExpression("format(d, \"date\")", s)).toBe("2024-01-01");
    expect(typeof evaluateExpression("now()", s)).toBe("object");
    expect(evaluateExpression("datediff(dateadd(d, 1), d)", s)).toBeCloseTo(1);
    expect(evaluateExpression("year(d)", s)).toBe(2024);
    expect(evaluateExpression("month(d)", s)).toBe(1);
    expect(evaluateExpression("day(d)", s)).toBe(1);
    expect(evaluateExpression("hour(d)", s)).toBe(0);
    expect(evaluateExpression("minute(d)", s)).toBe(0);
    expect(evaluateExpression("second(d)", s)).toBe(0);
    const built = evaluateExpression("datetime(2024, 2, 3, 4, 5, 6)", s) as Date;
    expect(built.getFullYear()).toBe(2024);
    expect(built.getMonth()).toBe(1);
    expect(built.getDate()).toBe(3);
    expect(built.getHours()).toBe(4);
    expect(built.getMinutes()).toBe(5);
    expect(built.getSeconds()).toBe(6);
  });

  test("compiled expression reuse", () => {
    const compiled = compileExpression("a * b + len(text)");
    expect(compiled.evaluate(scope)).toBe(15);
    expect(compiled.evaluate({ a: 1, b: 10, text: "abc" })).toBe(13);
  });

  test("db member functions via typed handle", () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const db = makeDbHandle({
      query: (...args: unknown[]) => {
        calls.push({ name: "query", args });
        return { ok: true, args };
      },
      execute: (...args: unknown[]) => {
        calls.push({ name: "execute", args });
        return { ok: true, args };
      },
      commit: () => {
        calls.push({ name: "commit", args: [] });
        return "committed";
      },
      rollback: () => {
        calls.push({ name: "rollback", args: [] });
        return "rolled";
      },
    });

    expect(evaluateExpression("db.query(\"select * from t where id = ?\", 7)", { db })).toEqual({
      ok: true,
      args: ["select * from t where id = ?", 7],
    });
    expect(evaluateExpression("db.execute(\"update t set name = ?\", \"x\")", { db })).toEqual({
      ok: true,
      args: ["update t set name = ?", "x"],
    });
    expect(evaluateExpression("db.commit()", { db })).toBe("committed");
    expect(evaluateExpression("db.rollback()", { db })).toBe("rolled");

    expect(calls.map((call) => call.name)).toEqual(["query", "execute", "commit", "rollback"]);
  });

  test("connect builtins return db handles", () => {
    const byName = evaluateExpression("connect('demo')", {});
    expect(byName).toEqual({ __type: 1, value: { name: "demo" } });

    const byJdbc = evaluateExpression("connect('org.sqlite.JDBC', 'jdbc:sqlite:demo.db')", {});
    expect(byJdbc).toEqual({
      __type: 1,
      value: { driver: "org.sqlite.JDBC", url: "jdbc:sqlite:demo.db", type: "jdbc" },
    });

    const bySqlite = evaluateExpression("connect('sqlite', 'demo.db')", {});
    expect(bySqlite).toEqual({
      __type: 1,
      value: { driver: "sqlite", url: "demo.db", type: "jdbc" },
    });
  });

  test("file member functions", () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const file = makeFileHandle({
      read: (...args: unknown[]) => {
        calls.push({ name: "read", args });
        return "payload";
      },
      write: (...args: unknown[]) => {
        calls.push({ name: "write", args });
        return 3;
      },
      import: (...args: unknown[]) => {
        calls.push({ name: "import", args });
        return { rows: [{ id: 1 }], schema: [{ name: "id" }] };
      },
      export: (...args: unknown[]) => {
        calls.push({ name: "export", args });
        return true;
      },
    });

    expect(evaluateExpression("file.read()", { file })).toBe("payload");
    expect(evaluateExpression("file.write({ a: 1 })", { file })).toBe(3);
    expect(evaluateExpression("file.import()", { file })).toEqual({
      rows: [{ id: 1 }],
      schema: [{ name: "id" }],
    });
    expect(evaluateExpression("file.export({ rows: [] })", { file })).toBe(true);
    expect(calls.map((call) => call.name)).toEqual(["read", "write", "import", "export"]);
  });

  test("cursor member functions", () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const cursor = makeCursorHandle({
      fetch: (...args: unknown[]) => {
        calls.push({ name: "fetch", args });
        return [{ id: 1 }];
      },
      skip: (...args: unknown[]) => {
        calls.push({ name: "skip", args });
        return 2;
      },
    });

    expect(evaluateExpression("cursor.fetch(1)", { cursor })).toEqual([{ id: 1 }]);
    expect(evaluateExpression("cursor.skip(2)", { cursor })).toBe(2);
    expect(calls.map((call) => call.name)).toEqual(["fetch", "skip"]);
  });

  test("sequence fetch and skip", () => {
    const seq = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(evaluateExpression("seq.fetch(2)", { seq })).toEqual([{ id: 1 }, { id: 2 }]);
    expect(evaluateExpression("seq.skip(2)", { seq })).toEqual([{ id: 3 }, { id: 4 }]);
  });

  test("json and parse conversions", () => {
    expect(evaluateExpression("json_parse('{\"a\":1}')", {})).toEqual({ a: 1 });
    expect(evaluateExpression("json('{\"a\":1}')", {})).toEqual({ a: 1 });
    expect(evaluateExpression("json_stringify({ a: 1 })", {})).toBe("{\"a\":1}");
    expect(evaluateExpression("json({ a: 1 })", {})).toBe("{\"a\":1}");
    expect(evaluateExpression("parse('42')", {})).toBe(42);
  });

  test("count and icount aggregations", () => {
    expect(evaluateExpression("count(null)", {})).toBe(0);
    expect(evaluateExpression("count(1)", {})).toBe(1);
    expect(evaluateExpression("count(0)", {})).toBe(1);
    expect(evaluateExpression("count('', 'a')", {})).toBe(2);
    expect(evaluateExpression("icount([1, 1, 2, null])", {})).toBe(2);
    expect(evaluateExpression("icount([true, false, true])", {})).toBe(1);
  });

  test("sequence member functions", () => {
    const table = {
      rows: [
        { id: 1, category: "a", amount: 10 },
        { id: 2, category: "b", amount: 5 },
        { id: 3, category: "a", amount: 20 },
      ],
      keys: ["id"],
      schema: [{ name: "id" }, { name: "category" }, { name: "amount" }],
    };
    const right = {
      rows: [
        { id: 1, name: "alpha" },
        { id: 3, name: "gamma" },
      ],
      schema: [{ name: "id" }, { name: "name" }],
    };

    const selected = evaluateExpression("tab.select(\"amount > 10\")", { tab: table }) as {
      rows: Array<{ id: number }>;
    };
    expect(selected.rows.map((row) => row.id)).toEqual([3]);

    const sorted = evaluateExpression("tab.sort(\"amount\", \"desc\")", { tab: table }) as {
      rows: Array<{ amount: number }>;
    };
    expect(sorted.rows.map((row) => row.amount)).toEqual([20, 10, 5]);

    const derived = evaluateExpression("tab.derive({ gross: \"amount * 1.1\" })", { tab: table }) as {
      rows: Array<{ gross: number }>;
    };
    expect(derived.rows.map((row) => row.gross)).toEqual([11, 5.5, 22]);

    const grouped = evaluateExpression(
      "tab.group({ groupBy: [\"category\"], aggregates: { total: { type: \"sum\", field: \"amount\" }, count: { type: \"count\" } } })",
      { tab: table },
    ) as { rows: Array<{ category: string; total: number; count: number }> };
    expect(grouped.rows).toEqual([
      { category: "a", total: 30, count: 2 },
      { category: "b", total: 5, count: 1 },
    ]);

    const joined = evaluateExpression(
      "tab.join(right, { type: \"left\", leftKeys: [\"id\"], rightKeys: [\"id\"], rightPrefix: \"r_\" })",
      { tab: table, right },
    ) as { rows: Array<{ id: number; name?: string }> };
    expect(joined.rows.map((row) => row.name ?? null)).toEqual(["alpha", null, "gamma"]);
  });

  test("record/table member functions", () => {
    const record = { id: 1, name: "a" } as Record<string, unknown>;
    const table = {
      rows: [
        { id: 1, name: "a" },
        { id: 2, name: "b" },
      ],
      keys: ["id"],
      schema: [{ name: "id" }, { name: "name" }],
    };

    expect(evaluateExpression("rec.field(2)", { rec: record })).toBe("a");
    expect(evaluateExpression("rec.fname(1)", { rec: record })).toBe("id");
    expect(evaluateExpression("rec.fno('name')", { rec: record })).toBe(2);
    expect(evaluateExpression("rec.key()", { rec: record })).toEqual([1, "a"]);
    expect(evaluateExpression("rec.record(['x', 'y'])", { rec: record })).toEqual({ id: "x", name: "y" });

    expect(evaluateExpression("tab.keys('id')", { tab: table })).toEqual(table);
    expect(evaluateExpression("tab.row(2)", { tab: table })).toEqual({ id: 2, name: "b" });
  });
});
