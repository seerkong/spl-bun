## Overview

This track adds missing "Phase-2" style expression functions to the TypeScript expression engine and adds Web-IDE demos to showcase the new capabilities.

---

## ADDED Requirements

### Requirement: like() string pattern matching
The expression engine SHALL provide a built-in function `like(value, pattern, options?)` that returns a boolean.

- `options` (if provided) SHALL be treated as a case-insensitive set of single-letter flags.
- When `options` contains `s`, the pattern SHALL use SQL wildcards: `%` matches 0+ chars, `_` matches exactly 1 char.
- Otherwise, the pattern SHALL use esProc wildcards: `*` matches 0+ chars, `?` matches exactly 1 char.
- Backslash (`\\`) SHALL escape wildcard characters in the pattern (`\*`, `\?`, `\%`, `\_`) so they match literally.
- When `options` contains `c` and `s` is NOT present, matching SHALL be case-insensitive (Java parity).
- When `options` contains both `s` and `c`, `c` SHALL be ignored (Java parity).

#### Scenario: Standard wildcard matching with '*' and '?'
- **GIVEN** an expression `like("hello", "he*o")`
- **WHEN** the expression is evaluated
- **THEN** the result is `true`

#### Scenario: Escape wildcard characters in standard mode
- **GIVEN** an expression `like("a*b", "a\\*b")`
- **WHEN** the expression is evaluated
- **THEN** the result is `true`

#### Scenario: SQL wildcard matching with option 's'
- **GIVEN** an expression `like("abcd", "a%", "s")`
- **WHEN** the expression is evaluated
- **THEN** the result is `true`

#### Scenario: Case-insensitive matching with option 'c' (non-SQL)
- **GIVEN** an expression `like("Hello", "he*o", "c")`
- **WHEN** the expression is evaluated
- **THEN** the result is `true`

#### Scenario: Null inputs
- **GIVEN** an expression `like(null, "*")`
- **WHEN** the expression is evaluated
- **THEN** the result is `false`


### Requirement: regex() matching/extraction and replacement (builtin + string member)
The expression engine SHALL provide:

- A built-in function `regex(str, pattern, replacementOrOptions?, options?)`
- A string member function `str.regex(pattern, replacementOrOptions?, options?)`

Both forms SHALL be equivalent.

`options` (if provided) SHALL be treated as a case-insensitive set of single-letter flags:

- `c`: case-insensitive matching
- `u`: unicode matching (`u` flag)
- `w`: whole-string match (full match). If absent, substring match is allowed.
- `p`: parse extracted group strings (see scenario)
- `a`: replace all matches (only relevant in replacement mode)

Argument disambiguation:

- When called with 3 arguments and the 3rd argument is a string consisting only of known option letters (`[acupw]`, case-insensitive), it SHALL be treated as `options` (extraction mode).
- Otherwise, the 3rd argument SHALL be treated as `replacement` (replacement mode).

Extraction mode:

- If `pattern` has no capture groups, `regex(...)` SHALL return `str` on match and `null` on no match.
- If `pattern` has capture groups, `regex(...)` SHALL return an array of extracted values:
  - one capture group: `string[]`
  - multiple capture groups: `string[][]` (one array per match)

Replacement mode:

- If `replacement` is provided, `regex(...)` SHALL return the replaced string.
- If `options` contains `a`, it SHALL replace all matches; otherwise it SHALL replace only the first match.

#### Scenario: Builtin and member forms are equivalent
- **GIVEN** an expression `regex("a1b2", "(\\d)")`
- **AND** an expression `"a1b2".regex("(\\d)")`
- **WHEN** both expressions are evaluated
- **THEN** both results are equal

#### Scenario: No capture groups returns original string on match
- **GIVEN** an expression `regex("abc", "b")`
- **WHEN** the expression is evaluated
- **THEN** the result is `"abc"`

#### Scenario: One capture group returns list of captured values
- **GIVEN** an expression `regex("a1b2", "(\\d)")`
- **WHEN** the expression is evaluated
- **THEN** the result is `["1", "2"]`

#### Scenario: Multiple capture groups return list of group-tuples
- **GIVEN** an expression `regex("x=1,y=2", "(\\w)=(\\d)")`
- **WHEN** the expression is evaluated
- **THEN** the result is `[["x", "1"], ["y", "2"]]`

#### Scenario: Replacement first vs all
- **GIVEN** an expression `regex("a1b2", "(\\d)", "X")`
- **WHEN** the expression is evaluated
- **THEN** the result is `"aXb2"`
- **GIVEN** an expression `regex("a1b2", "(\\d)", "X", "a")`
- **WHEN** the expression is evaluated
- **THEN** the result is `"aXbX"`

#### Scenario: Parse extracted groups with option 'p'
- **GIVEN** an expression `regex("a1b2", "(\\d)", "p")`
- **WHEN** the expression is evaluated
- **THEN** the result is `[1, 2]`


### Requirement: Math functions exp/ln/sign/gcd/lcm
The expression engine SHALL provide the following built-ins:

- `exp(x)`
- `ln(x)`
- `sign(x)`
- `gcd(values...)`
- `lcm(values...)`

Math input coercion SHALL follow the existing built-in numeric conventions (i.e., `Number(x)` where applicable). Nullish inputs SHOULD yield `null` where the existing engine returns null for other numeric functions.

#### Scenario: exp() computes e^x
- **GIVEN** an expression `exp(1)`
- **WHEN** the expression is evaluated
- **THEN** the result is approximately `2.718281828...`

#### Scenario: ln() is an alias of natural logarithm
- **GIVEN** an expression `ln(exp(2))`
- **WHEN** the expression is evaluated
- **THEN** the result is approximately `2`

#### Scenario: sign() returns -1/0/1
- **GIVEN** expressions `sign(-3)`, `sign(0)`, `sign(7)`
- **WHEN** they are evaluated
- **THEN** the results are `-1`, `0`, `1`

#### Scenario: sign(null) returns null
- **GIVEN** an expression `sign(null)`
- **WHEN** the expression is evaluated
- **THEN** the result is `null`

#### Scenario: gcd() and lcm() accept arrays and variadic numbers
- **GIVEN** an expression `gcd([12, 18])`
- **WHEN** the expression is evaluated
- **THEN** the result is `6`
- **GIVEN** an expression `lcm(3, 4, 6)`
- **WHEN** the expression is evaluated
- **THEN** the result is `12`

#### Scenario: lcm() returns 0 when any input is <= 0 (Java parity)
- **GIVEN** an expression `lcm(3, 0)`
- **WHEN** the expression is evaluated
- **THEN** the result is `0`

#### Scenario: gcd() returns 0 when any input is < 0 (Java parity)
- **GIVEN** an expression `gcd(3, -1)`
- **WHEN** the expression is evaluated
- **THEN** the result is `0`


### Requirement: age() year difference calculation
The expression engine SHALL provide `age(start, endOrOptions?, options?)`.

- If `end` is omitted, it SHALL default to `now()`.
- Options:
  - `y`: pure year delta (`end.year - start.year`)
  - `m`: year delta adjusted by month (Java parity)
  - default: year delta adjusted by month+day (Java parity)

Argument disambiguation:

- If the 2nd argument is a string consisting only of known option letters (`[ym]`, case-insensitive), it SHALL be treated as `options`.
- Otherwise, it SHALL be treated as `end`.

#### Scenario: Default age() uses month/day adjustment
- **GIVEN** `start = datetime(2000, 6, 15, 0, 0, 0)`
- **AND** `end = datetime(2026, 6, 14, 0, 0, 0)`
- **WHEN** evaluating `age(start, end)`
- **THEN** the result is `25`

#### Scenario: Option 'y' ignores month/day
- **GIVEN** `start = datetime(2000, 6, 15, 0, 0, 0)`
- **AND** `end = datetime(2026, 6, 14, 0, 0, 0)`
- **WHEN** evaluating `age(start, end, "y")`
- **THEN** the result is `26`


### Requirement: workday() business-day date shifting
The expression engine SHALL provide `workday(date, diff, offDays?, options?)`.

- `date` SHALL be a Date-like value.
- `diff` SHALL be an integer number of workdays to shift (positive or negative).
- `offDays` (if provided) SHALL be an array/sequence of Date values.
- `options` (if provided) SHALL be treated as a set of single-letter flags; `b` indicates `offDays` is sorted (optimization only).

Off-day semantics (Java parity):

- Weekends SHALL be treated as non-workdays.
- An `offDays` date that falls on a weekday SHALL be treated as a holiday (non-workday).
- An `offDays` date that falls on a weekend SHALL be treated as an adjusted workday.

#### Scenario: workday() shifts across weekends
- **GIVEN** `t = datetime(2026, 1, 2, 0, 0, 0)`
- **WHEN** evaluating `workday(t, 1)`
- **THEN** the result is `datetime(2026, 1, 5, 0, 0, 0)`


### Requirement: workdays() workday sequence/count between dates
The expression engine SHALL provide `workdays(begin, end, offDaysOrOptions?, options?)`.

- By default, it SHALL return an array/sequence of workday Dates between `begin` and `end` (inclusive).
- If `options` contains `n`, it SHALL return the count of workdays instead of the list.
- If `options` contains `x`, it SHALL exclude the end date from the range (Java parity).

Argument disambiguation:

- If the 3rd argument is a string, it SHALL be treated as `options`.
- Otherwise, the 3rd argument SHALL be treated as `offDays`.

#### Scenario: workdays() returns list of workdays (inclusive)
- **GIVEN** `b = datetime(2026, 1, 1, 0, 0, 0)`
- **AND** `e = datetime(2026, 1, 7, 0, 0, 0)`
- **WHEN** evaluating `workdays(b, e)`
- **THEN** the result contains 5 dates (Mon-Fri) and excludes weekend dates

#### Scenario: workdays(...,"n") returns count
- **GIVEN** `b = datetime(2026, 1, 1, 0, 0, 0)`
- **AND** `e = datetime(2026, 1, 7, 0, 0, 0)`
- **WHEN** evaluating `workdays(b, e, "n")`
- **THEN** the result is `5`


### Requirement: Web-IDE grouped demos for new functions
The Web-IDE SHALL provide grouped demos that showcase the new functions:

- String demo: like + regex
- Math demo: exp/ln/sign/gcd/lcm
- Date demo: age/workday/workdays

#### Scenario: User loads and runs each grouped demo
- **GIVEN** the Web-IDE demo list
- **WHEN** user loads each of the 3 grouped demos and runs the sheet
- **THEN** the demo executes without errors and visibly demonstrates the new functions

---

## NON-FUNCTIONAL Requirements

### Requirement: Unit tests and coverage
All newly introduced expression functions SHALL have unit tests. The project SHALL maintain >80% coverage for the newly added code.

#### Scenario: Coverage gate
- **GIVEN** the new functions are implemented
- **WHEN** running `bun test --coverage`
- **THEN** tests pass and coverage for new code is >80%
