/**
 * Image URLs from the PokeAPI/sprites repo. Images aren't stored in the database: they're loaded
 * on demand and cached on the device by expo-image, or read from the device once their pack has
 * been downloaded in Settings (see offline-images.ts).
 *
 * `pokemonId` is `pokemon.id` (not the species id), so alternate forms get their own artwork.
 */
import { imageUri } from '@/db/offline-images';

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';

export const sprites = {
  /** Large official artwork, best for detail screens. */
  artwork: (pokemonId: number, shiny = false) =>
    shiny
      ? `${SPRITES}/pokemon/other/official-artwork/shiny/${pokemonId}.png`
      : imageUri('artwork', pokemonId),
  /** Small in-game sprite, best for lists. */
  sprite: (pokemonId: number, shiny = false) =>
    shiny ? `${SPRITES}/pokemon/shiny/${pokemonId}.png` : imageUri('sprite', pokemonId),
  /** 3D model render from Pokémon HOME. */
  home: (pokemonId: number, shiny = false) =>
    `${SPRITES}/pokemon/other/home/${shiny ? 'shiny/' : ''}${pokemonId}.png`,
  /** Bag icon for an item, by `items.identifier` (e.g. "master-ball"). */
  item: (itemIdentifier: string) => imageUri('item', itemIdentifier),
};
