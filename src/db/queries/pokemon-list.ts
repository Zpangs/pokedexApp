import type { DexType } from './national-dex';

/** A Pokémon (or form) as shown in a list row on a move, ability or item page. */
export type ListedPokemon = {
  /** National Dex number. */
  number: number;
  pokemonId: number;
  /** "Gyarados", or a form's own name ("Mega Manectric"). */
  name: string;
  types: DexType[];
};

export type PokemonListRow = {
  number: number;
  pokemon_id: number;
  is_default: number;
  form: string | null;
  name: string;
  type1: string;
  type1_name: string;
  type2: string | null;
  type2_name: string | null;
};

/**
 * Columns for `PokemonListRow`, from a Pokémon aliased `p` joined with `POKEMON_JOINS`.
 * Forms go by their own name ("Alolan Raichu").
 */
export const POKEMON_COLUMNS = `
  p.species_id AS number, p.id AS pokemon_id, p.is_default, f.form_identifier AS form,
  COALESCE(CASE WHEN p.is_default = 0 THEN fn.pokemon_name END, sn.name) AS name,
  t1.identifier AS type1, tn1.name AS type1_name, t2.identifier AS type2, tn2.name AS type2_name`;

export const POKEMON_JOINS = `
  JOIN pokemon_species_names sn ON sn.pokemon_species_id = p.species_id
  LEFT JOIN pokemon_forms f ON f.pokemon_id = p.id AND f.is_default = 1
  LEFT JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id
  JOIN pokemon_types pt1 ON pt1.pokemon_id = p.id AND pt1.slot = 1
  JOIN types t1 ON t1.id = pt1.type_id
  JOIN type_names tn1 ON tn1.type_id = t1.id
  LEFT JOIN pokemon_types pt2 ON pt2.pokemon_id = p.id AND pt2.slot = 2
  LEFT JOIN types t2 ON t2.id = pt2.type_id
  LEFT JOIN type_names tn2 ON tn2.type_id = t2.id`;

export function toListedPokemon(r: PokemonListRow): ListedPokemon {
  return {
    number: r.number,
    pokemonId: r.pokemon_id,
    name: r.name,
    types: [
      { identifier: r.type1, name: r.type1_name },
      ...(r.type2 && r.type2_name ? [{ identifier: r.type2, name: r.type2_name }] : []),
    ],
  };
}
