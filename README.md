# Pokédex App

A personal Pokédex app, built for my own use. It covers every Pokémon game released so far, and its advanced team builder works for both competitive and casual play.

## Features

### Pokédex
- **National Dex**: every Pokémon in National Dex order.
- **Regional Dexes**: the Pokédex of every region and game released so far.

### Reference data
Data and images for:
- **Pokémon**: stats, typing, abilities, evolutions, forms, learnsets and more
- **Regions**: each region and its Pokédex
- **Moves**: type, category, power, accuracy, PP and effects
- **Items**: descriptions and effects
- **Abilities**: effects, plus the Pokémon that can have them
- **Types**: type matchups and effectiveness
- **Natures**: which stat each one raises and lowers
- **Mechanics**: explanations of core game mechanics

### Team Builder
An advanced team builder for both competitive and casual players:
- Build and save teams
- Set each Pokémon's moves, abilities, items, natures, EVs and IVs
- Analyze a team's type coverage and weaknesses

## Tech Stack

- **[Expo](https://expo.dev) + React Native** in TypeScript, targeting Android
- **Expo Router** for navigation (routes live in `src/app/`)
- **[PokéAPI](https://pokeapi.co)** as the data source, stored on the device with **SQLite** so the app works offline
- **[PokeAPI/sprites](https://github.com/PokeAPI/sprites)** for images, shown and cached with `expo-image`
- **`@smogon/calc`** and **`@pkmn/*`** for the team builder: damage calcs, stat formulas and Showdown team import/export

## Getting Started

```bash
npm install
npm start
```

Scan the QR code with the **Expo Go** app on Android to open the app on your phone.

`npm start` builds the Pokédex database first if it's missing or out of date. If you run `npx expo start` directly, run `npm run build-db` once beforehand.

## Data

All game data comes from [PokéAPI](https://pokeapi.co)'s CSV dump. It is built into a SQLite database that ships with the app, so browsing works offline.

- `npm run build-db` downloads the CSV files from a pinned PokéAPI commit (cached in `.cache/`) and writes `assets/db/pokedex.db`. Add `-- --force` to rebuild even when the database is up to date.
- The tables keep [PokéAPI's own schema](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv), filtered to English text, with the language columns dropped.
- To update the data, change `POKEAPI_COMMIT` in `scripts/build-db.mjs` and rebuild. The app picks up the new version automatically.
- The database isn't committed to git (it's about 43 MB). EAS cloud builds create it through the `eas-build-post-install` script.
- Images come from the [PokeAPI/sprites](https://github.com/PokeAPI/sprites) repo (see `src/db/sprites.ts`). They're loaded on demand and cached on the device.

## Status

🚧 Early development.

## Disclaimer

This is a personal, non-commercial fan project. Pokémon and all related names and images are trademarks of Nintendo, Game Freak and The Pokémon Company.
