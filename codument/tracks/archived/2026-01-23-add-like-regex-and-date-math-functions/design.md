## Context

- The TypeScript expression engine currently supports:
  - Built-in functions via `packages/expression/src/functions.ts`
  - Member functions via `packages/expression/src/memberRegistry.ts`
- The TS expression parser does not support Java-style `fn@opt(...)` option syntax.
- Several built-ins already accept an "options string" argument (e.g., `parse(value, options)`), which is a consistent pattern to reuse.

## Goals / Non-Goals

Goals:
- Add built-in functions: `like`, `regex`, `exp`, `ln`, `sign`, `gcd`, `lcm`, `age`, `workday`, `workdays`.
- Add string member function: `.regex(...)`.
- Provide grouped Web-IDE demos for string/math/date.

Non-Goals:
- Do not change the expression grammar to introduce `@options`.
- Do not implement cursor/pipe regex operators.
- Do not implement full Java `DateFormatFactory` parsing; use existing Date coercion conventions.

## Key Decisions

### Decision: Options are passed as a string argument
We represent Java-style `@option` as an optional string argument on the function call.

Examples:
- `like("Hello", "he*o", "c")`
- `workdays(b, e, offDays, "nx")`

Rationale:
- Keeps the TS expression grammar stable.
- Matches existing TS built-in conventions (`parse(..., options)` etc.).

### Decision: regex() overload disambiguation
`regex(str, pattern, replacementOrOptions?, options?)` uses a deterministic rule:

- If called with 3 args and arg3 is composed only of known option letters (`[acupw]`, case-insensitive), treat it as options (extraction mode).
- Otherwise treat arg3 as replacement (replacement mode).

Rationale:
- Supports both extraction and replacement without introducing a new function name.
- Avoids requiring a grammar change.

## Function Semantics (Implementation Notes)

### like(value, pattern, options?)
- Standard mode (`*`/`?`) and SQL mode (`%`/`_`) are implemented directly (no regex translation), to support escaping rules.
- `c` (ignore case) applies only to standard mode (Java parity).

### regex(str, pattern, ...)
- Implemented using JS `RegExp`.
- Options mapping:
  - `c` -> `i` flag
  - `u` -> `u` flag
  - `w` -> match whole string: use `^...$` wrapping or `RegExp.prototype.test` on full string
- Extraction mode:
  - no capture groups: return `str` if match else `null`
  - one capture group: return `string[]` (or parsed values if `p`)
  - multiple capture groups: return `string[][]` (one tuple per match)
- Replacement mode:
  - replace first vs replace all controlled by `a`

### exp/ln/sign
- `exp(x)` -> `Math.exp(Number(x))`
- `ln(x)` -> `Math.log(Number(x))` (alias of natural log)
- `sign(x)` -> -1/0/1 (consistent with Java sign), returning `null` for nullish inputs

### gcd/lcm
- Accept either an array argument or variadic numeric args.
- Ignore non-numeric values.
- `gcd`: return 0 if any input < 0 (Java parity).
- `lcm`: return 0 if any input <= 0 (Java parity).

### age(start, endOrOptions?, options?)
- Uses year/month/day components from JS `Date`.
- Options:
  - `m` takes precedence over `y` if both supplied (Java parity).

### workday/workdays
- Implement `isWorkDay(date, offDays)` with toggle semantics (weekday holiday / weekend workday) to align with Java.
- `workdays` supports:
  - `n`: return count
  - `x`: exclude end date from range

## Risks / Tradeoffs

- JS `Date` parsing and timezones can differ from Java; we rely on `Date` objects and Date component calculations.
- regex capture extraction shapes are documented and tested to avoid surprises.

## Future Extensions

- Consider adding sequence `.regex(...)` if demand arises (Java has this capability, but it is out of scope here).
