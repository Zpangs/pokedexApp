---
version: 1
slug: "src-app-pokemon-number-tsx"
primary_target: "src/app/pokemon/[number].tsx"
related_targets: []
---

# Pokémon detail

Scope: `src/app/pokemon/[number].tsx`, opened by tapping a National Dex row. Mode: Operate. It inherits the Terminal Signs world (see the National Dex brief).
Task: check a Pokémon in the middle of a game. Matchups, abilities and stats come first; evolution, locations, moves and the Pokédex entry follow.

## Chosen structure

Sign Stack, chosen by the user over Departure Board and Your Game First (surface roll seed 17d78be8…, dealt candidate 1).

- A fixed yellow app bar holds Back, plus the number and name once the identity band scrolls away.
- The yellow identity band shows the big number, name, genus, type badges, official artwork and form chips.
- One scroll follows, with sticky panel signs: Type matchups (When defending) · Abilities · Base stats (Total) · Evolution · Where to find · Moves (game) · Pokédex entry.
- The highest stat's bar uses `barHighlight` (yellow in dark, black in light). Other bars use the neutral `bar`.
- Data gaps are stated, not hidden. Location data only covers games up to Sword/Shield. Forms without learnsets say so.
