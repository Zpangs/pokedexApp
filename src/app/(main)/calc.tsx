import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chips, InlineRow, Stepper, SwitchRow } from '@/components/calc/controls';
import { ResultCard } from '@/components/calc/result-card';
import { type CalcPickKind, SideEditor } from '@/components/calc/side-editor';
import { SectionSign } from '@/components/pokemon/section-sign';
import { Quiet } from '@/components/pokemon/sections';
import { SignBand } from '@/components/sign-band';
import { ActionButton, ChoiceRow } from '@/components/teams/parts';
import { Font, MenuButtonInset, Spacing } from '@/constants/theme';
import {
  type CalcRole,
  type CalcState,
  setCalcGame,
  setSide,
  swapSides,
  updateField,
  updateSide,
  useCalc,
} from '@/db/calc-state';
import type { Terrain, Weather } from '@/db/damage';
import type { GameData, TeamMove } from '@/db/queries/team-builder';
import { type CalcOutcome, type LoadedSide, relevantStats, useCalcResult } from '@/hooks/use-calc-result';
import { useGameData, useTeamGames } from '@/hooks/use-team-data';
import { useTheme } from '@/hooks/use-theme';

const pick = (kind: CalcPickKind, role: CalcRole = 'attacker') =>
  router.push({ pathname: '/calc/pick', params: { kind, role } });

/**
 * How much damage one Pokémon's move does to another, in a chosen game: its stats, abilities,
 * items, type chart and battle mechanics.
 */
export default function CalcScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const state = useCalc();
  const { games } = useTeamGames();
  const { data } = useGameData(state.versionGroupId ?? undefined);
  const { attacker, defender, outcome } = useCalcResult(state, data);

  // Start in the newest main game
  useEffect(() => {
    if (!games || state.versionGroupId !== null) return;
    const game = games.find((g) => g.identifier === 'scarlet-violet') ?? games[0];
    if (game) setCalcGame(game.versionGroupId);
  }, [games, state.versionGroupId]);

  // After a game change, drop what the new game doesn't have
  useEffect(() => {
    if (!data) return;
    for (const role of ['attacker', 'defender'] as const) {
      const side = state[role];
      if (!side) continue;
      if (!data.pokemonById.has(side.pokemonId)) setSide(role, null);
      else if (side.itemId !== null && !data.itemById.has(side.itemId)) updateSide(role, { itemId: null });
    }
  }, [data, state]);
  useEffect(() => {
    const id = attacker?.side.moveId;
    if (attacker && id !== null && id !== undefined && !attacker.options.moveById.has(id)) {
      updateSide('attacker', { moveId: null, teamMoves: attacker.side.teamMoves.filter((m) => attacker.options.moveById.has(m)) });
    }
  }, [attacker]);

  // Like in battle, a Pokémon that sets weather or terrain on entry sets it here when it arrives
  useFieldSetters(attacker, defender, data?.game.generation ?? 0);

  const game = games?.find((g) => g.versionGroupId === state.versionGroupId);
  const move = attacker && state.attacker?.moveId != null ? attacker.options.moveById.get(state.attacker.moveId) : undefined;
  const moveIdentifier = outcome?.info.identifier;
  const gen = data?.game.generation ?? 9;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <SignBand style={[styles.band, { paddingTop: insets.top + Spacing.two }]}>
        <Text style={[styles.title, { color: theme.onSign }]} accessibilityRole="header">
          Damage calc
        </Text>
      </SignBand>

      <ScrollView
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: MenuButtonInset + Spacing.three }}>
        <ResultCard
          outcome={outcome}
          attackerName={attacker?.combatant.name}
          defenderName={defender?.combatant.name}
          prompt={promptFor(state, data, attacker, defender, outcome)}
          conditions={conditionsFor(state, gen)}
        />

        <ChoiceRow
          label="Game"
          value={game?.name ?? '…'}
          detail="Its Pokémon, moves, type chart and mechanics are used"
          onPress={() => pick('game')}
          accessibilityHint="Choose another game"
        />

        {!data ? null : (
          <>
            <SectionSign title="Attacker" />
            <SideSection role="attacker" state={state} loaded={attacker} data={data} move={move} moveIdentifier={moveIdentifier} />

            {state.attacker ? (
              <>
                <SectionSign title="Move" />
                {attacker && attacker.side.teamMoves.length > 0 ? (
                  <Chips
                    label="Its moves on the team"
                    options={attacker.side.teamMoves
                      .map((id) => attacker.options.moveById.get(id))
                      .filter((m) => m !== undefined)
                      .map((m) => ({ value: m.id, label: m.name }))}
                    value={state.attacker.moveId ?? -1}
                    onChange={(moveId) => updateSide('attacker', { moveId })}
                  />
                ) : null}
                <ChoiceRow
                  label="Move"
                  value={move?.name ?? 'Choose a move'}
                  detail={
                    move
                      ? [move.type.name, move.category, move.power ? `${move.power} power` : null].filter(Boolean).join(' · ')
                      : null
                  }
                  onPress={() => pick('move')}
                  accessibilityHint="Choose one of its damaging moves"
                />
                {outcome && outcome.info.maxHits > outcome.info.minHits && attacker?.combatant.ability !== 'skill-link' ? (
                  <InlineRow label="Hits" detail={`It hits ${outcome.info.minHits} to ${outcome.info.maxHits} times`}>
                    <Stepper
                      value={Math.min(outcome.info.maxHits, Math.max(outcome.info.minHits, state.field.hits))}
                      min={outcome.info.minHits}
                      max={outcome.info.maxHits}
                      label="Hits"
                      onChange={(hits) => updateField({ hits })}
                    />
                  </InlineRow>
                ) : null}
              </>
            ) : null}

            <View style={styles.swap}>
              <ActionButton
                label="Swap attacker and defender"
                icon={{ ios: 'arrow.up.arrow.down', android: 'swap_vert', web: 'swap_vert' }}
                onPress={swapSides}
              />
            </View>

            <SectionSign title="Defender" />
            <SideSection role="defender" state={state} loaded={defender} data={data} move={move} moveIdentifier={moveIdentifier} />

            <FieldSection data={data} state={state} physical={outcome?.result.category === 'Physical'} gen={gen} />

            <View style={styles.footnote}>
              <Quiet>
                Worked out like Showdown’s damage calculator. Abilities and items that change damage are counted;
                Dynamax, Z-Moves and effects that hang on earlier turns aren’t.
              </Quiet>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const WEATHER_SETTERS: Record<string, Weather> = {
  drought: 'sun',
  'desolate-land': 'sun',
  'orichalcum-pulse': 'sun',
  drizzle: 'rain',
  'primordial-sea': 'rain',
  'sand-stream': 'sand',
  'snow-warning': 'hail',
};

const TERRAIN_SETTERS: Record<string, Terrain> = {
  'electric-surge': 'electric',
  'hadron-engine': 'electric',
  'grassy-surge': 'grassy',
  'misty-surge': 'misty',
  'psychic-surge': 'psychic',
};

function useFieldSetters(attacker: LoadedSide | null, defender: LoadedSide | null, gen: number) {
  const seen = useRef<string | null>(null);
  const abilities = [attacker?.combatant.ability, defender?.combatant.ability].filter((a): a is string => !!a);
  const key = abilities.join(',');
  useEffect(() => {
    // Only when an ability arrives, so the field can still be changed by hand afterwards
    const before = new Set((seen.current ?? '').split(','));
    seen.current = key;
    for (const a of key.split(',')) {
      if (!a || before.has(a)) continue;
      const weather = WEATHER_SETTERS[a];
      if (weather) updateField({ weather: weather === 'hail' && gen >= 9 ? 'snow' : weather });
      const terrain = TERRAIN_SETTERS[a];
      if (terrain) updateField({ terrain });
    }
  }, [key, gen]);
}

const WEATHER_NAMES: Record<Weather, string> = {
  none: '',
  sun: 'Sun',
  rain: 'Rain',
  sand: 'Sandstorm',
  hail: 'Hail',
  snow: 'Snow',
};

/** What's set on the field, in the words of the result card. */
function conditionsFor(state: CalcState, gen: number) {
  const { field } = state;
  const out: string[] = [];
  if (field.doubles && gen >= 3) out.push('Doubles');
  if (field.weather !== 'none' && gen >= 2) out.push(WEATHER_NAMES[field.weather]);
  if (field.terrain !== 'none' && gen >= 6) out.push(`${field.terrain[0].toUpperCase()}${field.terrain.slice(1)} Terrain`);
  if (field.crit) out.push('Critical hit');
  if (field.screen) out.push('Screen up');
  if (field.helpingHand && field.doubles && gen >= 3) out.push('Helping Hand');
  return out;
}

function promptFor(
  state: CalcState,
  data: GameData | null,
  attacker: LoadedSide | null,
  defender: LoadedSide | null,
  outcome: CalcOutcome | null
) {
  if (!data) return 'Loading the game…';
  if (!state.attacker) return 'Choose the attacking Pokémon.';
  if (state.attacker.moveId === null) return 'Choose the move it uses.';
  if (!state.defender) return 'Choose the Pokémon taking the hit.';
  if (!attacker || !defender || !outcome) return 'Working it out…';
  return '';
}

function SideSection({
  role,
  state,
  loaded,
  data,
  move,
  moveIdentifier,
}: {
  role: CalcRole;
  state: CalcState;
  loaded: LoadedSide | null;
  data: GameData;
  move: TeamMove | undefined;
  moveIdentifier: string | undefined;
}) {
  const side = state[role];
  return (
    <>
      {side ? (
        <SideEditor
          role={role}
          side={side}
          loaded={loaded}
          data={data}
          stats={relevantStats(role, move, moveIdentifier, data.game.generation)}
          onPick={(kind) => pick(kind, role)}
        />
      ) : (
        <ChoiceRow
          label="Pokémon"
          value="Choose a Pokémon"
          onPress={() => pick('pokemon', role)}
          accessibilityHint={`Choose the ${role}`}
        />
      )}
      <View style={styles.fromTeam}>
        <ActionButton
          label="Use one from a team"
          icon={{ ios: 'person.3.fill', android: 'groups', web: 'groups' }}
          onPress={() => pick('member', role)}
        />
      </View>
    </>
  );
}

function FieldSection({ data, state, physical, gen }: { data: GameData; state: CalcState; physical: boolean; gen: number }) {
  const { field } = state;
  const weathers: { value: Weather; label: string }[] = [{ value: 'none', label: 'None' }];
  if (gen >= 2) weathers.push({ value: 'sun', label: 'Sun' }, { value: 'rain', label: 'Rain' }, { value: 'sand', label: 'Sandstorm' });
  if (gen >= 3 && gen <= 8) weathers.push({ value: 'hail', label: 'Hail' });
  if (gen >= 9) weathers.push({ value: 'snow', label: 'Snow' });
  const terrains: { value: Terrain; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'electric', label: 'Electric' },
    { value: 'grassy', label: 'Grassy' },
    { value: 'misty', label: 'Misty' },
  ];
  if (gen >= 7) terrains.push({ value: 'psychic', label: 'Psychic' });
  const weather = weathers.some((w) => w.value === field.weather) ? field.weather : 'none';
  const terrain = gen >= 6 && terrains.some((t) => t.value === field.terrain) ? field.terrain : 'none';

  return (
    <>
      <SectionSign title="Battle" detail={data.game.name} />
      {gen >= 3 ? (
        <Chips
          label="Format"
          options={[
            { value: 'singles', label: 'Singles' },
            { value: 'doubles', label: 'Doubles' },
          ]}
          value={field.doubles ? 'doubles' : 'singles'}
          onChange={(v) => updateField({ doubles: v === 'doubles' })}
        />
      ) : null}
      {gen >= 2 ? <Chips label="Weather" options={weathers} value={weather} onChange={(w) => updateField({ weather: w })} /> : null}
      {gen >= 6 ? <Chips label="Terrain" options={terrains} value={terrain} onChange={(t) => updateField({ terrain: t })} /> : null}
      <SwitchRow
        label="Critical hit"
        detail={`${gen >= 6 ? '×1.5' : '×2'}, ignoring the attacker’s stat drops, the defender’s raises and screens`}
        value={field.crit}
        onChange={(crit) => updateField({ crit })}
      />
      <SwitchRow
        label={physical ? 'Reflect on the defender’s side' : 'Light Screen on the defender’s side'}
        detail="Or Aurora Veil"
        value={field.screen}
        onChange={(screen) => updateField({ screen })}
      />
      {field.doubles && gen >= 3 ? (
        <SwitchRow label="Helping Hand" value={field.helpingHand} onChange={(helpingHand) => updateField({ helpingHand })} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  band: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  title: {
    fontFamily: Font.extraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    minHeight: 44,
  },
  swap: {
    padding: Spacing.three,
  },
  fromTeam: {
    padding: Spacing.three,
  },
  footnote: {
    padding: Spacing.three,
  },
});
