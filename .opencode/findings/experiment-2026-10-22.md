# Experiment — 2026-10-22

Controlled measurement on one single-player world (Steam Cloud save, world name `1.0`,
6 Flame Altar bases). The game was closed during every file measurement.

## Method

1. Copy the world save and record size, revision, section table and the chunk index.
2. Play: load the world, edit one block **inside** an altar (no terrain work outside
   altars), quit to the main menu so the game writes its save.
3. Measure again and diff every section.
4. Apply the tool's reset outside the game and re-measure.
5. Load the world and check the result in-game.

## Step 1 — baseline (`T0`)

```
size       659,103 B      revision 3288      sections 17      bases 6
chunk section: 140,109 B body   chunks 20   records 2903
ids         136 137 173 174 175 176 177 178 212 213 214 215 216 217 218
            252 253 254 255 1600
```

## Step 2 — after the session (`T1`)

```
size       615,775 B      revision 3293      sections 17
chunk section:  96,512 B body   chunks 10   records 24
ids         173 174 175 213 214 215 253 254 255 1600
```

Section diff:

| Section | T0 → T1 |
| --- | --- |
| `chunk_persistent_data` | 140,109 → 96,512 B (−43,597) |
| `base05` | +189 B (the altar-interior edit landed here) |
| `base00`, `base01` | unchanged |
| `base02`, `base03`, `base04` | same three blobs, **reordered** |
| `world_metadata`, `miscellaneous`, `weather`, `known_users` | same size, new hash (ids/timestamps) |
| `entity_chunk00` | +4 B |
| `snapping` | +74 B |

Removed chunk ids: `136 137 176 177 178 212 216 217 218 252`.
Every retained id kept an **identical size** and byte content.

Readings:

- **Observed:** the engine deletes whole chunk entries over time; it does not rewrite
  or shift them.
- **Observed:** altar-interior edits go to `baseNN`, not to the chunk section.
- **Inferred:** the pruning is the time-based chunk reset (see
  [world-reset.md](world-reset.md)); the removed chunks had not been visited since the
  previous session.

## Step 3 — reset applied

```
before  615,775 B  rev 3293  17 sections
after   519,206 B  rev 3294  16 sections   (chunk_persistent_data dropped, 96,526 B)
verify  all retained blocks byte-identical; stored hashes untouched
```

## Step 4 — in-game verification

- Chests that had been opened before the reset were **refilled** — the expected effect.
- All 6 base areas intact (byte-identical `baseNN` sections).
- No terrain work was done outside altars in this session, so no trench check was
  possible; the chest state served as the observable.

## Additional checks

- Copy of the same world: reset → restore round-trip. After restore the file had 17
  sections again, `chunk_persistent_data` back with 12 chunks, and all section hashes
  valid.
- Two other worlds with no `chunk_persistent_data` (13 and 17 sections) confirm that a
  save without the section is a normal state.
