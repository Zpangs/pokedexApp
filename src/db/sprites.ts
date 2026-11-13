/**
 * Image URLs from the PokeAPI/sprites repo. Images aren't stored in the database: they're loaded
 * on demand and cached on the device by expo-image.
 *
 * `pokemonId` is `pokemon.id` (not the species id), so alternate forms get their own artwork.
 */
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';

export const sprites = {
  /** Large official artwork, best for detail screens. */
  artwork: (pokemonId: number, shiny = false) =>
    `${SPRITES}/pokemon/other/official-artwork/${shiny ? 'shiny/' : ''}${pokemonId}.png`,
  /** Small in-game sprite, best for lists. */
  sprite: (pokemonId: number, shiny = false) =>
    `${SPRITES}/pokemon/${shiny ? 'shiny/' : ''}${pokemonId}.png`,
  /** 3D model render from Pokémon HOME. */
  home: (pokemonId: number, shiny = false) =>
    `${SPRITES}/pokemon/other/home/${shiny ? 'shiny/' : ''}${pokemonId}.png`,
  /** Bag icon for an item, by `items.identifier` (e.g. "master-ball"). */
  item: (itemIdentifier: string) => `${SPRITES}/items/${itemIdentifier}.png`,
};
