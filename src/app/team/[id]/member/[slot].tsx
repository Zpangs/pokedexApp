import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { AppBar } from '@/components/pokemon/app-bar';
import { SectionSign } from '@/components/pokemon/section-sign';
import { Quiet } from '@/components/pokemon/sections';
import { SignBand } from '@/components/sign-band';
import { NumberField } from '@/components/teams/number-field';
import { ActionButton, ChoiceRow } from '@/components/teams/parts';
import { TypeBadge } from '@/components/type-badge';
import { TypeButton } from '@/components/types/type-button';
import { Font, Spacing } from '@/constants/theme';
import {
  type GameData,
  loadMegaDetails,
  MAX_EV,
  MAX_EV_TOTAL,
  MAX_IV,
  type MemberOptions,
  STAT_KEYS,
  spreadStats,
  STAT_LABELS,
  statKey,
  type StatKey,
} from '@/db/queries/team-builder';
import type { BattleType } from '@/db/queries/types';
import { loadIntoCalc, sideFromMember } from '@/db/calc-state';
import { sprites } from '@/db/sprites';
import { saveTeam, type Team, type TeamMember, updateMember, useTeam } from '@/db/teams';
import { useGameData, useMemberOptions } from '@/hooks/use-team-data';
import { useTheme } from '@/hooks/use-theme';

/** Everything about one team member, limited to what its game has. */
export default function MemberScreen() {
  const params = useLocalSearchParams<{ id: string; slot: string }>();
  const id = Number(params.id);
  const slot = Number(params.slot);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const team = useTeam(id);
  const { data } = useGameData(team?.versionGroupId);
  const member = team?.members[slot];
  const options = useMemberOptions(data, member ? [member.pokemonId] : []).get(member?.pokemonId ?? -1);

  if (!team || !member) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <AppBar title="Team member" showTitle />
        <Notice
          icon={{ ios: 'questionmark.circle', android: 'help', web: 'help' }}
          title="This Pokémon isn't on the team anymore"
          body="Go back to the team to see who's on it."
        />
      </View>
    );
  }

  const pokemon = data?.pokemonById.get(member.pokemonId);
  const set = (change: Partial<TeamMember>) => updateMember(team, slot, change);
  const pick = (kind: 'pokemon' | 'move' | 'item' | 'nature', index?: number) =>
    router.push({
      pathname: '/team/[id]/pick',
      params: { id, kind, slot, ...(index !== undefined ? { index } : {}) },
    });

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title={member.nickname ?? pokemon?.name ?? ''} showTitle={false} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}
        keyboardShouldPersistTaps="handled">
        <SignBand style={styles.band}>
          <Image source={sprites.artwork(member.pokemonId)} style={styles.art} contentFit="contain" transition={0} />
          <View style={styles.bandText}>
            <NicknameField team={team} slot={slot} member={member} placeholder={pokemon?.name ?? ''} />
            {member.nickname && pokemon ? (
              <Text style={[styles.species, { color: theme.onSign }]}>{pokemon.name}</Text>
            ) : null}
            <View style={styles.badges}>
              {pokemon?.types.map((t) => (
                <TypeBadge key={t.identifier} identifier={t.identifier} name={t.name} onBand />
              ))}
            </View>
          </View>
        </SignBand>

        {!data || !options ? null : (
          <>
            <SectionSign title="Pokémon" />
            <ChoiceRow
              label="Pokémon"
              value={pokemon?.name ?? '?'}
              onPress={() => pick('pokemon')}
              accessibilityHint="Swap it for another Pokémon"
            />
            <View style={[styles.inlineRow, { borderBottomColor: theme.rule }]}>
              <Text style={[styles.inlineLabel, { color: theme.text }]}>Level</Text>
              <NumberField
                value={member.level}
                min={1}
                max={100}
                onCommit={(level) => set({ level })}
                accessibilityLabel="Level"
              />
            </View>

            {data.rules.abilities ? (
              <AbilitySection member={member} options={options} onPick={(abilityId) => set({ abilityId })} />
            ) : null}

            {data.rules.heldItems || data.rules.natures ? <SectionSign title="Item and nature" /> : null}
            {data.rules.heldItems ? (
              <>
                <ChoiceRow
                  label="Held item"
                  value={member.itemId ? (data.itemById.get(member.itemId)?.name ?? '?') : 'None'}
                  detail={member.itemId ? data.itemById.get(member.itemId)?.effect : null}
                  onPress={() => pick('item')}
                />
                <MegaNote member={member} data={data} />
              </>
            ) : null}
            {data.rules.natures ? (
              <ChoiceRow
                label="Nature"
                value={data.natures.find((n) => n.id === member.natureId)?.name ?? 'Not set'}
                detail={natureDetail(data, member.natureId)}
                onPress={() => pick('nature')}
              />
            ) : null}

            {data.rules.tera ? (
              <TeraSection
                types={data.teraTypes}
                selected={member.teraTypeId}
                onPick={(teraTypeId) => set({ teraTypeId })}
              />
            ) : null}

            {data.rules.dynamax && options.gigantamax ? (
              <>
                <SectionSign title="Dynamax" />
                <View style={[styles.inlineRow, { borderBottomColor: theme.rule }]}>
                  <View style={styles.flex}>
                    <Text style={[styles.inlineLabel, { color: theme.text }]}>Gigantamax</Text>
                    <Quiet>Dynamaxes as {options.gigantamax.name}, with its G-Max Move.</Quiet>
                  </View>
                  <Switch
                    value={member.gigantamax}
                    onValueChange={(gigantamax) => set({ gigantamax })}
                    trackColor={{ true: theme.sign }}
                    accessibilityLabel="Gigantamax"
                  />
                </View>
              </>
            ) : null}

            <SectionSign title="Moves" detail={`${options.moves.length} it can learn`} />
            {member.moves.map((moveId, i) => {
              const move = moveId ? options.moveById.get(moveId) : undefined;
              return (
                <ChoiceRow
                  key={i}
                  label={`Move ${i + 1}`}
                  value={move?.name ?? 'Empty'}
                  detail={
                    move
                      ? [move.category, move.power ? `${move.power} power` : null, move.accuracy ? `${move.accuracy}%` : null]
                          .filter(Boolean)
                          .join(' · ')
                      : null
                  }
                  trailing={move ? <TypeBadge identifier={move.type.identifier} name={move.type.name} /> : null}
                  onPress={() => pick('move', i)}
                />
              );
            })}

            <StatsSection team={team} slot={slot} member={member} data={data} options={options} />

            <View style={styles.footer}>
              <ActionButton
                label="Calculate damage"
                icon={{ ios: 'flame.fill', android: 'calculate', web: 'calculate' }}
                onPress={() => {
                  loadIntoCalc(team.versionGroupId, 'attacker', sideFromMember(member, `From ${team.name}`));
                  router.navigate('/calc');
                }}
                accessibilityHint="Opens the damage calculator with this Pokémon attacking"
              />
              <ActionButton
                destructive
                label="Remove from team"
                icon={{ ios: 'minus.circle', android: 'remove_circle', web: 'remove_circle' }}
                onPress={() =>
                  Alert.alert(`Remove ${member.nickname ?? pokemon?.name}?`, undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        router.back();
                        saveTeam({ ...team, members: team.members.filter((_, i) => i !== slot) });
                      },
                    },
                  ])
                }
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function NicknameField({
  team,
  slot,
  member,
  placeholder,
}: {
  team: Team;
  slot: number;
  member: TeamMember;
  placeholder: string;
}) {
  const theme = useTheme();
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={styles.nameRow}>
      <TextInput
        value={text ?? member.nickname ?? ''}
        onChangeText={setText}
        onEndEditing={() => {
          if (text === null) return;
          const nickname = text.trim() || null;
          if (nickname !== member.nickname) updateMember(team, slot, { nickname });
          setText(null);
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.onSign}
        maxLength={12}
        style={[styles.name, { color: theme.onSign }]}
        selectionColor={theme.onSign}
        cursorColor={theme.onSign}
        accessibilityLabel="Nickname"
        accessibilityHint="Optional. Leave empty to use its name"
        returnKeyType="done"
      />
      <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={20} tintColor={theme.onSign} />
    </View>
  );
}

function natureDetail(data: GameData, natureId: number | null) {
  const n = data.natures.find((x) => x.id === natureId);
  if (!n) return null;
  return n.raises ? `+${n.raises}  −${n.lowers}` : 'No stat change';
}

function AbilitySection({
  member,
  options,
  onPick,
}: {
  member: TeamMember;
  options: MemberOptions;
  onPick: (id: number) => void;
}) {
  const theme = useTheme();
  return (
    <>
      <SectionSign title="Ability" />
      <View accessibilityRole="radiogroup">
        {options.abilities.map((a) => {
          const selected = a.id === member.abilityId;
          return (
            <Pressable
              key={a.id}
              onPress={() => onPick(a.id)}
              style={({ pressed }) => [
                styles.radio,
                { borderBottomColor: theme.rule },
                pressed && { backgroundColor: theme.backgroundElement },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${a.name}${a.isHidden ? ', hidden ability' : ''}. ${a.effect ?? ''}`}>
              <SymbolView
                name={
                  selected
                    ? { ios: 'checkmark.circle.fill', android: 'radio_button_checked', web: 'radio_button_checked' }
                    : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }
                }
                size={24}
                tintColor={selected ? theme.text : theme.textSecondary}
              />
              <View style={styles.flex}>
                <Text style={[styles.inlineLabel, { color: theme.text }]}>
                  {a.name}
                  {a.isHidden ? <Text style={[styles.tag, { color: theme.textSecondary }]}>{'  Hidden'}</Text> : null}
                </Text>
                {a.effect ? <Quiet>{a.effect}</Quiet> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

/** What a held Mega Stone (or Primal orb) does, or why it does nothing on this Pokémon. */
function MegaNote({ member, data }: { member: TeamMember; data: GameData }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const mega = member.itemId ? data.itemById.get(member.itemId)?.megaFor : undefined;
  const fits = mega?.basePokemonId === member.pokemonId;
  const [details, setDetails] = useState<Awaited<ReturnType<typeof loadMegaDetails>>>(null);
  const megaId = fits ? mega?.megaPokemonId : undefined;

  useEffect(() => {
    if (megaId === undefined) return;
    let live = true;
    loadMegaDetails(db, data, megaId).then((d) => live && setDetails(d));
    return () => {
      live = false;
    };
  }, [db, data, megaId]);

  if (!mega) return null;
  if (!fits) {
    const owner = data.pokemonById.get(mega.basePokemonId)?.name;
    return (
      <View style={styles.note}>
        <Quiet>{owner ? `Only ${owner} can Mega Evolve with this.` : 'This Pokémon can’t use it.'}</Quiet>
      </View>
    );
  }
  if (!details || megaId === undefined) return null;
  return (
    <View style={[styles.mega, { borderColor: theme.rowRule }]}>
      <Image source={sprites.sprite(megaId)} style={styles.megaSprite} contentFit="contain" transition={0} />
      <View style={styles.flex}>
        <Text style={[styles.inlineLabel, { color: theme.text }]}>Becomes {details.name}</Text>
        <View style={styles.badges}>
          {details.types.map((t) => (
            <TypeBadge key={t.id} identifier={t.identifier} name={t.name} />
          ))}
        </View>
        {details.ability ? <Quiet>Ability: {details.ability}</Quiet> : null}
      </View>
    </View>
  );
}

function TeraSection({
  types,
  selected,
  onPick,
}: {
  types: BattleType[];
  selected: number | null;
  onPick: (id: number) => void;
}) {
  return (
    <>
      <SectionSign title="Tera Type" detail={types.find((t) => t.id === selected)?.name} />
      <View style={styles.grid}>
        {types.map((t) => (
          <TypeButton
            key={t.id}
            identifier={t.identifier}
            name={t.name}
            selected={t.id === selected}
            onPress={() => onPick(t.id)}
            style={styles.gridButton}
          />
        ))}
      </View>
    </>
  );
}

/** Final stats at its level, with the EVs and IVs that feed them where the game has them. */
function StatsSection({
  team,
  slot,
  member,
  data,
  options,
}: {
  team: Team;
  slot: number;
  member: TeamMember;
  data: GameData;
  options: MemberOptions;
}) {
  const theme = useTheme();
  const { rules } = data;
  const nature = data.natures.find((n) => n.id === member.natureId);
  const up = nature?.raisesId ? statKey(nature.raisesId) : null;
  const down = nature?.lowersId ? statKey(nature.lowersId) : null;
  const evTotal = STAT_KEYS.reduce((sum, k) => sum + member.evs[k], 0);
  const shedinja = data.pokemonById.get(member.pokemonId)?.identifier === 'shedinja';

  const totals = spreadStats(options.baseStats, member, data, shedinja);
  const value = (k: StatKey) => totals[k];
  const setEv = (k: StatKey, n: number) => {
    const others = evTotal - member.evs[k];
    updateMember(team, slot, { evs: { ...member.evs, [k]: Math.min(n, MAX_EV_TOTAL - others) } });
  };
  const setIv = (k: StatKey, n: number) => updateMember(team, slot, { ivs: { ...member.ivs, [k]: n } });

  return (
    <>
      <SectionSign
        title="Stats"
        detail={rules.spreads ? `EVs ${evTotal} of ${MAX_EV_TOTAL}` : `Level ${member.level}`}
      />
      <View style={styles.statHead}>
        <Text style={[styles.statName, styles.headText, { color: theme.textSecondary }]}>Stat</Text>
        <Text style={[styles.statNum, styles.headText, { color: theme.textSecondary }]}>Base</Text>
        {rules.spreads ? (
          <>
            <Text style={[styles.statField, styles.headText, { color: theme.textSecondary }]}>EV</Text>
            <Text style={[styles.statField, styles.headText, { color: theme.textSecondary }]}>IV</Text>
          </>
        ) : null}
        <Text style={[styles.statTotal, styles.headText, { color: theme.textSecondary }]}>Total</Text>
      </View>
      {/* Gen I had one Special stat for both attacking and defending */}
      {STAT_KEYS.filter((k) => data.game.generation > 1 || k !== 'spd').map((k) => {
        const mark = k === up ? ' ↑' : k === down ? ' ↓' : '';
        const label = data.game.generation === 1 && k === 'spa' ? 'Special' : STAT_LABELS[k];
        return (
          <View
            key={k}
            style={[styles.statRow, { borderBottomColor: theme.rule }]}
            accessibilityLabel={`${label}${k === up ? ', raised by nature' : k === down ? ', lowered by nature' : ''}: base ${
              options.baseStats[k]
            }, total ${value(k)}`}>
            <Text style={[styles.statName, { color: theme.text }]}>
              {label}
              <Text style={{ color: theme.textSecondary }}>{mark}</Text>
            </Text>
            <Text style={[styles.statNum, { color: theme.textSecondary }]}>{options.baseStats[k]}</Text>
            {rules.spreads ? (
              <>
                <View style={styles.statField}>
                  <NumberField
                    value={member.evs[k]}
                    max={MAX_EV}
                    onCommit={(n) => setEv(k, n)}
                    accessibilityLabel={`${STAT_LABELS[k]} EVs`}
                    width={60}
                  />
                </View>
                <View style={styles.statField}>
                  <NumberField
                    value={member.ivs[k]}
                    max={MAX_IV}
                    onCommit={(n) => setIv(k, n)}
                    accessibilityLabel={`${STAT_LABELS[k]} IVs`}
                    width={52}
                  />
                </View>
              </>
            ) : null}
            <Text style={[styles.statTotal, { color: theme.text }]}>{value(k)}</Text>
          </View>
        );
      })}
      {!rules.spreads ? (
        <View style={styles.note}>
          <Quiet>
            {data.game.generation <= 2
              ? 'Shown with the best DVs and full stat experience, as Showdown uses.'
              : `${data.game.name} trains stats its own way, so EVs and IVs aren't set here.`}
          </Quiet>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  art: {
    width: 112,
    height: 112,
  },
  bandText: {
    flex: 1,
    gap: Spacing.one,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    flex: 1,
    fontFamily: Font.extraBold,
    fontSize: 24,
    lineHeight: 30,
    paddingVertical: Spacing.one,
    paddingHorizontal: 0,
  },
  species: {
    fontFamily: Font.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inlineLabel: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  tag: {
    fontFamily: Font.medium,
    fontSize: 14,
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  note: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  mega: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    margin: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
  },
  megaSprite: {
    width: 64,
    height: 64,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  gridButton: {
    width: '30%',
    flexGrow: 1,
  },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  headText: {
    fontFamily: Font.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statName: {
    flex: 1,
    fontFamily: Font.bold,
    fontSize: 16,
  },
  statNum: {
    width: 48,
    textAlign: 'right',
    fontFamily: Font.medium,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  statField: {
    width: 72,
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  statTotal: {
    width: 56,
    textAlign: 'right',
    fontFamily: Font.extraBold,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    padding: Spacing.three,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
});
