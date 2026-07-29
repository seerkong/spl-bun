# Chart Rendering (Index)

Goal: map Java chart/canvas pipeline to TS missing work.

## Java surface area (expression-facing)

- Builtin: `canvas()`
  - Implementation: `src/main/java/com/scudata/expression/fn/CreateCanvas.java`
  - Returns: `src/main/java/com/scudata/dm/Canvas.java`
- Member functions on Canvas:
  - `G.plot(...)`: `src/main/java/com/scudata/expression/mfn/canvas/Plot.java`
  - `G.draw(w,h)`: `src/main/java/com/scudata/expression/mfn/canvas/Draw.java`
  - `G.hlink()`: `src/main/java/com/scudata/expression/mfn/canvas/HLink.java`
  - Type binding: `src/main/java/com/scudata/expression/CanvasFunction.java`

## Java rendering backend

- Canvas -> chart Engine bridge:
  - `src/main/java/com/scudata/dm/Canvas.java` constructs `new com.scudata.chart.Engine(...)` and calls `Engine.calcImageBytes(...)`.
- Chart engine:
  - `src/main/java/com/scudata/chart/Engine.java`
  - Output:
    - bitmap bytes (JPG/PNG/GIF) via `calcBufferedImage` + `getImageBytes`
    - SVG bytes via `generateSVG` (Batik via reflection)
  - Hyperlinks:
    - HTML map links via `getHtmlLinks()`
    - SVG links inserted during `generateSVG`

## TypeScript status

- No `canvas()` builtin.
- No `.plot/.draw/.hlink` member functions.
- No TS chart rendering package in this repo (under `spl-bun/`) discovered in this scan.

Candidate TS integration points
- Builtins: `spl-bun/packages/expression/src/functions.ts`
- Member functions: `spl-bun/packages/expression/src/memberRegistry.ts`
- Typed handles: `spl-bun/packages/expression/src/types.ts` (would need a new type tag)

Checklist (missing)
- [ ] Define canvas object model and serialization expectations.
- [ ] Decide output formats (SVG only vs SVG + bitmap).
- [ ] Implement plot element model (Java uses `Sequence` of `ChartParam` objects).
- [ ] Implement draw pipeline and hyperlink extraction.
