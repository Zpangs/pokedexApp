import type { SQLiteDatabase } from 'expo-sqlite';

import {
  type GameData,
  loadMemberOptions,
  MAX_EV,
  MAX_IV,
  normalize,
  STAT_KEYS,
  STAT_LABELS,
  type StatKey,
  type TeamPokemon,
} from './queries/team-builder';
import { newMember, type Team, type TeamMember } from './teams';

/**
 * Pokémon Showdown's team text, the format players paste between team builders:
 *
 *   Nickname (Garchomp) @ Choice Scarf
 *   Ability: Rough Skin
 *   Level: 50
 *   Tera Type: Steel
 *   EVs: 252 Atk / 4 SpD / 252 Spe
 *   Jolly Nature
 *   - Earthquake
 */

/** "Ninetales-Alola", "Urshifu-Rapid-Strike", "Indeedee-F", "Nidoran-M". */
export function showdownName(p: TeamPokemon) {
  const species = p.speciesName.replace('♀', '-F').replace('♂', '-M');
  if (p.isDefault || !p.identifier.startsWith(`${p.speciesIdentifier}-`)) return species;
  const form = p.identifier
    .slice(p.speciesIdentifier.length + 1)
    .replace(/-breed$/, '')
    .replace(/^female$/, 'f')
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('-');
  return `${species}-${form}`;
}

const key = (text: string) => normalize(text).replace(/ /g, '');

export async function exportTeam(db: SQLiteDatabase, team: Team, data: GameData): Promise<string> {
  const blocks = await Promise.all(team.members.map((m) => exportMember(db, m, data)));
  return blocks.filter(Boolean).join('\n\n');
}

async function exportMember(db: SQLiteDatabase, m: TeamMember, data: GameData) {
  const pokemon = data.pokemonById.get(m.pokemonId);
  if (!pokemon) return '';
  const options = await loadMemberOptions(db, data, m.pokemonId);
  const { rules } = data;
  const species = showdownName(pokemon);
  const item = m.itemId ? data.itemById.get(m.itemId)?.name : undefined;
  const lines = [`${m.nickname ? `${m.nickname} (${species})` : species}${item ? ` @ ${item}` : ''}`];

  const ability = options.abilities.find((a) => a.id === m.abilityId);
  if (rules.abilities && ability) lines.push(`Ability: ${ability.name}`);
  if (m.level !== 100) lines.push(`Level: ${m.level}`);
  if (rules.dynamax && m.gigantamax && options.gigantamax) lines.push('Gigantamax: Yes');
  const tera = data.teraTypes.find((t) => t.id === m.teraTypeId);
  if (rules.tera && tera) lines.push(`Tera Type: ${tera.name}`);
  if (rules.spreads) {
    const evs = STAT_KEYS.filter((k) => m.evs[k] > 0).map((k) => `${m.evs[k]} ${STAT_LABELS[k]}`);
    if (evs.length) lines.push(`EVs: ${evs.join(' / ')}`);
  }
  const nature = data.natures.find((n) => n.id === m.natureId);
  if (rules.natures && nature) lines.push(`${nature.name} Nature`);
  if (rules.spreads) {
    const ivs = STAT_KEYS.filter((k) => m.ivs[k] !== MAX_IV).map((k) => `${m.ivs[k]} ${STAT_LABELS[k]}`);
    if (ivs.length) lines.push(`IVs: ${ivs.join(' / ')}`);
  }
  for (const id of m.moves) {
    const move = id ? options.moveById.get(id) : undefined;
    if (move) lines.push(`- ${move.name}`);
  }
  return lines.join('\n');
}

export type ImportResult = { members: TeamMember[]; problems: string[] };

/**
 * Reads Showdown text into team members for this game. Anything the game doesn't have (a
 * Pokémon, move, ability or item) is left out and listed in `problems`.
 */
export async function importTeam(db: SQLiteDatabase, text: string, data: GameData): Promise<ImportResult> {
  const pokemonByKey = new Map<string, TeamPokemon>();
  for (const p of data.pokemon) {
    for (const k of [showdownName(p), p.identifier, p.name]) {
      if (!pokemonByKey.has(key(k))) pokemonByKey.set(key(k), p);
    }
  }
  const itemByKey = new Map(data.items.map((i) => [key(i.name), i]));
  const natureByKey = new Map(data.natures.map((n) => [key(n.name), n]));
  const teraByKey = new Map(data.teraTypes.map((t) => [key(t.name), t]));

  const members: TeamMember[] = [];
  const problems: string[] = [];
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length > 0 && !b[0].startsWith('==='));

  for (const lines of blocks) {
    if (members.length >= 6) {
      problems.push('Only the first six Pokémon were kept.');
      break;
    }
    const [head, ...rest] = lines;
    const [left, itemName] = head.split(/\s+@\s+/);
    const named = left.replace(/\s+\((M|F)\)$/, '').match(/^(.*?)\s*\(([^()]+)\)$/);
    const nickname = named ? named[1] : null;
    let speciesName = named ? named[2] : left.replace(/\s+\((M|F)\)$/, '');
    // A team never holds the Mega itself: it's the base Pokémon with the stone
    speciesName = speciesName.replace(/-(Mega(-[XYZ])?|Primal|Gmax)$/i, '');
    const pokemon = pokemonByKey.get(key(speciesName));
    if (!pokemon) {
      problems.push(`${speciesName} isn't in ${data.game.name}.`);
      continue;
    }
    const options = await loadMemberOptions(db, data, pokemon.pokemonId);
    const member = newMember(pokemon.pokemonId, {
      nickname: nickname && key(nickname) !== key(pokemon.speciesName) ? nickname : null,
      abilityId: options.abilities[0]?.id ?? null,
      // Showdown leaves out "Level: 100"
      level: 100,
    });
    const where = nickname ?? pokemon.name;

    if (itemName && data.rules.heldItems) {
      const item = itemByKey.get(key(itemName));
      if (item) member.itemId = item.id;
      else problems.push(`${where}: ${itemName} isn't in ${data.game.name}.`);
    }
    const moves: number[] = [];
    for (const line of rest) {
      const [label, value = ''] = line.split(/:\s*/, 2);
      if (line.startsWith('-')) {
        // "- Hidden Power [Fire]" and "- Move / Alternative": the first choice counts
        const name = line.slice(1).split('/')[0].replace(/\[.*\]/, '').trim();
        const move = options.moves.find((mv) => key(mv.name) === key(name));
        if (move && moves.length < 4) moves.push(move.id);
        else if (!move) problems.push(`${where} can't learn ${name} in ${data.game.name}.`);
      } else if (/ Nature$/.test(line)) {
        const nature = natureByKey.get(key(line.replace(/ Nature$/, '')));
        if (nature) member.natureId = nature.id;
      } else if (label === 'Ability' && data.rules.abilities) {
        const ability = options.abilities.find((a) => key(a.name) === key(value));
        if (ability) member.abilityId = ability.id;
        else problems.push(`${where} can't have ${value} in ${data.game.name}.`);
      } else if (label === 'Level') {
        const level = Number(value);
        if (level >= 1 && level <= 100) member.level = Math.round(level);
      } else if (label === 'Tera Type' && data.rules.tera) {
        const tera = teraByKey.get(key(value));
        if (tera) member.teraTypeId = tera.id;
      } else if (label === 'Gigantamax' && data.rules.dynamax) {
        member.gigantamax = /^yes$/i.test(value) && options.gigantamax !== null;
      } else if ((label === 'EVs' || label === 'IVs') && data.rules.spreads) {
        const target = label === 'EVs' ? member.evs : member.ivs;
        const max = label === 'EVs' ? MAX_EV : MAX_IV;
        for (const part of value.split('/')) {
          const [n, stat] = part.trim().split(/\s+/);
          const k = (Object.keys(STAT_LABELS) as StatKey[]).find(
            (s) => STAT_LABELS[s].toLowerCase() === stat?.toLowerCase()
          );
          if (k && Number.isFinite(Number(n))) target[k] = Math.max(0, Math.min(max, Math.round(Number(n))));
        }
      }
    }
    member.moves = [...moves, null, null, null, null].slice(0, 4);
    members.push(member);
  }
  return { members, problems };
}
