import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MoveRow } from '@/components/moves/move-row';
import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import { formatDexNumber } from '@/db/queries/national-dex';
import {
  type Ability,
  type Encounter,
  type EvolutionStage,
  formatMultiplier,
  type GameOption,
  type LearnedMove,
  type Matchup,
  type SpeciesInfo,
  type Stat,
} from '@/db/queries/pokemon-detail';
import { sprites } from '@/db/sprites';
import { useTheme } from '@/hooks/use-theme';

/* ---------- Shared pieces ---------- */

export function SectionBody({ children }: { children: ReactNode }) {
  return <View style={styles.body}>{children}</View>;
}

export function Quiet({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.quiet, { color: theme.textSecondary }]}>{children}</Text>;
}

function MoreButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.more, { borderColor: theme.text }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button">
      <Text style={[styles.moreLabel, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Type matchups ---------- */

export function MatchupsSection({ matchups }: { matchups: Matchup[] }) {
  const groups: { label: string; items: Matchup[] }[] = [
    { label: 'Weak to', items: matchups.filter((m) => m.multiplier > 1) },
    { label: 'Resists', items: matchups.filter((m) => m.multiplier > 0 && m.multiplier < 1) },
    { label: 'Immune to', items: matchups.filter((m) => m.multiplier === 0) },
  ];
  return (
    <SectionBody>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <LabeledBadges key={g.label} label={g.label}>
            {g.items.map((m) => (
              <TypeBadge
                key={m.type.identifier}
                identifier={m.type.identifier}
                name={m.type.name}
                suffix={formatMultiplier(m.multiplier)}
              />
            ))}
          </LabeledBadges>
        ))}
    </SectionBody>
  );
}

function LabeledBadges({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

/* ---------- Abilities ---------- */

export function AbilitiesSection({ abilities }: { abilities: Ability[] }) {
  const theme = useTheme();
  return (
    <SectionBody>
      {abilities.map((a) => (
        <Pressable
          key={a.name}
          onPress={() => router.push({ pathname: '/ability/[id]', params: { id: a.id } })}
          style={({ pressed }) => [
            styles.ability,
            pressed && { backgroundColor: theme.backgroundElement },
          ]}
          android_ripple={{ color: theme.backgroundSelected }}
          accessibilityRole="button"
          accessibilityLabel={`${a.name}${a.isHidden ? ', hidden ability' : ''}${a.effect ? `. ${a.effect}` : ''}`}
          accessibilityHint="Opens the ability">
          <View style={styles.abilityText}>
            <View style={styles.abilityHead}>
              <Text style={[styles.strong, { color: theme.text }]}>{a.name}</Text>
              {a.isHidden && (
                <View style={[styles.tag, { borderColor: theme.textSecondary }]}>
                  <Text style={[styles.tagLabel, { color: theme.textSecondary }]}>Hidden ability</Text>
                </View>
              )}
            </View>
            {a.effect ? (
              <Text style={[styles.prose, { color: theme.textSecondary }]}>{a.effect}</Text>
            ) : null}
          </View>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={22}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      ))}
    </SectionBody>
  );
}

/* ---------- Base stats ---------- */

/** Bars are drawn against the highest base stat any Pokémon has. */
const STAT_MAX = 255;

export function StatsSection({ stats }: { stats: Stat[] }) {
  const theme = useTheme();
  const top = Math.max(...stats.map((s) => s.value));
  return (
    <SectionBody>
      {stats.map((s) => {
        const highest = s.value === top;
        return (
          <View
            key={s.identifier}
            style={styles.stat}
            accessible
            accessibilityLabel={`${s.name} ${s.value}${highest ? ', highest' : ''}`}>
            <Text style={[styles.statName, { color: theme.textSecondary }]} numberOfLines={1}>
              {s.name}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{s.value}</Text>
            <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(100, (s.value / STAT_MAX) * 100)}%`,
                    backgroundColor: highest ? theme.barHighlight : theme.bar,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </SectionBody>
  );
}

/* ---------- Evolution ---------- */

type EvolutionProps = {
  stages: EvolutionStage[];
  /** The `pokemonId` of this page's stage. */
  current: number | null;
};

export function EvolutionSection({ stages: chain, current }: EvolutionProps) {
  const theme = useTheme();
  if (chain.length <= 1) {
    return (
      <SectionBody>
        <Quiet>Doesn’t evolve.</Quiet>
      </SectionBody>
    );
  }

  // Walk the chain as a tree, so branches (Eevee, Wurmple) sit under the stage they come from
  const ordered: { stage: EvolutionStage; depth: number }[] = [];
  const visit = (from: number | null, depth: number) => {
    for (const stage of chain.filter((s) => s.evolvesFrom === from)) {
      ordered.push({ stage, depth });
      visit(stage.pokemonId, depth + 1);
    }
  };
  visit(null, 0);

  return (
    <View>
      {ordered.map(({ stage, depth }) => {
        const isCurrent = stage.pokemonId === current;
        // Regional forms open on that form; default forms share the species id
        const form = stage.pokemonId === stage.number ? undefined : String(stage.pokemonId);
        return (
          <Pressable
            key={stage.pokemonId}
            disabled={isCurrent}
            onPress={() =>
              router.push({ pathname: '/pokemon/[number]', params: { number: stage.number, form } })
            }
            android_ripple={{ color: theme.backgroundSelected }}
            style={[
              styles.stage,
              { paddingLeft: Spacing.three + depth * 24, borderBottomColor: theme.rule },
              isCurrent && { backgroundColor: theme.backgroundElement },
            ]}
            accessibilityRole={isCurrent ? undefined : 'button'}
            accessibilityState={{ selected: isCurrent }}
            accessibilityLabel={`${stage.name}${stage.methods.length ? `, evolves by ${stage.methods.join(' or ')}` : ''}${isCurrent ? ', this Pokémon' : ''}`}>
            {depth > 0 && (
              <SymbolView
                name={{ ios: 'arrow.turn.down.right', android: 'subdirectory_arrow_right', web: 'subdirectory_arrow_right' }}
                size={20}
                tintColor={theme.textSecondary}
              />
            )}
            <Image
              source={sprites.sprite(stage.pokemonId)}
              style={styles.stageSprite}
              contentFit="contain"
            />
            <View style={styles.stageText}>
              <Text style={[styles.strong, { color: theme.text }]}>
                {stage.name}
                <Text style={[styles.stageNumber, { color: theme.textSecondary }]}>
                  {'  '}
                  {formatDexNumber(stage.number)}
                </Text>
              </Text>
              {stage.methods.length > 0 && (
                <Text style={[styles.prose, { color: theme.textSecondary }]}>
                  {stage.methods.join(' · or ')}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Where to find ---------- */

const GAMES_SHOWN = 4;
const LOCATIONS_SHOWN = 6;

export function EncountersSection({ encounters }: { encounters: Encounter[] }) {
  const [showAllGames, setShowAllGames] = useState(false);
  if (encounters.length === 0) {
    return (
      <SectionBody>
        <Quiet>
          Not found in the wild in any game with location data. PokéAPI only has locations for games
          up to Sword/Shield.
        </Quiet>
      </SectionBody>
    );
  }

  const byVersion = new Map<string, Encounter[]>();
  for (const e of encounters) byVersion.set(e.version, [...(byVersion.get(e.version) ?? []), e]);

  // Paired versions with the same locations (Sword and Shield) share one list: "Sword / Shield"
  const bySignature = new Map<string, { names: string[]; list: Encounter[] }>();
  for (const [version, list] of byVersion) {
    const signature = list.map((e) => `${e.location}:${e.minLevel}-${e.maxLevel}`).join('|');
    const group = bySignature.get(signature);
    if (group) group.names.push(version);
    else bySignature.set(signature, { names: [version], list });
  }
  const versions = [...bySignature.values()].map(
    (g) => [mergeVersionNames(g.names), g.list] as const
  );
  const shown = showAllGames ? versions : versions.slice(0, GAMES_SHOWN);

  return (
    <SectionBody>
      {shown.map(([version, list]) => (
        <VersionLocations key={version} version={version} list={list} />
      ))}
      {versions.length > GAMES_SHOWN && !showAllGames && (
        <MoreButton
          label={`Show all ${versions.length} games`}
          onPress={() => setShowAllGames(true)}
        />
      )}
      <Quiet>PokéAPI only has locations for games up to Sword/Shield.</Quiet>
    </SectionBody>
  );
}

/** ["Sword: The Isle of Armor", "Shield: The Isle of Armor"] → "Sword / Shield: The Isle of Armor" */
function mergeVersionNames(names: string[]) {
  if (names.length === 1) return names[0];
  const suffixes = names.map((n) => (n.includes(': ') ? n.slice(n.indexOf(': ')) : ''));
  if (suffixes.every((s) => s === suffixes[0]) && suffixes[0]) {
    return `${names.map((n) => n.slice(0, n.indexOf(': '))).join(' / ')}${suffixes[0]}`;
  }
  return names.join(' / ');
}

function VersionLocations({ version, list }: { version: string; list: Encounter[] }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? list : list.slice(0, LOCATIONS_SHOWN);
  return (
    <View style={styles.group}>
      <Text style={[styles.strong, { color: theme.text }]}>{version}</Text>
      {shown.map((e) => (
        <View key={e.location} style={styles.location}>
          <Text style={[styles.locationName, { color: theme.text }]}>{e.location}</Text>
          <Text style={[styles.level, { color: theme.textSecondary }]}>
            {e.minLevel === e.maxLevel ? `Lv ${e.minLevel}` : `Lv ${e.minLevel}–${e.maxLevel}`}
          </Text>
        </View>
      ))}
      {list.length > LOCATIONS_SHOWN && !expanded && (
        <MoreButton
          label={`Show ${list.length - LOCATIONS_SHOWN} more`}
          onPress={() => setExpanded(true)}
        />
      )}
    </View>
  );
}

/* ---------- Moves ---------- */

export const METHOD_LABELS: Record<string, string> = {
  'Level up': 'Level up',
  Machine: 'TM',
  Egg: 'Egg moves',
  Tutor: 'Move tutor',
  Train: 'Training',
};

export function GamePicker({
  games,
  selected,
  onSelect,
}: {
  games: GameOption[];
  selected: number | null;
  onSelect: (versionGroupId: number) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.games}>
      {games.map((g) => {
        const on = g.versionGroupId === selected;
        return (
          <Pressable
            key={g.versionGroupId}
            onPress={() => onSelect(g.versionGroupId)}
            style={[
              styles.chip,
              { borderColor: on ? theme.sign : theme.textSecondary },
              on && { backgroundColor: theme.sign },
            ]}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}>
            <Text style={[styles.chipLabel, { color: on ? theme.onSign : theme.text }]} numberOfLines={1}>
              {g.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function MovesSection({ moves }: { moves: LearnedMove[] | null }) {
  const theme = useTheme();
  if (moves === null) return null;
  if (moves.length === 0) {
    return (
      <SectionBody>
        <Quiet>No moves recorded for this game.</Quiet>
      </SectionBody>
    );
  }

  const groups = new Map<string, LearnedMove[]>();
  for (const m of moves) groups.set(m.method, [...(groups.get(m.method) ?? []), m]);

  return (
    <View>
      {[...groups.entries()].map(([method, list]) => (
        <View key={method}>
          <Text style={[styles.methodLabel, { color: theme.textSecondary }]}>
            {METHOD_LABELS[method] ?? method} · {list.length}
          </Text>
          {list.map((m) => (
            <MoveRow
              key={`${method}-${m.id}`}
              move={m}
              lead={method === 'Level up' ? (m.level > 0 ? String(m.level) : 'Evo') : undefined}
              leadLabel={
                method === 'Level up' ? (m.level > 0 ? `Level ${m.level}` : 'On evolution') : undefined
              }
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/* ---------- About ---------- */

function genderLabel(rate: number) {
  if (rate === -1) return 'Genderless';
  if (rate === 0) return 'Always male';
  if (rate === 8) return 'Always female';
  const female = (rate / 8) * 100;
  return `${100 - female}% male, ${female}% female`;
}

export function AboutSection({
  species,
  height,
  weight,
}: {
  species: SpeciesInfo;
  height?: number;
  weight?: number;
}) {
  const theme = useTheme();
  const status = species.isMythical
    ? 'Mythical'
    : species.isLegendary
      ? 'Legendary'
      : species.isBaby
        ? 'Baby Pokémon'
        : null;
  const facts: [string, string][] = [
    ...(height !== undefined ? [['Height', `${height.toLocaleString()} m`] as [string, string]] : []),
    ...(weight !== undefined ? [['Weight', `${weight.toLocaleString()} kg`] as [string, string]] : []),
    ['Gender', genderLabel(species.genderRate)],
    ['Egg groups', species.eggGroups.join(', ') || '—'],
    ['Catch rate', String(species.captureRate)],
    ...(status ? [['Status', status] as [string, string]] : []),
  ];

  return (
    <SectionBody>
      {species.flavorText ? (
        <View style={styles.group}>
          <Text style={[styles.entry, { color: theme.text }]}>{species.flavorText}</Text>
          {species.flavorVersion ? (
            <Text style={[styles.level, { color: theme.textSecondary }]}>
              Pokémon {species.flavorVersion}
            </Text>
          ) : null}
        </View>
      ) : null}
      {facts.map(([label, value]) => (
        <View key={label} style={[styles.fact, { borderBottomColor: theme.rule }]}>
          <Text style={[styles.factLabel, { color: theme.textSecondary }]}>{label}</Text>
          <Text style={[styles.factValue, { color: theme.text }]}>{value}</Text>
        </View>
      ))}
    </SectionBody>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  quiet: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  group: {
    gap: Spacing.two,
  },
  groupLabel: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
  },
  strong: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  prose: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  ability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // Full-width press area, text still lined up with the rest of the section
    marginHorizontal: -Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  abilityText: {
    flex: 1,
    gap: Spacing.one,
  },
  abilityHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tagLabel: {
    fontFamily: Font.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 28,
  },
  statName: {
    width: 76,
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  statValue: {
    width: 36,
    textAlign: 'right',
    fontFamily: Font.extraBold,
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  track: {
    flex: 1,
    height: 10,
  },
  fill: {
    height: 10,
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 64,
    paddingRight: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stageSprite: {
    width: 48,
    height: 48,
  },
  stageText: {
    flex: 1,
  },
  stageNumber: {
    fontFamily: Font.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  location: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  locationName: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  level: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  more: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 2,
    borderRadius: 8,
  },
  moreLabel: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  games: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 2,
    borderRadius: 8,
  },
  chipLabel: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  methodLabel: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
  },
  entry: {
    fontFamily: Font.regular,
    fontSize: 17,
    lineHeight: 26,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  factLabel: {
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  factValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: Font.bold,
    fontSize: 15,
    lineHeight: 22,
  },
});
