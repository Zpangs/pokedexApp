import type { StatSpread } from './queries/team-builder';
import type { TypeChart } from './queries/types';

/**
 * Pokémon damage, the way the games work it out, after Smogon's damage calculator: Gen I–II,
 * Gen III–IV and Gen V onward each have their own formula and order of rounding. Covers the
 * abilities, items, field effects and moves that change damage most often; anything that
 * depends on how the battle went (Counter, Beat Up…) isn't calculated.
 */

export type Weather = 'none' | 'sun' | 'rain' | 'sand' | 'hail' | 'snow';
export type Terrain = 'none' | 'electric' | 'grassy' | 'psychic' | 'misty';
export type Status = 'none' | 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz';
export type BoostKey = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type Boosts = Record<BoostKey, number>;

export const NO_BOOSTS: Boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** PokéAPI type ids. */
export const T = {
  normal: 1,
  fighting: 2,
  flying: 3,
  poison: 4,
  ground: 5,
  rock: 6,
  bug: 7,
  ghost: 8,
  steel: 9,
  fire: 10,
  water: 11,
  grass: 12,
  electric: 13,
  psychic: 14,
  ice: 15,
  dragon: 16,
  dark: 17,
  fairy: 18,
  stellar: 19,
} as const;

export type Combatant = {
  name: string;
  /** Species identifier ("marowak"), for the items only some species can use. */
  species: string;
  level: number;
  /** Its own types (a Mega's when Mega Evolved). */
  types: number[];
  /** The Tera type, only while Terastallized. */
  tera: number | null;
  /** Stats at this level, before stat stages. */
  stats: StatSpread;
  boosts: Boosts;
  ability: string | null;
  abilityName: string | null;
  item: string | null;
  status: Status;
  /** Current HP. */
  hp: number;
  weightKg: number;
  /** Not fully evolved (Eviolite). */
  nfe: boolean;
};

export type DamageMove = {
  identifier: string;
  name: string;
  typeId: number;
  category: 'Physical' | 'Special';
  power: number | null;
  flags: Set<string>;
  minHits: number;
  maxHits: number;
  /** Hits both opponents in a double battle. */
  spread: boolean;
  /** Has a chance of a side effect on the target (Sheer Force). */
  secondary: boolean;
  recoil: boolean;
};

export type Field = {
  gen: number;
  doubles: boolean;
  weather: Weather;
  terrain: Terrain;
  crit: boolean;
  /** Reflect or Light Screen (whichever the move's category meets) on the target's side. */
  screen: boolean;
  helpingHand: boolean;
  /** Hits chosen for a move that hits 2–5 times. */
  hits: number;
};

export type DamageResult = {
  /** Each hit's possible damage, every value equally likely. */
  hitRolls: number[][];
  typeId: number;
  category: 'Physical' | 'Special';
  /** Power after variable-power moves are worked out (Low Kick…), before modifiers. */
  power: number | null;
  effectiveness: number;
  /** Why it does nothing (or isn't calculated). */
  none: string | null;
  notes: string[];
};

// ── Small helpers ─────────────────────────────────────────────────────────────────────────

/** Rounds half down, as the games do with their 4096ths. */
const pokeRound = (n: number) => (n % 1 > 0.5 ? Math.ceil(n) : Math.floor(n));

/** Multiplies 4096ths together the way the games do. */
function chain(mods: number[]) {
  let m = 4096;
  for (const mod of mods) if (mod !== 4096) m = (m * mod + 2048) >> 12;
  return m;
}
const applyMod = (value: number, mods: number[]) => pokeRound((value * chain(mods)) / 4096);

const GEN12_STAGES = [25, 28, 33, 40, 50, 66, 100, 150, 200, 250, 300, 350, 400];

function boosted(stat: number, stage: number, gen: number) {
  if (stage === 0) return stat;
  if (gen <= 2) return Math.floor((stat * GEN12_STAGES[stage + 6]) / 100);
  return stage > 0 ? Math.floor((stat * (2 + stage)) / 2) : Math.floor((stat * 2) / (2 - stage));
}

/** Types it has in battle: a Tera type replaces them (Stellar keeps the old ones). */
const battleTypes = (c: Combatant) => (c.tera && c.tera !== T.stellar ? [c.tera] : c.types);
const isType = (c: Combatant, type: number) => battleTypes(c).includes(type);
const statused = (c: Combatant) => c.status !== 'none';

function grounded(c: Combatant, ability: string | null) {
  return !isType(c, T.flying) && ability !== 'levitate' && c.item !== 'air-balloon';
}

const MOLD_BREAKERS = new Set(['mold-breaker', 'teravolt', 'turboblaze']);

const TYPE_ITEMS: Record<string, number> = {
  'silk-scarf': T.normal,
  'black-belt': T.fighting,
  'fist-plate': T.fighting,
  'sharp-beak': T.flying,
  'sky-plate': T.flying,
  'poison-barb': T.poison,
  'toxic-plate': T.poison,
  'soft-sand': T.ground,
  'earth-plate': T.ground,
  'hard-stone': T.rock,
  'stone-plate': T.rock,
  'rock-incense': T.rock,
  'silver-powder': T.bug,
  'insect-plate': T.bug,
  'spell-tag': T.ghost,
  'spooky-plate': T.ghost,
  'metal-coat': T.steel,
  'iron-plate': T.steel,
  charcoal: T.fire,
  'flame-plate': T.fire,
  'mystic-water': T.water,
  'splash-plate': T.water,
  'sea-incense': T.water,
  'wave-incense': T.water,
  'miracle-seed': T.grass,
  'meadow-plate': T.grass,
  'rose-incense': T.grass,
  magnet: T.electric,
  'zap-plate': T.electric,
  'twisted-spoon': T.psychic,
  'mind-plate': T.psychic,
  'odd-incense': T.psychic,
  'never-melt-ice': T.ice,
  'icicle-plate': T.ice,
  'dragon-fang': T.dragon,
  'draco-plate': T.dragon,
  'black-glasses': T.dark,
  'dread-plate': T.dark,
  'pixie-plate': T.fairy,
  'fairy-feather': T.fairy,
};

const RESIST_BERRIES: Record<string, number> = {
  'occa-berry': T.fire,
  'passho-berry': T.water,
  'wacan-berry': T.electric,
  'rindo-berry': T.grass,
  'yache-berry': T.ice,
  'chople-berry': T.fighting,
  'kebia-berry': T.poison,
  'shuca-berry': T.ground,
  'coba-berry': T.flying,
  'payapa-berry': T.psychic,
  'tanga-berry': T.bug,
  'charti-berry': T.rock,
  'kasib-berry': T.ghost,
  'haban-berry': T.dragon,
  'colbur-berry': T.dark,
  'babiri-berry': T.steel,
  'roseli-berry': T.fairy,
  'chilan-berry': T.normal,
};

const GEM_TYPES: Record<string, number> = Object.fromEntries(
  Object.entries(T).map(([name, id]) => [`${name}-gem`, id])
);

/** Legendary items that power up their owner's moves of two types. */
const ORBS: Record<string, { species: string[]; types: number[] }> = {
  'adamant-orb': { species: ['dialga'], types: [T.steel, T.dragon] },
  'adamant-crystal': { species: ['dialga'], types: [T.steel, T.dragon] },
  'lustrous-orb': { species: ['palkia'], types: [T.water, T.dragon] },
  'lustrous-globe': { species: ['palkia'], types: [T.water, T.dragon] },
  'griseous-orb': { species: ['giratina'], types: [T.ghost, T.dragon] },
  'griseous-core': { species: ['giratina'], types: [T.ghost, T.dragon] },
  'soul-dew': { species: ['latios', 'latias'], types: [T.dragon, T.psychic] },
};

const ATE: Record<string, number> = {
  pixilate: T.fairy,
  aerilate: T.flying,
  refrigerate: T.ice,
  galvanize: T.electric,
};

const PINCH: Record<string, number> = { overgrow: T.grass, blaze: T.fire, torrent: T.water, swarm: T.bug };

/** Moves whose damage hangs on the battle so far; not worked out. */
const UNCALCULATED = new Set([
  'counter',
  'mirror-coat',
  'metal-burst',
  'comeuppance',
  'bide',
  'present',
  'beat-up',
  'spit-up',
  'natural-gift',
  'fling',
  'trump-card',
  'magnitude',
  'psywave',
  'last-respects',
  'rage-fist',
]);

const OHKO_MOVES = new Set(['guillotine', 'horn-drill', 'fissure', 'sheer-cold']);

// ── The calculation ───────────────────────────────────────────────────────────────────────

export function calculate(
  chart: TypeChart,
  attacker: Combatant,
  defender: Combatant,
  move: DamageMove,
  field: Field
): DamageResult {
  const { gen } = field;
  const notes: string[] = [];
  const moldBreaker = gen >= 4 && attacker.ability !== null && MOLD_BREAKERS.has(attacker.ability);
  const attAbility = gen >= 3 ? attacker.ability : null;
  const defAbility = gen >= 3 && !moldBreaker ? defender.ability : null;
  const attItem = gen >= 2 ? attacker.item : null;
  const defItem = gen >= 2 ? defender.item : null;

  // ── Type and category ──
  let typeId = move.typeId;
  let category = move.category;
  let ateBoost = false;
  const id = move.identifier;
  if (id === 'weather-ball' && field.weather !== 'none') {
    typeId = { sun: T.fire, rain: T.water, sand: T.rock, hail: T.ice, snow: T.ice }[field.weather];
  }
  if (id === 'terrain-pulse' && field.terrain !== 'none' && grounded(attacker, attAbility)) {
    typeId = { electric: T.electric, grassy: T.grass, psychic: T.psychic, misty: T.fairy }[field.terrain];
  }
  if (id === 'tera-blast' && attacker.tera) {
    if (attacker.tera !== T.stellar) typeId = attacker.tera;
    const atk = boosted(attacker.stats.atk, attacker.boosts.atk, gen);
    const spa = boosted(attacker.stats.spa, attacker.boosts.spa, gen);
    if (atk > spa) category = 'Physical';
  }
  if (id === 'revelation-dance') typeId = battleTypes(attacker)[0];
  if (attAbility === 'normalize') {
    typeId = T.normal;
    ateBoost = gen >= 7;
  } else if (attAbility && ATE[attAbility] && typeId === T.normal && !['weather-ball', 'terrain-pulse', 'tera-blast'].includes(id)) {
    typeId = ATE[attAbility];
    ateBoost = true;
  } else if (attAbility === 'liquid-voice' && move.flags.has('sound')) {
    typeId = T.water;
  }

  const physical = category === 'Physical';
  const defTypes = battleTypes(defender);
  const result = (none: string | null, hitRolls: number[][] = [], effectiveness = 1, power: number | null = null) => ({
    hitRolls,
    typeId,
    category,
    power,
    effectiveness,
    none,
    notes,
  });

  // ── Effectiveness and immunities ──
  const factorOf = (attackType: number, d: number) => {
    let f = chart.get(attackType)?.get(d) ?? 1;
    if (f === 0 && d === T.ghost && (attackType === T.normal || attackType === T.fighting)) {
      if (attAbility === 'scrappy' || attAbility === 'minds-eye') f = 1;
    }
    if (d === T.flying && attackType === T.ground && id === 'thousand-arrows') f = 1;
    if (d === T.water && id === 'freeze-dry') f = 2;
    return f;
  };
  const effOf = (attackType: number) => defTypes.reduce((m, d) => m * factorOf(attackType, d), 1);
  let effectiveness = effOf(typeId);
  if (id === 'flying-press') effectiveness *= effOf(T.flying);

  if (UNCALCULATED.has(id) || (move.power === null && id.includes('--'))) {
    return result('Its damage depends on how the battle has gone, so it isn’t worked out here.');
  }
  if (effectiveness === 0) return result(`${defender.name} isn’t affected by ${typeName(typeId)}-type moves.`, [], 0);

  const immunity = abilityImmunity(defAbility, typeId, move, effectiveness, gen, id);
  if (immunity) return result(`${defender.name}’s ${defender.abilityName ?? 'ability'} makes it immune.`, [], 0);
  if (defItem === 'air-balloon' && typeId === T.ground && id !== 'thousand-arrows' && gen >= 5) {
    return result(`${defender.name}’s Air Balloon keeps it off the ground.`, [], 0);
  }

  // ── Fixed damage ──
  const fixed = fixedDamage(id, attacker, defender);
  if (fixed !== null) return result(null, [[fixed]], effectiveness);
  if (OHKO_MOVES.has(id)) {
    if (defAbility === 'sturdy') return result(`${defender.name}’s Sturdy blocks one-hit KO moves.`, [], 0);
    if (defender.level > attacker.level) return result('One-hit KO moves fail on a higher-level target.', [], 0);
    notes.push('A one-hit KO move: it knocks out if it hits.');
    return result(null, [[defender.hp]], effectiveness);
  }

  // ── Power ──
  let power = basePower(move, attacker, defender, field, attItem, defItem);
  if (power === null || power <= 0) return result('This move doesn’t deal damage directly.');

  const hits = move.maxHits > 1 ? (attAbility === 'skill-link' ? move.maxHits : Math.min(move.maxHits, Math.max(move.minHits, field.hits))) : 1;
  const ctx: Ctx = {
    gen,
    field,
    attacker,
    defender,
    move,
    typeId,
    category,
    physical,
    effectiveness,
    factor: (d: number) => factorOf(typeId, d),
    ateBoost,
    attAbility,
    defAbility,
    attItem,
    defItem,
    notes,
  };
  const hitRolls: number[][] = [];
  for (let h = 0; h < hits; h++) {
    // Triple Kick and Triple Axel hit harder each time
    const hitPower = id === 'triple-axel' || id === 'triple-kick' ? power * (h + 1) : power;
    hitRolls.push(gen <= 2 ? damageGen12(ctx, hitPower) : gen <= 4 ? damageGen34(ctx, hitPower) : damageGen5on(ctx, hitPower));
  }
  if (gen >= 5 && defAbility && ['multiscale', 'shadow-shield'].includes(defAbility) && hits > 1) {
    notes.push(`${defender.abilityName} is counted on every hit, though it only softens the first.`);
  }
  return result(null, hitRolls, effectiveness, power);
}

type Ctx = {
  gen: number;
  field: Field;
  attacker: Combatant;
  defender: Combatant;
  move: DamageMove;
  typeId: number;
  category: 'Physical' | 'Special';
  physical: boolean;
  effectiveness: number;
  /** The multiplier against one of the target's types. */
  factor: (defType: number) => number;
  ateBoost: boolean;
  attAbility: string | null;
  defAbility: string | null;
  attItem: string | null;
  defItem: string | null;
  notes: string[];
};

function abilityImmunity(
  ability: string | null,
  typeId: number,
  move: DamageMove,
  effectiveness: number,
  gen: number,
  id: string
) {
  switch (ability) {
    case 'levitate':
      return typeId === T.ground && id !== 'thousand-arrows';
    case 'flash-fire':
    case 'well-baked-body':
      return typeId === T.fire;
    case 'water-absorb':
    case 'dry-skin':
      return typeId === T.water;
    case 'storm-drain':
      return typeId === T.water && gen >= 5;
    case 'volt-absorb':
    case 'motor-drive':
      return typeId === T.electric;
    case 'lightning-rod':
      return typeId === T.electric && gen >= 5;
    case 'sap-sipper':
      return typeId === T.grass;
    case 'earth-eater':
      return typeId === T.ground;
    case 'wonder-guard':
      return effectiveness <= 1;
    case 'soundproof':
      return move.flags.has('sound');
    case 'bulletproof':
      return move.flags.has('ballistics');
    default:
      return false;
  }
}

function fixedDamage(id: string, attacker: Combatant, defender: Combatant) {
  switch (id) {
    case 'seismic-toss':
    case 'night-shade':
      return attacker.level;
    case 'dragon-rage':
      return 40;
    case 'sonic-boom':
      return 20;
    case 'super-fang':
    case 'natures-madness':
    case 'ruination':
      return Math.max(1, Math.floor(defender.hp / 2));
    case 'final-gambit':
      return attacker.hp;
    case 'endeavor':
      return Math.max(0, defender.hp - attacker.hp);
    default:
      return null;
  }
}

/** The move's power in this situation, before abilities and items. */
function basePower(
  move: DamageMove,
  attacker: Combatant,
  defender: Combatant,
  field: Field,
  attItem: string | null,
  defItem: string | null
): number | null {
  const id = move.identifier;
  const { gen } = field;
  const hpRatio = (c: Combatant) => c.hp / c.stats.hp;
  const speed = (c: Combatant) => Math.max(1, boosted(c.stats.spe, c.boosts.spe, gen) / (c.status === 'par' ? (gen >= 7 ? 2 : 4) : 1));
  let power = move.power;

  if (power === null) {
    switch (id) {
      case 'low-kick':
      case 'grass-knot': {
        const w = defender.weightKg;
        power = w >= 200 ? 120 : w >= 100 ? 100 : w >= 50 ? 80 : w >= 25 ? 60 : w >= 10 ? 40 : 20;
        break;
      }
      case 'heavy-slam':
      case 'heat-crash': {
        const r = attacker.weightKg / Math.max(0.1, defender.weightKg);
        power = r >= 5 ? 120 : r >= 4 ? 100 : r >= 3 ? 80 : r >= 2 ? 60 : 40;
        break;
      }
      case 'gyro-ball':
        power = Math.min(150, Math.floor((25 * speed(defender)) / speed(attacker)) + 1);
        break;
      case 'electro-ball': {
        const r = Math.floor(speed(attacker) / speed(defender));
        power = r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40;
        break;
      }
      case 'flail':
      case 'reversal': {
        const p = Math.floor((48 * attacker.hp) / attacker.stats.hp);
        power = p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20;
        break;
      }
      case 'return':
      case 'frustration':
        power = 102;
        break;
      case 'crush-grip':
      case 'wring-out':
        power = Math.max(1, Math.floor(120 * hpRatio(defender)) + (gen <= 4 ? 1 : 0));
        break;
      case 'punishment': {
        const up = Object.values(defender.boosts).reduce((s, b) => s + Math.max(0, b), 0);
        power = Math.min(200, 60 + 20 * up);
        break;
      }
      default:
        return null;
    }
  }

  switch (id) {
    case 'eruption':
    case 'water-spout':
    case 'dragon-energy':
      power = Math.max(1, Math.floor(150 * hpRatio(attacker)));
      break;
    case 'hard-press':
      power = Math.max(1, Math.floor(100 * hpRatio(defender)));
      break;
    case 'stored-power':
    case 'power-trip':
      power = 20 + 20 * Object.values(attacker.boosts).reduce((s, b) => s + Math.max(0, b), 0);
      break;
    case 'facade':
      if (['brn', 'par', 'psn', 'tox'].includes(attacker.status)) power *= 2;
      break;
    case 'hex':
      if (statused(defender)) power *= 2;
      break;
    case 'venoshock':
      if (defender.status === 'psn' || defender.status === 'tox') power *= 2;
      break;
    case 'smelling-salts':
      if (defender.status === 'par') power *= 2;
      break;
    case 'wake-up-slap':
      if (defender.status === 'slp') power *= 2;
      break;
    case 'brine':
      if (defender.hp <= defender.stats.hp / 2) power *= 2;
      break;
    case 'acrobatics':
      if (!attItem) power *= 2;
      break;
    case 'knock-off':
      if (gen >= 6 && defItem) power = Math.floor(power * 1.5);
      break;
    case 'weather-ball':
      if (field.weather !== 'none') power *= 2;
      break;
    case 'terrain-pulse':
      if (field.terrain !== 'none' && grounded(attacker, attacker.ability)) power *= 2;
      break;
    case 'rising-voltage':
      if (field.terrain === 'electric' && grounded(defender, defender.ability)) power *= 2;
      break;
    case 'expanding-force':
      if (field.terrain === 'psychic' && grounded(attacker, attacker.ability)) power = Math.floor(power * 1.5);
      break;
    case 'psyblade':
      if (field.terrain === 'electric') power = Math.floor(power * 1.5);
      break;
    case 'solar-beam':
    case 'solar-blade':
      if (['rain', 'sand', 'hail', 'snow'].includes(field.weather)) power = Math.floor(power / 2);
      break;
  }
  return power;
}

// ── Gen V onward ──────────────────────────────────────────────────────────────────────────

function damageGen5on(c: Ctx, power: number): number[] {
  const { gen, field, attacker, defender, move, typeId, physical, effectiveness, attAbility, defAbility, attItem, defItem } = c;
  const id = move.identifier;

  // Power
  if (attacker.tera && attacker.tera === typeId && power < 60 && move.maxHits <= 1 && gen >= 9) power = 60;
  const bp: number[] = [];
  if (attAbility === 'technician' && power <= 60) bp.push(6144);
  if (c.ateBoost) bp.push(gen >= 7 ? 4915 : 5325);
  if (attAbility === 'iron-fist' && move.flags.has('punch')) bp.push(4915);
  if (attAbility === 'strong-jaw' && move.flags.has('bite')) bp.push(6144);
  if (attAbility === 'mega-launcher' && move.flags.has('pulse')) bp.push(6144);
  if (attAbility === 'tough-claws' && move.flags.has('contact')) bp.push(5325);
  if (attAbility === 'reckless' && move.recoil) bp.push(4915);
  if (attAbility === 'sheer-force' && move.secondary) bp.push(5325);
  if (attAbility === 'punk-rock' && move.flags.has('sound')) bp.push(5325);
  if (attAbility === 'sand-force' && field.weather === 'sand' && ([T.rock, T.ground, T.steel] as number[]).includes(typeId)) bp.push(5325);
  if (attAbility === 'toxic-boost' && physical && (attacker.status === 'psn' || attacker.status === 'tox')) bp.push(6144);
  if (attAbility === 'flare-boost' && !physical && attacker.status === 'brn') bp.push(6144);
  if (defAbility === 'heatproof' && typeId === T.fire) bp.push(2048);
  if (defAbility === 'dry-skin' && typeId === T.fire) bp.push(5120);
  if (attItem && TYPE_ITEMS[attItem] === typeId) bp.push(4915);
  if (attItem && GEM_TYPES[attItem] === typeId) bp.push(gen >= 6 ? 5325 : 6144);
  if (attItem === 'muscle-band' && physical) bp.push(4505);
  if (attItem === 'wise-glasses' && !physical) bp.push(4505);
  if (attItem === 'punching-glove' && move.flags.has('punch')) bp.push(4506);
  const orb = attItem ? ORBS[attItem] : undefined;
  if (orb && orb.species.includes(attacker.species) && orb.types.includes(typeId) && (attItem !== 'soul-dew' || gen >= 7)) {
    bp.push(4915);
  }
  if (field.helpingHand && field.doubles) bp.push(6144);
  const terrainBoost = gen >= 8 ? 5325 : 6144;
  if (grounded(attacker, attAbility)) {
    if (field.terrain === 'electric' && typeId === T.electric) bp.push(terrainBoost);
    if (field.terrain === 'grassy' && typeId === T.grass) bp.push(terrainBoost);
    if (field.terrain === 'psychic' && typeId === T.psychic) bp.push(terrainBoost);
  }
  if (grounded(defender, defAbility)) {
    if (field.terrain === 'misty' && typeId === T.dragon) bp.push(2048);
    if (field.terrain === 'grassy' && ['earthquake', 'bulldoze', 'magnitude'].includes(id)) bp.push(2048);
  }
  const finalPower = Math.max(1, applyMod(power, bp));

  // Attack and defense
  const { attack, defense } = stats(c, (stat, key, side) => {
    const mods: number[] = [];
    if (side === 'attack') {
      if (key === 'atk' && (attAbility === 'huge-power' || attAbility === 'pure-power')) mods.push(8192);
      if (key === 'atk' && attItem === 'choice-band') mods.push(6144);
      if (key === 'spa' && attItem === 'choice-specs') mods.push(6144);
      if (physical && attAbility === 'guts' && statused(attacker)) mods.push(6144);
      if (physical && attAbility === 'hustle') mods.push(6144);
      if (physical && attAbility === 'gorilla-tactics') mods.push(6144);
      if (!physical && attAbility === 'solar-power' && field.weather === 'sun') mods.push(6144);
      if (attAbility && PINCH[attAbility] === typeId && attacker.hp <= attacker.stats.hp / 3) mods.push(6144);
      if (attAbility === 'defeatist' && attacker.hp <= attacker.stats.hp / 2) mods.push(2048);
      if (attAbility === 'steelworker' && typeId === T.steel) mods.push(6144);
      if (attAbility === 'transistor' && typeId === T.electric) mods.push(gen >= 9 ? 5325 : 6144);
      if (attAbility === 'dragons-maw' && typeId === T.dragon) mods.push(6144);
      if (attAbility === 'rocky-payload' && typeId === T.rock) mods.push(6144);
      if (attAbility === 'water-bubble' && typeId === T.water) mods.push(8192);
      if (attAbility === 'orichalcum-pulse' && physical && field.weather === 'sun') mods.push(5461);
      if (attAbility === 'hadron-engine' && !physical && field.terrain === 'electric') mods.push(5461);
      if (attItem === 'light-ball' && attacker.species === 'pikachu') mods.push(8192);
      if (attItem === 'thick-club' && key === 'atk' && ['cubone', 'marowak'].includes(attacker.species)) mods.push(8192);
      if (attItem === 'deep-sea-tooth' && key === 'spa' && attacker.species === 'clamperl') mods.push(8192);
      if (defAbility === 'thick-fat' && (typeId === T.fire || typeId === T.ice)) mods.push(2048);
      if (defAbility === 'water-bubble' && typeId === T.fire) mods.push(2048);
      if (defAbility === 'purifying-salt' && typeId === T.ghost) mods.push(2048);
    } else {
      if (defItem === 'eviolite' && defender.nfe) mods.push(6144);
      if (defItem === 'assault-vest' && key === 'spd') mods.push(6144);
      if (defAbility === 'fur-coat' && key === 'def') mods.push(8192);
      if (defAbility === 'marvel-scale' && key === 'def' && statused(defender)) mods.push(6144);
      if (defAbility === 'grass-pelt' && key === 'def' && field.terrain === 'grassy') mods.push(6144);
      if (defItem === 'deep-sea-scale' && key === 'spd' && defender.species === 'clamperl') mods.push(8192);
    }
    return Math.max(1, applyMod(stat, mods));
  });

  // Damage
  let base = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * finalPower * attack) / defense) / 50) + 2;
  if (field.doubles && move.spread) base = pokeRound((base * 3072) / 4096);
  const weatherMod = weatherFactor(field.weather, typeId);
  if (weatherMod !== 1) base = pokeRound((base * weatherMod * 4096) / 4096);
  if (field.crit) base = Math.floor(base * (gen >= 6 ? 1.5 : 2));

  const stab = stabMod(attacker, typeId, attAbility);
  const burned = physical && attacker.status === 'brn' && attAbility !== 'guts' && !(id === 'facade' && gen >= 6);

  const fin: number[] = [];
  if (field.screen && !field.crit && attAbility !== 'infiltrator') fin.push(field.doubles ? 2732 : 2048);
  if (attAbility === 'neuroforce' && effectiveness > 1) fin.push(5120);
  if (attAbility === 'sniper' && field.crit) fin.push(6144);
  if (attAbility === 'tinted-lens' && effectiveness < 1) fin.push(8192);
  if ((defAbility === 'multiscale' || defender.ability === 'shadow-shield') && defender.hp === defender.stats.hp) fin.push(2048);
  if (defAbility === 'fluffy' && move.flags.has('contact') && typeId !== T.fire) fin.push(2048);
  if (defAbility === 'fluffy' && typeId === T.fire && !move.flags.has('contact')) fin.push(8192);
  if (defAbility === 'punk-rock' && move.flags.has('sound')) fin.push(2048);
  if (defAbility === 'ice-scales' && !physical) fin.push(2048);
  if ((defAbility === 'filter' || defAbility === 'solid-rock' || defender.ability === 'prism-armor') && effectiveness > 1) fin.push(3072);
  if (attItem === 'expert-belt' && effectiveness > 1) fin.push(4915);
  if (attItem === 'life-orb') fin.push(5324);
  if (defItem && RESIST_BERRIES[defItem] === typeId && (effectiveness > 1 || defItem === 'chilan-berry') && attAbility !== 'unnerve') {
    fin.push(2048);
  }
  if ((id === 'collision-course' || id === 'electro-drift') && effectiveness > 1) fin.push(5461);
  const finalMod = chain(fin);

  const rolls: number[] = [];
  for (let r = 85; r <= 100; r++) {
    let d = Math.floor((base * r) / 100);
    if (stab !== 4096) d = (d * stab) / 4096;
    d = Math.floor(pokeRound(d) * effectiveness);
    if (burned) d = Math.floor(d / 2);
    rolls.push(pokeRound(Math.max(1, (d * finalMod) / 4096)) % 65536);
  }
  return rolls;
}

function stabMod(attacker: Combatant, typeId: number, ability: string | null) {
  const own = attacker.types.includes(typeId);
  if (attacker.tera === T.stellar) return own ? 8192 : 4915;
  let stab = own ? 6144 : 4096;
  if (attacker.tera && attacker.tera === typeId) stab = own ? 8192 : 6144;
  if (ability === 'adaptability' && stab > 4096) stab = stab === 8192 ? 9216 : 8192;
  return stab;
}

function weatherFactor(weather: Weather, typeId: number) {
  if (weather === 'sun') return typeId === T.fire ? 1.5 : typeId === T.water ? 0.5 : 1;
  if (weather === 'rain') return typeId === T.water ? 1.5 : typeId === T.fire ? 0.5 : 1;
  return 1;
}

type StatSide = 'attack' | 'defense';

/**
 * The attacking and defending stats with their stages: a critical hit ignores the attacker's
 * drops and the target's raises, Unaware ignores the other side's stages. `modify` applies the
 * generation's ability and item modifiers.
 */
function stats(c: Ctx, modify: (stat: number, key: keyof StatSpread, side: StatSide) => number) {
  const { gen, field, attacker, defender, move, physical, attAbility, defAbility } = c;
  const id = move.identifier;
  const special = gen === 1 ? 'spa' : 'spd';
  const attackKey: keyof StatSpread = id === 'body-press' ? 'def' : physical ? 'atk' : 'spa';
  const defenseKey: keyof StatSpread =
    physical || ['psyshock', 'psystrike', 'secret-sword'].includes(id) ? 'def' : special;
  const source = id === 'foul-play' ? defender : attacker;

  let attackStage = source.boosts[attackKey as BoostKey] ?? 0;
  let defenseStage = defender.boosts[defenseKey as BoostKey] ?? 0;
  if (defAbility === 'unaware') attackStage = 0;
  if (attAbility === 'unaware' || ['chip-away', 'sacred-sword', 'darkest-lariat'].includes(id)) defenseStage = 0;
  if (field.crit) {
    if (gen === 1) {
      attackStage = 0;
      defenseStage = 0;
    } else if (gen === 2) {
      if (attackStage <= defenseStage) {
        attackStage = 0;
        defenseStage = 0;
      }
    } else {
      attackStage = Math.max(0, attackStage);
      defenseStage = Math.min(0, defenseStage);
    }
  }
  let attack = boosted(source.stats[attackKey], attackStage, gen);
  let defense = boosted(defender.stats[defenseKey], defenseStage, gen);
  if (gen >= 4 && field.weather === 'sand' && isType(defender, T.rock) && defenseKey === 'spd') {
    defense = gen >= 5 ? pokeRound((defense * 3) / 2) : Math.floor(defense * 1.5);
  }
  if (gen >= 9 && field.weather === 'snow' && isType(defender, T.ice) && defenseKey === 'def') {
    defense = pokeRound((defense * 3) / 2);
  }
  if (gen <= 4 && (id === 'explosion' || id === 'self-destruct')) defense = Math.max(1, Math.floor(defense / 2));
  attack = modify(attack, attackKey, 'attack');
  defense = modify(defense, defenseKey, 'defense');
  return { attack, defense };
}

// ── Gen III–IV ────────────────────────────────────────────────────────────────────────────

function damageGen34(c: Ctx, power: number): number[] {
  const { gen, field, attacker, defender, move, typeId, physical, effectiveness, attAbility, defAbility, attItem, defItem } = c;
  const mul = (v: number, m: number) => Math.floor(v * m);

  // Power (Gen IV puts most boosts here; Gen III applies items to the stat)
  if (gen === 4) {
    if (attAbility === 'technician' && power <= 60) power = mul(power, 1.5);
    if (attAbility === 'iron-fist' && move.flags.has('punch')) power = mul(power, 1.2);
    if (attAbility === 'reckless' && move.recoil) power = mul(power, 1.2);
    if (attItem && TYPE_ITEMS[attItem] === typeId) power = mul(power, 1.2);
    if (attItem === 'muscle-band' && physical) power = mul(power, 1.1);
    if (attItem === 'wise-glasses' && !physical) power = mul(power, 1.1);
    const orb = attItem ? ORBS[attItem] : undefined;
    if (orb && attItem !== 'soul-dew' && orb.species.includes(attacker.species) && orb.types.includes(typeId)) power = mul(power, 1.2);
    if (defAbility === 'heatproof' && typeId === T.fire) power = mul(power, 0.5);
    if (defAbility === 'dry-skin' && typeId === T.fire) power = mul(power, 1.25);
    if (defAbility === 'thick-fat' && (typeId === T.fire || typeId === T.ice)) power = mul(power, 0.5);
  }
  if (attAbility && PINCH[attAbility] === typeId && attacker.hp <= attacker.stats.hp / 3) power = mul(power, 1.5);
  if (field.helpingHand && field.doubles) power = mul(power, 1.5);

  const { attack, defense } = stats(c, (stat, key, side) => {
    let v = stat;
    if (side === 'attack') {
      if (key === 'atk' && (attAbility === 'huge-power' || attAbility === 'pure-power')) v *= 2;
      if (physical && attAbility === 'hustle') v = mul(v, 1.5);
      if (physical && attAbility === 'guts' && statused(attacker)) v = mul(v, 1.5);
      if (key === 'atk' && attItem === 'choice-band') v = mul(v, 1.5);
      if (key === 'spa' && attItem === 'choice-specs') v = mul(v, 1.5);
      if (!physical && attAbility === 'solar-power' && field.weather === 'sun') v = mul(v, 1.5);
      if (gen === 3 && attItem && TYPE_ITEMS[attItem] === typeId) v = mul(v, 1.1);
      if (gen === 3 && attItem === 'soul-dew' && key === 'spa' && ['latios', 'latias'].includes(attacker.species)) v = mul(v, 1.5);
      if (attItem === 'light-ball' && attacker.species === 'pikachu' && (key === 'spa' || gen >= 4)) v *= 2;
      if (attItem === 'thick-club' && key === 'atk' && ['cubone', 'marowak'].includes(attacker.species)) v *= 2;
      if (attItem === 'deep-sea-tooth' && key === 'spa' && attacker.species === 'clamperl') v *= 2;
      if (gen === 3 && defAbility === 'thick-fat' && (typeId === T.fire || typeId === T.ice)) v = mul(v, 0.5);
    } else {
      if (defAbility === 'marvel-scale' && key === 'def' && statused(defender)) v = mul(v, 1.5);
      if (defItem === 'deep-sea-scale' && key === 'spd' && defender.species === 'clamperl') v *= 2;
      if (gen === 3 && defItem === 'soul-dew' && key === 'spd' && ['latios', 'latias'].includes(defender.species)) v = mul(v, 1.5);
    }
    return Math.max(1, v);
  });

  const levelTerm = Math.floor((2 * attacker.level) / 5 + 2);
  let base =
    gen === 4
      ? Math.floor(Math.floor((levelTerm * power * attack) / 50) / defense)
      : Math.floor(Math.floor((levelTerm * power * attack) / defense) / 50);
  if (physical && attacker.status === 'brn' && attAbility !== 'guts') base = Math.floor(base / 2);
  if (field.screen && !field.crit) base = field.doubles ? Math.floor((base * 2) / 3) : Math.floor(base / 2);
  if (field.doubles && move.spread) base = gen === 4 ? Math.floor((base * 3) / 4) : Math.floor(base / 2);
  const w = weatherFactor(field.weather, typeId);
  if (w !== 1) base = Math.floor(base * w);
  base += 2;
  if (field.crit) base *= gen === 4 && attAbility === 'sniper' ? 3 : 2;
  if (gen === 4 && attItem === 'life-orb') base = Math.floor(base * 1.3);

  const own = attacker.types.includes(typeId);
  const rolls: number[] = [];
  for (let r = 85; r <= 100; r++) {
    let d = Math.floor((base * r) / 100);
    if (own) d = Math.floor(d * (attAbility === 'adaptability' ? 2 : 1.5));
    for (const t of battleTypes(defender)) d = Math.floor(d * c.factor(t));
    if (gen === 4) {
      if ((defAbility === 'filter' || defAbility === 'solid-rock') && effectiveness > 1) d = Math.floor(d * 0.75);
      if (attItem === 'expert-belt' && effectiveness > 1) d = Math.floor(d * 1.2);
      if (attAbility === 'tinted-lens' && effectiveness < 1) d *= 2;
      if (defItem && RESIST_BERRIES[defItem] === typeId && (effectiveness > 1 || defItem === 'chilan-berry')) d = Math.floor(d / 2);
    }
    rolls.push(Math.max(1, d));
  }
  return rolls;
}

// ── Gen I–II ──────────────────────────────────────────────────────────────────────────────

function damageGen12(c: Ctx, power: number): number[] {
  const { gen, field, attacker, defender, typeId, physical, attItem } = c;
  let { attack, defense } = stats(c, (stat) => stat);
  if (physical && attacker.status === 'brn' && gen <= 2) attack = Math.max(1, Math.floor(attack / 2));
  if (field.screen && !field.crit) defense *= 2;
  let level = attacker.level;
  if (gen === 1 && field.crit) level *= 2;
  if (attack > 255 || defense > 255) {
    attack = Math.max(1, Math.floor(attack / 4) % 256);
    defense = Math.max(1, Math.floor(defense / 4) % 256);
  }
  let base = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * power * attack) / defense) / 50);
  if (gen === 2) {
    if (field.crit) base *= 2;
    if (attItem && TYPE_ITEMS[attItem] === typeId) base = Math.floor(base * 1.1);
  }
  base = Math.min(997, base) + 2;
  if (gen === 2) {
    const w = weatherFactor(field.weather, typeId);
    if (w !== 1) base = Math.floor(base * w);
  }
  if (attacker.types.includes(typeId)) base = Math.floor(base * 1.5);
  for (const t of defender.types) base = Math.floor(base * c.factor(t));
  const rolls: number[] = [];
  for (let r = 217; r <= 255; r++) rolls.push(base === 1 ? 1 : Math.max(1, Math.floor((base * r) / 255)));
  return rolls;
}

// ── Knockouts ─────────────────────────────────────────────────────────────────────────────

export type KoChance = { uses: number; chance: number };

/**
 * How many uses it takes to knock out a target on `hp`, and the chance of doing it in that
 * many. Sturdy and the Focus Sash leave it on 1 HP from full health. Null past four uses.
 */
export function koChance(hitRolls: number[][], hp: number, survivesFirstHit: boolean, maxUses = 4): KoChance | null {
  if (hitRolls.length === 0 || hp <= 0) return null;
  // dist[d] = chance of having dealt d damage so far (capped at hp)
  let dist = new Float64Array(hp + 1);
  dist[0] = 1;
  for (let use = 1; use <= maxUses; use++) {
    hitRolls.forEach((rolls, hit) => {
      const next = new Float64Array(hp + 1);
      const share = 1 / rolls.length;
      for (let dealt = 0; dealt <= hp; dealt++) {
        const p = dist[dealt];
        if (p === 0) continue;
        if (dealt === hp) {
          next[hp] += p;
          continue;
        }
        for (const r of rolls) {
          let total = Math.min(hp, dealt + r);
          if (survivesFirstHit && use === 1 && hit === 0 && dealt === 0) total = Math.min(total, hp - 1);
          next[total] += p * share;
        }
      }
      dist = next;
    });
    if (dist[hp] > 1e-9) return { uses: use, chance: Math.min(1, dist[hp]) };
  }
  return null;
}

export function koText(ko: KoChance | null) {
  if (!ko) return 'Takes more than four hits';
  const name = ko.uses === 1 ? 'OHKO' : `${ko.uses}HKO`;
  if (ko.chance > 0.9999) return `Guaranteed ${name}`;
  const pct = ko.chance * 100;
  return `${pct < 0.1 ? '<0.1' : pct.toFixed(1).replace(/\.0$/, '')}% chance to ${name}`;
}

const TYPE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(T).map(([name, id]) => [id, name[0].toUpperCase() + name.slice(1)])
);

function typeName(id: number) {
  return TYPE_NAMES[id] ?? 'that';
}
