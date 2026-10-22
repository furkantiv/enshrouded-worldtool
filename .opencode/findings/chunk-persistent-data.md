# `chunk_persistent_data` layout

**Status:** header fields observed; index proven by an offset chain that closes exactly
at the end of the body; per-chunk blob internals only partially decoded.

## Section body

```
@0   u32  constant (0x00136CD3 in both observed saves)
@4   u32  dataTotal = bodyLength - 8
@8   u32  checksum / identifier   ← algorithm unknown
@12  u32  recordCount
@16  u32  chunkCount
@20  u32  constant (256 observed)
@24  chunkCount × 12 bytes:
       u32 chunkId
       u32 offset   (relative to body + 8)
       u32 size
data region starts at body + 8 + entries[0].offset
             == body + 24 + 12 × chunkCount
```

Validation used by the tool (`src/chunks.mjs`):

1. `dataTotal === bodyLength - 8`
2. `8 + entries[0].offset === 24 + 12 × chunkCount`
3. `entries[i].offset + entries[i].size === entries[i+1].offset` for all `i`
4. the last blob ends exactly at `bodyLength`

All four hold on both measured saves, so the index is not a guess.

## Per-chunk blob

Only the prefix was decoded; the tool does not need more:

```
+0x00  8 bytes    zero
+0x08  4 bytes    random-looking identifier (differs per chunk)
+0x0c  u32        36
+0x10  u32        A
+0x14  u32        A + 28
+0x18  u32        record count
+0x1c  u32        end offset (A + count + 20)
```

## What the engine does with it

The engine removes whole entries from the index over time (see
[world-reset.md](world-reset.md)). Entries that survive keep **identical** sizes and
bytes, which is why a reset shows up as a smaller section rather than shifted data.

## Open questions

- **Unknown:** the algorithm behind the `@8` checksum. Candidates tried on real data
  (XXH3-64 low32 of the body, of `body[8:]`, of the data region, CRC32 of the body,
  and the body with the hash field zeroed) all missed.
  Consequence: dropping one entry and rebuilding the section is not implemented —
  only dropping the whole section, which needs no checksum change.
- **Unknown:** `chunkId` → world coordinate mapping. Observed ids include
  `136, 137, 173…178, 212…218, 252…255` and a single large `1600`. Whether the large
  id is a far-away chunk or a non-spatial record is unresolved; its blob has the same
  layout as the others, which leans towards "spatial chunk" (inference only).
