# How the world reset works

## Short version

Flame Altar base areas are stored in their own sections and stay. Everything else
(terrain edits, opened chests, resources, POI state) is recorded per chunk in
`chunk_persistent_data`, and the engine deletes chunk entries when a chunk has been
idle long enough. Deleting entries = the world regenerating that area.

## What was observed locally

- The log line `[server_save] Create Chunk Persistent Data` / `Clear Chunk Persistent Data`
  exists in the shipped binary and appears around world load and shutdown.
- During a ~40 minute play session, the engine removed 10 of 20 chunk entries from the
  section while the player was online (details in
  [experiment-2026-10-22.md](experiment-2026-10-22.md)).
- The two other worlds in the same installation had no such section at all.

That last point is the reason the tool is safe: "no `chunk_persistent_data`" is a state
the game itself produces.

## Timer history (conflicting sources)

| When | Source | Claim |
| --- | --- | --- |
| Jan 2024 | Official patch 0.7.0.1 notes | reset timer lowered to **30 minutes**, only while no player is nearby |
| Jan 2024 | Developer reply on the official feedback board | single-player resets on every game start; server **every 2 hours** real time (3 in-game days for empty chunks) |
| Jan 2024 | Steam known-issues quote | chunks have a **2 hour** respawn timer, ticking only while the chunk is unloaded |
| 2025 | Community threads | still resets after several in-game days / on restart |
| Oct 2026 | Official wiki (page text predates 1.0) | "will reset after 30 minutes or upon a game restart" |
| Oct 2026 | Server-hosting guide | ~2 real hours of chunk inactivity, plus restart |

With default day/night lengths (30 min + 12 min), **3 in-game days ≈ 2 hours**, so those
two figures describe the same timer. The 30-minute figure comes from Early Access and is
still repeated by the wiki.

**Conclusion used in the docs:** the timer is per chunk and has changed between versions.
The tool does not depend on its value.

**Unknown:** whether a full restart still forces a reset in 1.0. Sources disagree:
the wiki says yes (Early Access text), community reports for 1.0 focus on the time-based
timer. This does not affect the tool — it never relies on a restart, and it refuses to
run while the game or a dedicated server is up.

## What the tool does instead

Drop the whole section, once, while the world is closed. The engine then has no stored
delta for any non-base chunk and rebuilds them from the world seed on the next load.
