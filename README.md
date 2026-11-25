# ThaDex

A personal Pokédex app for Android, built for my own use. It covers every Pokémon game released so far, works offline, and has a team builder and damage calculator for both competitive and casual play.

## Features

### Pokédex
- **National Dex** and the **regional Pokédex** of every main-series game (33 dexes, National through Legends: Z-A), switched with the dex picker. The Dex list and Pokémon pages take on the selected dex's colors and game.
- **Search** by name, number or type, and **filter** by type and generation.
- **Caught checklist** for each dex, so a Paldea run doesn't tick off Kanto.

### Pokémon pages
Typing, type matchups, abilities, base stats, evolutions (including regional forms' own lines), where to find it, learnsets for the selected game, and the Pokédex entry.

### Reference
- **Moves**: type, category, power, accuracy, PP and effects
- **Abilities**: effects, plus the Pokémon that can have them
- **Items**: descriptions, effects and where to find them
- **Types & Natures**: type matchups, and which stat each nature raises and lowers

### Team Builder
- Build and save teams for a chosen game
- Set each Pokémon's moves, ability, item, nature, EVs and IVs
- See a team's weaknesses and its moves' type coverage
- Import and export teams as Pokémon Showdown text

### Damage Calculator
Set up an attacker, a defender, a move and the battle conditions (weather, terrain, status, stat boosts) to see the damage range. It follows Smogon's damage calculator, with separate formulas for Gen I–II, Gen III–IV and Gen V onward.

### Settings
- Choose which side the menu opens from
- Download **offline image packs**: sprites and item icons (a few MB), and official artwork (about 160 MB)

## Tech Stack

- **[Expo](https://expo.dev) SDK 58 + React Native** in TypeScript, targeting Android
- **Expo Router** for navigation (routes live in `src/app/`)
- **[PokéAPI](https://pokeapi.co)** as the data source, bundled as a **SQLite** database (`expo-sqlite`) so the app works offline
- **[PokeAPI/sprites](https://github.com/PokeAPI/sprites)** for images, shown and cached with `expo-image`, or saved to the device with `expo-file-system`
- **EAS Build** and **EAS Update** for builds and over-the-air updates

## Getting Started

```bash
npm install
npm start
```

Scan the QR code with the **Expo Go** app on Android to open the app on your phone.

`npm start` builds the Pokédex database first if it's missing or out of date. If you run `npx expo start` directly, run `npm run build-db` once beforehand.

Before committing, run:

```bash
npx expo lint
npx tsc --noEmit
```

## Building and Updating

Builds run in the cloud on [EAS](https://docs.expo.dev/eas/) (see `eas.json`):

```bash
npx eas-cli@latest build --profile preview --platform android     # installable APK
npx eas-cli@latest build --profile production --platform android  # store build (AAB)
```

JavaScript-only changes can be shipped over the air to installed builds on the same channel:

```bash
npx eas-cli@latest update --channel preview --message "..."
```

The runtime version follows the app version (`appVersion` policy), so bump `version` in `app.json` and make a new build whenever native code or dependencies change.

## Data

All game data comes from [PokéAPI](https://pokeapi.co)'s CSV dump. It is built into a SQLite database that ships with the app, so browsing works offline.

- `npm run build-db` downloads the CSV files from a pinned PokéAPI commit (cached in `.cache/`) and writes `assets/db/pokedex.db`. Add `-- --force` to rebuild even when the database is up to date.
- The tables keep [PokéAPI's own schema](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv), filtered to English text, with the language columns dropped.
- To update the data, change `POKEAPI_COMMIT` in `scripts/build-db.mjs` and rebuild. The app picks up the new version automatically.
- The database isn't committed to git (it's about 43 MB). EAS cloud builds create it through the `eas-build-post-install` script.
- PokéAPI has no item locations. Those come from [Serebii.net](https://www.serebii.net/itemdex/)'s ItemDex, saved in `data/item-locations.json` (committed) and loaded into an extra `item_locations` table. `node scripts/scrape-item-locations.mjs` refreshes the file: it fetches one page at a time with a pause between requests and caches pages in `.cache/serebii-items/`, so only new items are fetched again. Then run `npm run build-db`.
- Images come from the [PokeAPI/sprites](https://github.com/PokeAPI/sprites) repo (see `src/db/sprites.ts`). They're loaded on demand and cached, or read from the device once an offline pack is downloaded (see `src/db/offline-images.ts`).
- Teams and the caught checklist are stored on the device in a separate database (`teams.db`), apart from the bundled data.

## Project Structure

```
src/app/         Screens and navigators (Expo Router)
src/components/  UI components, grouped by feature
src/db/          Database access, queries, damage calc, Showdown format, teams, caught list
src/hooks/       Shared hooks (theme, selected dex, menu side…)
scripts/         Database build and item-location scraper
data/            Committed source data (item locations)
```

See `DESIGN.md` for the design system and `PRODUCT.md` for the product brief.

## Status

🚧 In active development. Planned: write-ups of core game mechanics.

## Disclaimer

This is a personal, non-commercial fan project. Pokémon and all related names and images are trademarks of Nintendo, Game Freak and The Pokémon Company.
