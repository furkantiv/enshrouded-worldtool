# Sources

Public sources used for behaviour claims. Reliability roughly: official > developer
statement > community report > hosting-vendor guide.

## Official

| Source | Date | Claim used |
| --- | --- | --- |
| [Flame Altar — official wiki](https://enshrouded.wiki.gg/wiki/Flame_Altar) | page text from Early Access | "changes outside the Altar's boundaries will reset after 30 minutes or upon a game restart"; 16 altars; altar levels 40/80/120/160 |
| [Patch #1 changelog (0.7.0.1)](https://enshrouded.com/es/news/changelog-for-patch-1-v0-7-0-1) | Jan 2024 | reset timer lowered to 30 minutes, only while no player is nearby |
| [1.0 Update changelog](https://enshrouded.wiki.gg/wiki/1.0_Update) | Oct 2026 | 16 altars at flame level 11; Shroud can be pushed back with altars; no entry about the reset timer |
| [Server gameplay settings (Zendesk)](https://enshrouded.zendesk.com/hc/en-us/articles/20453241249821-Server-Gameplay-Settings) | — | 57 settings keys; **no** world-reset or persistence key |

## Developer statements

| Source | Date | Claim used |
| --- | --- | --- |
| [Feature request #527154 + developer note](https://enshrouded.featureupvote.com/suggestions/527154/) | Jan 2024 | single-player resets on every game start; server "every 2 hours real time (3 in-game days, for empty chunks)"; resetting exists partly for performance reasons |
| [Steam thread quoting dev known-issues](https://steamcommunity.com/app/1203620/discussions/0/4142816460196587432/) | Jan 2024 | chunks have a 2-hour respawn timer that only ticks while the chunk is unloaded |

## Community / third party

| Source | Date | Claim used |
| --- | --- | --- |
| [Supercraft — world reset boundaries](https://supercraft.host/wiki/enshrouded/world_reset_boundaries/) | 2026 | ~2-hour reset of "external" terrain; also claims a config key and POI building restrictions that the official settings list does not support (treated as unreliable) |
| [Freakhosting — restoring terrain voxels](https://help.freakhosting.com/games/enshrouded/restoring-terrain-voxels) | 2026 | approx. 2 real hours of chunk inactivity; reset on full restart |
| [Steam — "Do parts of the map regenerate?"](https://steamcommunity.com/app/1203620/discussions/0/4142816460196831669/) | Jan 2024 | "3 in-game days" phrasing |
| [r/Enshrouded — is the world reset still a thing?](https://www.reddit.com/r/Enshrouded/comments/1id83cu/) | Jan 2025 | still resets after several in-game days / on logout / on restart |

## Format reference

| Source | Use |
| --- | --- |
| [Kimikozi/enshrouded-save-editor](https://codeberg.org/Kimikozi/enshrouded-save-editor) — `lib/ksdcore.js`, `lib/xxh3.js` | independent `SV2C` container description (zstd blocks, XXH3 checksums). Used to cross-check this project's reader; the `chunk_persistent_data` layout in these notes was derived here and is not covered by that project. |

## Conflicts recorded

- **Reset timer:** 30 minutes (wiki, Early Access patch) vs 2 hours / 3 in-game days
  (developer + community, and 1.0 player reports). Both may be true at different
  versions; the tool is independent of the value.
- **Reset on restart:** wiki says yes; 1.0 community reports emphasise the time-based
  chunk timer. Not resolved.
- **Server config for the reset:** claimed by one hosting vendor; the official settings
  list has no such key.
