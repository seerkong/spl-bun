# Expression parser examples

This document lists common expression forms supported by the current parser.

## Basics
- Math: `a + b * 2`, `(a + b) * 2`
- Comparison: `a > 1`, `name == null`, `name != null`
- Boolean: `a > 1 and b < 10`, `a > 1 or b < 10`, `not active`
- Assignment: `a = 5`, `a += 2`, `a = 1, a += 2`

## Literals
- Numbers: `1`, `3.14`
- Strings: `"hello"`, `'world'`
- Arrays: `[1, 2, 3]`
- Records: `{x: 1, y: 2}`, `{"a": 1, b: 2}`

## Member access and calls
- Property: `obj.x`, `user.name`
- Member call: `arr.count()`, `rec.field(2)`, `tab.keys("id")`

## Functions
- String: `len(text)`, `upper(text)`, `lower(text)`, `trim(text)`
- Math: `round(3.14159, 2)`, `ceil(1.2)`, `floor(1.8)`
- Date/time: `now()`, `format(d, "date")`, `datediff(dateadd(d, 1), d)`
- Control flow: `if(a > 1, "yes", "no")`, `case(a, 1, "one", 2, "two")`
- Param control: `ifp("a:b, b:4; 0", ctx)`, `casep("a,1:'one',2:'two';'none'", ctx)`

## Collections and set ops
- Set ops: `[1,2,3] & [3,4]`, `[1,2,3] ^ [3,4]`, `[1,2,3] \\ [1]`, `[1,2,3] | [3,4]`

## IO examples
- Connect: `connect("demo")`, `connect("org.sqlite.JDBC", "jdbc:sqlite:demo.db")`
- DB members: `db.query("select * from t where id = ?", 7)`, `db.execute("update t set name = ?", "x")`
- Commit/rollback: `db.commit()`, `db.rollback()`

## Notes
- `=` is assignment; use `==` for equality.
- Commas form a sequence, returning the last expression.
- Member calls support comma-separated arguments.
- In spl-flow grids, a leading `>` marks an execute-only expression (runs but does not assign a cell value).
