# Expression Engine Feature Comparison: Java vs TypeScript (act_4)

## Document Purpose
This document compares the Java expression engine implementation (E:\infra-dev\src\esProc) with the TypeScript implementation (packages/expression) as of act_4, building on the act_2 analysis.

## Executive Summary

**TypeScript Implementation Status:**
- ✅ Core expression parsing and evaluation
- ✅ Expanded built-in functions (~56 functions, incl. json/parse and count/icount)
- ✅ Expanded member functions (~30 functions)
- ✅ Database connection support (connect, query, execute, commit, rollback)
- ✅ Aggregation lifecycle (gather/regather/finish)
- ✅ Advanced aggregations (median, top)
- ✅ Record/table member functions (field, fname, fno, key, record, keys, row)
- ✅ Sequence member functions (select, sort, group, join, derive)
- ✅ File member functions (read, write, import, export)
- ✅ Cursor member functions (fetch, skip)
- ⚠️ Limited compared to Java's 150+ built-in functions and 200+ member functions


**Java Implementation Scope:**
- 150+ built-in functions across 10+ categories
- 200+ member functions across 15+ object types
- 40+ operators with full assignment variants
- Advanced features: parallel operations, cursors, channels, virtual databases, Excel integration

---

## 1. Built-in Functions Comparison

### 1.1 Implemented in TypeScript ✅

#### Math Functions (12 functions)
- `abs`, `pow`, `sqrt`, `sin`, `cos`, `tan`, `log`, `log10`, `ceil`, `floor`, `round`, `rand`

#### String Functions (12 functions)
- `upper`, `lower`, `trim`, `substr`, `replace`, `pos`, `split`, `left`, `right`, `mid`, `concat`, `len`

#### Date/Time Functions (13 functions)
- `now`, `date`, `dateadd`, `month`, `day`, `year`, `hour`, `minute`, `second`, `datevalue`, `datetime`, `datediff`, `format`

#### Aggregation Functions (9 functions)
- `sum`, `avg`, `min`, `max`, `median`, `top`, `range`, `count`, `icount`

#### Control Flow (4 functions)
- `if`, `case`, `ifp`, `casep`

#### Database (1 function)
- `connect`

#### Utility (1 function)
- `nvl`

#### Conversion Functions (4 functions)
- `json`, `parse`, `json_parse`, `json_stringify`

**Total TypeScript: ~56 built-in functions**


---

### 1.2 Missing from TypeScript (Java-only) ❌

#### Math Functions (48+ missing)
**Trigonometric:**
- `asin`, `acos`, `atan` - Inverse trigonometric
- `sinh`, `cosh`, `tanh` - Hyperbolic
- `asinh`, `acosh`, `atanh` - Inverse hyperbolic

**Logarithmic:**
- `ln` - Natural logarithm
- `lg` - Base-10 logarithm (duplicate of log10)
- `exp` - Exponential

**Combinatorics:**
- `fact` - Factorial
- `combin` - Combinations
- `permut` - Permutations
- `gcd` - Greatest common divisor
- `lcm` - Least common multiple

**Bitwise:**
- `and`, `or`, `not`, `xor` - Bitwise operations
- `bits`, `bit1` - Bit manipulation
- `bin`, `hex` - Base conversion
- `shift` - Bit shifting

**Other Math:**
- `sign` - Sign function
- `pi` - Pi constant
- `inf` - Infinity
- `hash` - Hash function
- `remainder` - Remainder/modulo
- `product` - Product calculation
- `digit`, `digits` - Digit operations

#### String Functions (15+ missing)
- `like` - Pattern matching
- `fill`, `pad` - String padding
- `rands` - Random string
- `urlencode` - URL encoding
- `charencode` - Character encoding
- `base64` - Base64 encoding
- `md5` - MD5 hashing
- `aes`, `des`, `desede`, `rsa` - Encryption functions

#### Type Conversion Functions (18+ missing)
- `bool`, `int`, `long`, `float`, `number` - Numeric conversions
- `string` - To string
- `decimal` - To BigDecimal
- `char`, `asc` - Character conversion
- `rgb` - RGB color
- `chn` - Chinese conversion
- `xml` - XML conversion
- `typeof` - Type checking
- `isalpha`, `isdigit`, `islower`, `isupper` - Character type checks
- `ifv`, `ifa`, `ifr`, `ift`, `ifdate`, `iftime`, `ifnumber`, `ifstring` - Type-specific conversions


#### Algebra Functions (21 missing)
- `var` - Variance
- `mse` - Mean squared error
- `mae` - Mean absolute error
- `dis` - Distance
- `I` - Identity matrix
- `mul` - Matrix multiplication
- `transpose` - Matrix transpose
- `inverse` - Matrix inverse
- `det` - Determinant
- `rankm` - Matrix rank
- `linefit` - Linear fitting
- `polyfit` - Polynomial fitting
- `norm` - Normalization
- `pearson` - Pearson correlation
- `spearman` - Spearman correlation

#### Date/Time Functions (12+ missing)
- `age` - Age calculation
- `days`, `elapse` - Time differences
- `periods`, `interval` - Period calculations
- `pdate` - Period date
- `deq` - Date equality
- `workday`, `workdays` - Business day calculations
- `itx`, `addx`, `subx`, `cmpx` - Extended date operations
- `millisecond` - Millisecond component

#### Aggregation Functions (8+ missing)
- `maxp`, `minp` - Position-based max/min
- `mode` - Mode calculation
- `conj`, `union` - Set operations
- `rank`, `ranki` - Ranking
- `cum` - Cumulative operations
- `iterate` - Iteration with aggregation


#### Sequence/Collection Functions (10+ missing)
- `seq` - Sequence creation
- `z` - Sequence generation
- `join`, `xjoin`, `joinx`, `xjoinx` - Join operations
- `create` - Object creation
- `new` - Instance creation
- `get` - Element retrieval

#### Database & I/O Functions (10+ missing)
- `vdbase` - Virtual database
- `cursor` - Cursor creation
- `channel` - Channel creation
- `blob` - Binary large object
- `jdbccall` - JDBC call
- `filename` - File name operations
- `directory` - Directory operations
- `file` - File creation
- `movefile` - File movement
- `httpfile` - HTTP file
- `httpupload` - HTTP upload

#### System & Utility Functions (15+ missing)
- `eval` - Expression evaluation
- `func` - Function reference
- `call` - Function call
- `register` - Function registration
- `arguments` - Function arguments
- `env` - Environment variables
- `system` - System execution
- `output` - Output
- `jvm` - JVM operations
- `sleep` - Sleep/delay
- `lock` - Locking
- `invoke` - Java method invocation
- `clipboard` - Clipboard operations
- `chardetect` - Character detection
- `cellname` - Cell naming
- `uuid` - UUID generation

#### Control Flow (3+ missing)
- `between` - Range checking
- `cmp`, `cmps` - Comparison functions
- `ifn` - If null

---

## 2. Member Functions Comparison

### 2.1 Implemented in TypeScript ✅

#### Array/Dataset Methods (8 functions)
- `count()`, `sum()`, `avg()`, `min()`, `max()` - Aggregations
- `first()`, `last()` - Element access
- `calc()` - Map expression over items

#### Sequence Methods (5 functions)
- `select()`, `sort()`, `group()`, `join()`, `derive()`

#### File Methods (4 functions)
- `read()`, `write()`, `import()`, `export()`

#### Cursor Methods (2 functions)
- `fetch()`, `skip()`

#### Record Methods (5 functions)
- `field(name, [value])` - Get/set field
- `fname([index])` - Get field names
- `fno([field])` - Get field number/count
- `key(...)` - Get key values
- `record([values])` - Get/set record

#### Dataset Methods (2 functions)
- `keys([...fields])` - Get/set column keys
- `row(key)` - Find row by key

#### Database Methods (4 functions)
- `query(sql, ...)` - Execute query
- `execute(sql, ...)` - Execute statement
- `commit()`, `rollback()` - Transaction control

**Total TypeScript: ~30 member functions**



---

### 2.2 Missing from TypeScript (Java-only) ❌

#### Sequence Member Functions (100+ missing)

**Selection & Filtering:**
- `select`, `pselect` - Filter by condition
- `top`, `ptop` - Top N elements
- `find`, `pfind` - Find elements
- `lookup` - Lookup operation
- `contain` - Containment check

**Transformation:**
- `derive` - Derive new fields
- `new`, `news` - Create new sequences
- `create` - Create sequence
- `enum`, `penum` - Enumeration
- `align` - Alignment
- `modify` - Modify elements
- `insert`, `delete` - Insert/delete
- `reset` - Reset sequence

**Sorting & Ordering:**
- `sort`, `psort` - Sort sequence
- `rvs` - Reverse
- `swap` - Swap elements
- `shift` - Shift elements
- `pad` - Padding

**Grouping & Aggregation:**
- `group`, `groups`, `groupc`, `groupi` - Grouping operations
- `cumulate` - Cumulative aggregation
- `proportion` - Proportion calculation
- `iterate` - Iteration
- `rank`, `ranks` - Ranking
- `cand`, `cor` - Correlation

**Set Operations:**
- `conj`, `conjx` - Conjunction
- `union`, `xunion` - Union
- `diff` - Difference
- `isect` - Intersection
- `merge`, `mergex` - Merge

**Joining:**
- `join`, `joinx` - Join operations
- `fjoin` - Foreign key join
- `pjoin` - Parallel join
- `mjoin` - Multi-join
- `switch` - Switch/mapping

**Utility:**
- `len` - Length
- `step` - Step through
- `inv` - Inverse
- `p` - Position conversion
- `m` - Multi-get
- `eq` - Equality
- `ifn`, `nvl` - Null handling
- `id` - Identifier
- `to` - Conversion
- `range` - Range
- `pivot` - Pivot table
- `array` - Array conversion
- `bits` - Bit operations
- `nodes` - Node operations
- `regex` - Regular expression
- `concat` - Concatenation
- `avgif`, `sumif`, `countif`, `minif`, `maxif` - Conditional aggregates
- `pseg`, `segp` - Segmentation
- `pmin`, `pmax` - Parallel min/max
- `pos` - Position
- `v` - Value
- `export` - Export
- `createcursor` - Create cursor
- `mcursor` - Memory cursor

#### Table Member Functions (7+ missing)
- `icursor` - Index cursor
- `ifind` - Index find
- `memory` - Memory table
- `dup` - Duplicate
- `paste` - Paste data
- `rename` - Rename
- `alter` - Alter structure
- `index` - Index operations

#### File Member Functions (16+ missing)
- `name` - File name
- `exists` - File exists
- `size` - File size
- `date` - File date
- `property` - File properties
- `iselect` - Index select
- `xlsexport`, `xlsimport` - Excel export/import
- `xlsopen`, `xlswrite`, `xlsclose` - Excel operations
- `create`, `open`, `reset` - File operations
- `query` - Query file
- `structure` - File structure


#### Database Member Functions (6+ missing)
- `proc` - Stored procedure
- `update` - Update data
- `error` - Error handling
- `isolate` - Isolation level
- `savepoint` - Savepoint
- `createcursor` - Create cursor

#### Cursor Member Functions (13+ missing)
- `groups`, `groupx` - Grouping
- `sortx` - Sort
- `joinx` - Join
- `mergex` - Merge
- `total` - Total/aggregate
- `iterate` - Iterate
- `id` - Identifier
- `reset` - Reset cursor
- `memory` - Memory cursor
- `createcursor` - Create cursor
- `mcursor` - Memory cursor


#### Channel Member Functions (8 missing)
- `fetch` - Fetch data
- `groups`, `groupx` - Grouping
- `sortx` - Sort
- `joinx` - Join
- `total` - Total
- `iterate` - Iterate
- `id` - Identifier
- `result` - Get result

#### Data Warehouse Member Functions (20+ missing)
- `create`, `new`, `news` - Create operations
- `derive` - Derive
- `append`, `update`, `delete` - Data modification
- `import` - Import data
- `find` - Find records
- `index` - Index operations
- `memory` - Memory table
- `cursor`, `icursor` - Cursor operations
- `cgroups` - Grouped operations
- `attach` - Attach data
- `rename`, `alter` - Structure changes
- `cuboid` - Cuboid operations

#### Virtual Database Member Functions (20+ missing)
- `begin`, `commit`, `rollback` - Transaction control
- `home`, `path` - Path operations
- `lock` - Locking
- `list` - List contents
- `load`, `save` - Load/save
- `read`, `write`, `update` - Data operations
- `move`, `copy` - File operations
- `date` - Date operations
- `archive`, `purge` - Maintenance
- `retrieve` - Retrieve data
- `saveblob` - Save binary data
- `rename` - Rename

#### String Member Functions (7+ missing)
- `split` - Split string
- `words` - Word extraction
- `regex` - Regular expression
- `sbs` - Substring operations
- `htmlparse` - HTML parsing
- `sqlparse`, `sqltranslate` - SQL parsing
- `import` - Import string
- `property` - String properties

#### Record Member Functions (5+ missing)
- `prior` - Prior record
- `modify` - Modify record
- `alter` - Alter structure
- `create`, `derive` - Create/derive
- `array` - Array conversion
- `run` - Run expression

---

## 3. Operators Comparison

### 3.1 Implemented in TypeScript ✅

**Arithmetic:** `+`, `-`, `*`, `/`, `%`
**Comparison:** `==`, `!=`, `<`, `>`, `<=`, `>=`
**Logical:** `&&`, `||`, `and`, `or`, `not`
**Assignment:** `=`, `+=`, `-=`, `*=`, `/=`, `%=`
**Set Operations:** `&` (union), `^` (intersect), `\` (diff), `|` (conj)
**Member Access:** `.` (dot operator)
**Comma:** `,`

**Total: ~25 operators**

### 3.2 Missing from TypeScript ❌

**Assignment Variants:**
- `|=` (UnionAssign)
- `,=` (ConjAssign)
- `&=` (ISectAssign)

**Memory-based Operators:**
- `MemAdd`, `MemSubtract`, `MemMultiply`, `MemDivide`, `MemMod`, `MemIntDivide`

**Integer Division:**
- `IntDivideAssign`

---

## 4. Advanced Features Comparison

### 4.1 Implemented in TypeScript ✅

- ✅ Expression parsing and AST evaluation
- ✅ Scope-based variable resolution
- ✅ Null safety and null propagation
- ✅ Type tracking (DB, File, Sequence, Table, Cursor)
- ✅ Function registry extensibility
- ✅ Member function dispatch
- ✅ Parameter tree parsing (hierarchical parameters)
- ✅ Macro substitution (`${expr}`, `$(key)`)
- ✅ Set operations on arrays
- ✅ Database connection and query execution
- ✅ Aggregation lifecycle (gather/regather/finish)
- ✅ Advanced aggregations (median, top)

### 4.2 Missing from TypeScript ❌

- ❌ Parallel operations (pselect, psort, pjoin, etc.)
- ❌ Cursor operations (groups, sortx, joinx, etc.)

- ❌ Channel operations (streaming data channels)
- ❌ Virtual database (VDB) abstraction
- ❌ Excel integration (XLS import/export/manipulation)
- ❌ File-based data sources (CSV/JSON query support beyond read/write/import/export)

- ❌ HTML/SQL parsing utilities
- ❌ Complex join types (foreign key, parallel, multi-join)
- ❌ Cuboid operations (OLAP-style)
- ❌ File group operations with transactions
- ❌ Dynamic function loading/overload resolution
- ❌ Rich diagnostics and type checking parity
- ❌ Stored procedure calls
- ❌ Savepoint support
- ❌ Isolation level control
- ❌ Index operations
- ❌ Memory tables
- ❌ Pivot tables
- ❌ Encryption functions
- ❌ Matrix/linear algebra operations
- ❌ Statistical correlation functions

---

## 5. Act_2 Remaining Work (from summary)

From `doc\brainstorm\port-expression-engine\act_2\summary_20260117_2135.md`:

### Follow-ups from Act_2:
1. **IO/file/cursor/vdb member functions** - Implement remaining functions beyond query/execute/commit/rollback
2. **Table/record member function coverage** - Expand beyond current field/fname/fno/key/record/keys/row
3. **Conversion/algebra functions** - Add missing conversion and algebra function families
4. **Dynamic function loading/overload resolution** - Implement function overloading system

---

## 6. Priority Gap Analysis

### High Priority (Core Data Processing)
1. **Sequence operations:** select, sort, group, join, derive - Essential for data transformation
2. **File operations:** read, write, import, export - Essential for file-based data sources
3. **Cursor operations:** fetch, skip - Essential for large dataset handling
4. **Type conversion:** json, xml, parse - Essential for data interchange
5. **Additional aggregations:** count, icount, mode, rank - Common data analysis needs

### Medium Priority (Enhanced Functionality)
1. **String operations:** like, regex, split - Enhanced text processing
2. **Math functions:** exp, ln, sign, gcd, lcm - Extended math support
3. **Date operations:** age, workday, periods - Business date calculations
4. **Set operations:** union, diff, isect - Collection manipulation
5. **Table operations:** rename, alter, index - Schema management

### Low Priority (Advanced Features)
1. **Parallel operations:** pselect, psort, pjoin - Performance optimization
2. **Virtual database:** VDB operations - Advanced data warehouse features
3. **Excel integration:** XLS operations - Office integration
4. **Encryption:** AES, DES, RSA - Security features
5. **Algebra:** Matrix operations, correlations - Statistical analysis
6. **Channel operations:** Streaming data - Advanced data flow

---

## 7. Implementation Recommendations

### Phase 1: Core Data Operations (High Priority)
- ✅ Implement sequence member functions: select, sort, group, join, derive
- ✅ Add file member functions: read, write, import, export
- ✅ Add type conversion functions: json, parse (xml still missing)
- ✅ Implement cursor basic operations: fetch, skip


### Phase 2: Enhanced Functionality (Medium Priority)
- Add string operations: like, regex, split
- Expand math functions: exp, ln, sign
- Add date operations: age, workday
- Implement set operations: union, diff, isect

### Phase 3: Advanced Features (Low Priority)
- Parallel operations
- Virtual database support
- Excel integration
- Encryption functions
- Matrix/algebra operations

---

## 8. Summary Statistics

| Category | Java | TypeScript | Gap |
|----------|------|------------|-----|
| Built-in Functions | 150+ | 56 | 94+ |
| Member Functions | 200+ | 30 | 170+ |
| Operators | 40+ | 25 | 15+ |
| **Total** | **390+** | **111** | **279+** |

**Coverage:** TypeScript has implemented approximately **28%** of Java's expression engine functionality.


**Core Strengths (TypeScript):**
- Solid foundation with parsing, evaluation, and type system
- Database connectivity working
- Basic aggregations and member functions
- Extensible architecture

**Major Gaps:**
- Sequence/collection operations beyond select/sort/group/join (e.g., top/find/lookup)
- File-based data source operations beyond read/write/import/export
- Cursor and channel operations beyond fetch/skip
- Type conversion (XML and remaining conversions)
- Advanced math and string operations
- Virtual database and Excel integration


---

## 9. References

**TypeScript Implementation:**
- `packages/expression/src/` - Core expression engine
- `packages/expression/__tests__/expression.test.ts` - Test coverage

**Java Implementation:**
- `E:\infra-dev\src\esProc\src\main\java\com\scudata\expression\` - Expression engine
- `E:\infra-dev\src\esProc\src\main\java\com\scudata\expression\fn\` - Built-in functions
- `E:\infra-dev\src\esProc\src\main\java\com\scudata\expression\mfn\` - Member functions

**Previous Analysis:**
- `doc\brainstorm\port-expression-engine\act_2\summary_20260117_2135.md`
- `doc\brainstorm\port-expression-engine\act_2\feature-diff-20260117_2135.md`
