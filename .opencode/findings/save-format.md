# SV2C container (Enshrouded 1.0 world save)

**Status:** observed + derived. Every field below was validated against real saves;
section hashes recomputed with XXH3 match the stored values (17/17 on the test save).

## Header (48 bytes)

```
0x00  char[4]  "SV2C"
0x04  u16      version        (2 observed)
0x06  u16      headerSize     (48)
0x08  u32      fileSize       (must equal the actual file length)
0x0c  u8[16]   guid           (world identity, stable per world)
0x1c  u32      revision       (increments on save)
0x20  u64      timestamp      (unix seconds)
0x28  u32      tableOffset - 0x28
0x2c  u32      sectionCount
```

## Section table

At `0x28 + tableOffset`, `sectionCount` entries of 20 bytes:

```
u32 nameOffset   (relative to the entry start)
u32 nameLength
u32 dataOffset
u32 dataSize
u32 hash         XXH3-64(block) truncated to 32 bits
```

## Section block

```
"S2BH" | u32 blockVersion | u8 typeId | u8 compressed | u32 dataVersion | body
```

`compressed = 1` means the body is a zstd frame; `0` means raw bytes.

## Sections observed in 1.0 saves

| Name | typeId | Notes |
| --- | --- | --- |
| `world_metadata` | 11 | contains the world name as a length-prefixed UTF-8 string |
| `game_settings` | 12 | 128-byte settings blob |
| `base00`…`baseNN` | 2 | one per Flame Altar base area |
| `entity_chunk00` | 3 | zstd |
| `custom_strings` | 4 | |
| `snapping` | 5 | zstd, body starts with a nested `SBV2` container |
| `world_knowledge` | 6 | zstd |
| `weather` | 7 | |
| `logic` | 8 | |
| `known_users` | 13 | |
| `chunk_persistent_data` | 14 | see [chunk-persistent-data.md](chunk-persistent-data.md) |
| `miscellaneous` | 1 | |

Not every world has every section. Two untouched worlds in the same installation had
13 and 17 sections and **no `chunk_persistent_data` at all** — that absence is what
makes dropping the section a state the engine already accepts.

## Observations worth knowing

- `baseNN` indices are **positional**, not stable IDs. Between two saves of the same
  world, `base02`/`base03`/`base04` held the same three blobs in a different order.
- Blocks are never recompressed by the tool, so their stored hashes stay valid; the
  rebuild copies bytes and only rewrites offsets, the table, `fileSize`, `revision`
  and the timestamp.
