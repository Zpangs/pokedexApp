# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users
One person: the owner, using it on their own Android phone. They play the mainline Pokémon games both casually and competitively. The main use is quick lookups in the middle of a game, with the phone in one hand and the game in the other: find a Pokémon fast, then check its typing, weaknesses, abilities, moves or where to catch it, and get back to playing. Longer sessions of planning and team building happen too, but they come second.

## Product Purpose
A personal, offline Pokédex covering every Pokémon game released so far. It includes the National Dex and every regional dex, with data and images for Pokémon, regions, moves, items, abilities, natures, types and mechanics. It also has an advanced team builder for both competitive and casual play. Success means an answer arrives faster than searching the web or opening a wiki in the middle of a game.

## Positioning
It's built for one player's own lookups: offline, complete across every generation and regional dex, with competitive-grade team building (Smogon damage calc and Showdown formats) in the same app as the reference data.

## Operating Context
- Used mid-game, often while holding a console or with the game on a TV, so lookups are short and interrupted.
- Works fully offline from a bundled SQLite database built from PokéAPI (`npm run build-db`). Images come from the PokeAPI/sprites repo, load over the network and are cached on the device.
- Built in Expo / React Native with TypeScript and Expo Router.

## Capabilities and Constraints
- Ships on Android now. iOS or web may follow later, so screens should avoid locking the design to Android-only APIs where a cross-platform equivalent exists.
- Data: 1,025 species, all forms, 33 main-series Pokédexes (National through Legends: Z-A), learnsets for every version group, moves, items, abilities, natures, types, regions and encounters. All text is English only.
- PokéAPI has no game mechanics explanations. That content still has to be written and must not be invented as if it came from PokéAPI.
- Personal and non-commercial: no accounts, no sync and no monetization.

## Brand Commitments
None. "Pokédex App" is a working name. It's a fan project, and Pokémon names and images belong to Nintendo, Game Freak and The Pokémon Company.

## Evidence on Hand
- Game data: `assets/db/pokedex.db` (generated), using the PokéAPI CSV schema.
- Images: PokeAPI/sprites URLs through `src/db/sprites.ts`.
- No custom illustrations, logo or written mechanics content exist yet.

## Product Principles
1. Speed to answer comes first. The thing the player is looking for should take as few taps as possible, and searching should never wait on the network.
2. Everything works offline. The core reference never depends on a connection.
3. The data is complete and correct across every generation. Show form and game differences where they exist instead of flattening them.
4. It serves both casual and competitive players. Depth is always available but never in the way.

## Accessibility & Inclusion
- Color-blind safe: a type, category or stat is never shown by color alone. Type badges always include the type name.
- Otherwise standard accessibility: system font scaling, readable contrast and touch targets that are big enough.
