# Streaming verification

From the repository root:

```sh
bun .cdmt-lite/missions/archived/spl-cursor-resources/verification/streaming-benchmark.ts
```

Before archiving, replace `archived` with `active`. The script creates isolated temporary CSV and SQLite fixtures with one million two-number rows, checks first-demand reads, batches, actual open/read/close events and per-process RSS increase, then removes the fixtures. It does not use SQL pagination or `all()`. The 64 MiB RSS signal applies to this fixture, not arbitrary row widths or caller materialization.

Final measured results: CSV first read 32,768 bytes, maxBatch 1024, reads 1,000,000, open/close 1/1, RSS increase 60.9375 MiB; SQLite maxBatch 1024, reads 1,000,000, open/close 1/1, RSS increase 57 MiB. Earlier runs varied with allocator state; all final signals passed without forcing GC inside the consumption loop.
