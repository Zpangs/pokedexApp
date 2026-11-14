import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Chips, InlineRow, Stepper, SwitchRow } from '@/components/calc/controls';
import { Quiet } from '@/components/pokemon/sections';
import { NumberField } from '@/components/teams/number-field';
import { ChoiceRow } from '@/components/teams/parts';
import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import { type CalcRole, type CalcSide, updateSide } from '@/db/calc-state';
import type { BoostKey, Status } from '@/db/damage';
import {
  type GameData,
  MAX_EV,
  MAX_EV_TOTAL,
  STAT_KEYS,
  STAT_LABELS,
  statKey,
  type StatKey,
} from '@/db/queries/team-builder';
import { sprites } from '@/db/sprites';
import type { LoadedSide } from '@/hooks/use-calc-result';
import { useTheme } from '@/hooks/use-theme';

export type CalcPickKind = 'pokemon' | 'move' | 'item' | 'nature' | 'ability' | 'tera' | 'member' | 'game';

const STATUSES: { value: Status; label: string }[] = [
  { value: 'none', label: 'Healthy' },
  { value: 'brn', label: 'Burned' },
  { value: 'par', label: 'Paralyzed' },
  { value: 'psn', label: 'Poisoned' },
  { value: 'slp', label: 'Asleep' },
  { value: 'frz', label: 'Frozen' },
];

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** One Pokémon in the calculator: who it is, what it holds, its spread and its state. */
export function SideEditor({
  role,
  side,
  loaded,
  data,
  stats,
  onPick,
}: {
  role: CalcRole;
  side: CalcSide;
  loaded: LoadedSide | null;
  data: GameData;
  /** The stats this calculation uses, which get EV fields and stage steppers. */
  stats: readonly StatKey[];
  onPick: (kind: CalcPickKind) => void;
}) {
  const theme = useTheme();
  const { rules } = data;
  const set = (change: Partial<CalcSide>) => updateSide(role, change);
  const pokemon = data.pokemonById.get(side.pokemonId);
  const item = side.itemId !== null ? data.itemById.get(side.itemId) : undefined;
  const nature = data.natures.find((n) => n.id === side.natureId);
  const tera = data.teraTypes.find((t) => t.id === side.teraTypeId);
  const battle = loaded?.battle;
  const typeIds = battle?.types ?? pokemon?.typeIds ?? [];
  const types = typeIds.map((id) => data.types.find((t) => t.id === id)).filter((t) => t !== undefined);

  return (
    <>
      <ChoiceRow
        label="Pokémon"
        value={battle?.megaName ?? pokemon?.name ?? '?'}
        detail={side.source}
        onPress={() => onPick('pokemon')}
        accessibilityHint="Choose another Pokémon"
        trailing={
          <View style={styles.trailing}>
            <View style={styles.badges}>
              {types.map((t) => (
                <TypeBadge key={t.id} identifier={t.identifier} name={t.name} />
              ))}
            </View>
            <Image source={sprites.sprite(battle?.pokemonId ?? side.pokemonId)} style={styles.sprite} contentFit="contain" transition={0} />
          </View>
        }
      />
      <InlineRow label="Level">
        <NumberField value={side.level} min={1} max={100} onCommit={(level) => set({ level })} accessibilityLabel="Level" />
      </InlineRow>

      {rules.abilities && loaded ? (
        battle?.forcedAbility ? (
          <InlineRow label="Ability" detail={`${battle.megaName ?? 'This form'} always has it`}>
            <Text style={[styles.value, { color: theme.text }]}>{battle.forcedAbility.name}</Text>
          </InlineRow>
        ) : (
          <ChoiceRow
            label="Ability"
            value={loaded.ability?.name ?? 'None'}
            onPress={() => onPick('ability')}
            accessibilityHint="Choose its ability"
          />
        )
      ) : null}
      {rules.heldItems ? (
        <ChoiceRow
          label="Item"
          value={item?.name ?? 'None'}
          detail={battle?.megaName ? `Mega Evolves into ${battle.megaName}` : null}
          onPress={() => onPick('item')}
          accessibilityHint="Choose its held item"
        />
      ) : null}
      {rules.natures ? (
        <ChoiceRow
          label="Nature"
          value={nature?.name ?? 'Neutral'}
          detail={nature?.raises ? `+${nature.raises}  −${nature.lowers}` : null}
          onPress={() => onPick('nature')}
          accessibilityHint="Choose its nature"
        />
      ) : null}
      {rules.tera ? (
        <>
          <ChoiceRow
            label="Tera type"
            value={tera?.name ?? 'Not set'}
            onPress={() => onPick('tera')}
            accessibilityHint="Choose its Tera type"
          />
          <SwitchRow
            label="Terastallized"
            detail={side.terastallized ? `Battling as a ${tera?.name ?? '?'} type` : undefined}
            value={side.terastallized}
            onChange={(terastallized) => set({ terastallized })}
          />
        </>
      ) : null}

      {loaded ? <StatRows role={role} side={side} loaded={loaded} data={data} stats={stats} /> : null}

      <InlineRow
        label="Current HP"
        detail={loaded ? `${loaded.combatant.hp} of ${loaded.stats.hp} HP` : undefined}>
        <View style={styles.percent}>
          <NumberField
            value={side.hpPercent}
            min={1}
            max={100}
            onCommit={(hpPercent) => set({ hpPercent })}
            accessibilityLabel="Current HP percent"
          />
          <Text style={[styles.value, { color: theme.textSecondary }]}>%</Text>
        </View>
      </InlineRow>
      <Chips label="Status" options={STATUSES} value={side.status} onChange={(status) => set({ status })} />
    </>
  );
}

function StatRows({
  role,
  side,
  loaded,
  data,
  stats,
}: {
  role: CalcRole;
  side: CalcSide;
  loaded: LoadedSide;
  data: GameData;
  stats: readonly StatKey[];
}) {
  const theme = useTheme();
  const { rules } = data;
  const nature = data.natures.find((n) => n.id === side.natureId);
  const up = nature?.raisesId ? statKey(nature.raisesId) : null;
  const down = nature?.lowersId ? statKey(nature.lowersId) : null;
  const evTotal = STAT_KEYS.reduce((sum, k) => sum + side.evs[k], 0);
  const setEv = (k: StatKey, n: number) =>
    updateSide(role, { evs: { ...side.evs, [k]: Math.min(n, MAX_EV_TOTAL - (evTotal - side.evs[k])) } });
  if (stats.length === 0) return null;

  return (
    <View style={[styles.stats, { borderBottomColor: theme.rule }]}>
      {stats.map((k) => {
        const label = data.game.generation === 1 && k === 'spa' ? 'Special' : STAT_LABELS[k];
        const mark = k === up ? ' ↑' : k === down ? ' ↓' : '';
        return (
          <View key={k} style={styles.statRow}>
            <View style={styles.statName}>
              <Text style={[styles.statLabel, { color: theme.text }]}>
                {label}
                <Text style={{ color: theme.textSecondary }}>{mark}</Text>
              </Text>
              <Text style={[styles.statValue, { color: theme.textSecondary }]}>{loaded.stats[k]}</Text>
            </View>
            {rules.spreads ? (
              <View style={styles.statControl}>
                <Text style={[styles.small, { color: theme.textSecondary }]}>EV</Text>
                <NumberField
                  value={side.evs[k]}
                  max={MAX_EV}
                  onCommit={(n) => setEv(k, n)}
                  accessibilityLabel={`${label} EVs`}
                  width={60}
                />
              </View>
            ) : null}
            {k !== 'hp' ? (
              <Stepper
                value={side.boosts[k as BoostKey]}
                min={-6}
                max={6}
                label={`${label} stage`}
                format={signed}
                onChange={(n) => updateSide(role, { boosts: { ...side.boosts, [k]: n } })}
              />
            ) : (
              <View style={styles.stepperSpace} />
            )}
          </View>
        );
      })}
      {!rules.spreads ? (
        <Quiet>
          {data.game.generation <= 2
            ? 'Stats use the best DVs and full stat experience, as Showdown does.'
            : 'Stats use the best IVs; this game trains stats its own way.'}
        </Quiet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trailing: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  sprite: {
    width: 56,
    height: 56,
  },
  value: {
    fontFamily: Font.bold,
    fontSize: 17,
  },
  percent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stats: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
  },
  statName: {
    flex: 1,
  },
  statLabel: {
    fontFamily: Font.bold,
    fontSize: 17,
  },
  statValue: {
    fontFamily: Font.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  statControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  small: {
    fontFamily: Font.medium,
    fontSize: 13,
  },
  stepperSpace: {
    width: 44 * 2 + 32 + Spacing.one * 2,
  },
});
