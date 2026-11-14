import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/pokemon/app-bar';
import { PokemonRow } from '@/components/pokemon/pokemon-row';
import { SectionSign } from '@/components/pokemon/section-sign';
import { Quiet, SectionBody } from '@/components/pokemon/sections';
import { SignBand } from '@/components/sign-band';
import { TypeButton } from '@/components/types/type-button';
import { Font, Spacing } from '@/constants/theme';
import { formatMultiplier } from '@/db/queries/pokemon-detail';
import type { ListedPokemon } from '@/db/queries/pokemon-list';
import {
  type BattleType,
  type ChartChange,
  effectiveness,
  loadChartChanges,
  loadPokemonOfTypes,
  loadTypeData,
  type TypeData,
} from '@/db/queries/types';
import { useTheme } from '@/hooks/use-theme';

type Row =
  | { kind: 'band'; key: string }
  | { kind: 'sign'; key: string; title: string; detail?: string }
  | { kind: 'attacking'; key: string }
  | { kind: 'defending'; key: string }
  | { kind: 'changes'; key: string }
  | { kind: 'pokemon'; key: string; pokemon: ListedPokemon }
  | { kind: 'note'; key: string; text: string };

type Matchup = { type: BattleType; multiplier: number };

export default function TypeScreen() {
  const { id: param } = useLocalSearchParams<{ id: string }>();
  const id = Number(param);
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<TypeData | null>(null);
  const [changes, setChanges] = useState<ChartChange[]>([]);
  // A second type to check a dual-typed Pokémon (Water + Ground): defending and Pokémon follow it
  const [partner, setPartner] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<{ partner: number | null; list: ListedPokemon[] } | null>(null);
  const pokemon = loaded && loaded.partner === partner ? loaded.list : null;
  const [bandHeight, setBandHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([loadTypeData(db), loadChartChanges(db, id)]).then(([d, c]) => {
      if (!live) return;
      setData(d);
      setChanges(c);
    });
    return () => {
      live = false;
    };
  }, [db, id]);

  useEffect(() => {
    let live = true;
    loadPokemonOfTypes(db, partner === null ? [id] : [id, partner]).then(
      (list) => live && setLoaded({ partner, list })
    );
    return () => {
      live = false;
    };
  }, [db, id, partner]);

  const type = data?.types.find((t) => t.id === id);
  const second = data?.types.find((t) => t.id === partner);

  const { rows, stickyIndices } = useMemo(() => {
    const rows: Row[] = [{ kind: 'band', key: 'band' }];
    const stickyIndices: number[] = [];
    if (!type) return { rows, stickyIndices };
    const sign = (key: string, title: string, detail?: string) => {
      stickyIndices.push(rows.length);
      rows.push({ kind: 'sign', key, title, detail });
    };

    sign('s-attacking', 'Attacking', `${type.name} moves`);
    rows.push({ kind: 'attacking', key: 'attacking' });

    sign('s-defending', 'Defending', second ? `${type.name} + ${second.name}` : type.name);
    rows.push({ kind: 'defending', key: 'defending' });

    if (changes.length > 0) {
      sign('s-changes', 'Older games', `${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`);
      rows.push({ kind: 'changes', key: 'changes' });
    }

    const pairName = second ? `${type.name} + ${second.name}` : type.name;
    sign('s-pokemon', 'Pokémon', pokemon ? `${pokemon.length.toLocaleString()} ${pairName}` : undefined);
    if (pokemon?.length === 0) {
      rows.push({ kind: 'note', key: 'none', text: `No Pokémon are ${pairName}.` });
    }
    for (const p of pokemon ?? []) rows.push({ kind: 'pokemon', key: `p-${p.pokemonId}`, pokemon: p });
    return { rows, stickyIndices };
  }, [type, second, changes, pokemon]);

  if (!Number.isInteger(id) || (data && !type)) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StatusBar style="light" />
        <AppBar title="" showTitle={false} />
        <View style={styles.notice}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>No type #{param}</Text>
          <Quiet>This type isn’t in the Pokédex data.</Quiet>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title={type ? `${type.name} type` : ''} showTitle={collapsed} />
      <FlatList
        // Remount when the signs change: shifting sticky headers inside a mounted list crashes Android
        key={stickyIndices.join(',')}
        removeClippedSubviews={false}
        data={rows}
        keyExtractor={(row) => row.key}
        stickyHeaderIndices={stickyIndices}
        initialNumToRender={20}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = bandHeight > 0 && e.nativeEvent.contentOffset.y > bandHeight - 24;
          if (past !== collapsed) setCollapsed(past);
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}
        renderItem={({ item: row }) => {
          switch (row.kind) {
            case 'band':
              return (
                <View onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}>
                  <TypeBand type={type} />
                </View>
              );
            case 'sign':
              return <SectionSign title={row.title} detail={row.detail} />;
            case 'attacking':
              return data && type ? <AttackingBody data={data} type={type} /> : null;
            case 'defending':
              return data && type ? (
                <DefendingBody data={data} type={type} partner={partner} onPartner={setPartner} />
              ) : null;
            case 'changes':
              return <ChangesBody changes={changes} />;
            case 'pokemon':
              return <PokemonRow pokemon={row.pokemon} />;
            case 'note':
              return (
                <SectionBody>
                  <Quiet>{row.text}</Quiet>
                </SectionBody>
              );
          }
        }}
      />
    </View>
  );
}

function TypeBand({ type }: { type: BattleType | undefined }) {
  const theme = useTheme();
  const facts = type
    ? [
        `Introduced in Gen ${type.generation}`,
        // Before the physical/special split every move of a type shared one category
        type.oldCategory ? `Before Gen IV, all its moves were ${type.oldCategory}` : null,
      ].filter(Boolean)
    : [];
  return (
    <SignBand style={styles.band}>
      <Text style={[styles.name, { color: theme.onSign }]} accessibilityRole="header">
        {type?.name ?? ''}
      </Text>
      {facts.map((f) => (
        <Text key={f} style={[styles.fact, { color: theme.onSign }]}>
          {f}
        </Text>
      ))}
    </SignBand>
  );
}

function openType(type: BattleType) {
  router.push({ pathname: '/type/[id]', params: { id: type.id } });
}

/** Types grouped by multiplier, each opening its own page. */
function MatchupGroups({ groups }: { groups: { label: string; items: Matchup[] }[] }) {
  return (
    <>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <Group key={g.label} label={g.label}>
            {g.items.map((m) => (
              <TypeButton
                key={m.type.id}
                identifier={m.type.identifier}
                name={m.type.name}
                suffix={formatMultiplier(m.multiplier)}
                onPress={() => openType(m.type)}
                accessibilityLabel={`${m.type.name}, ${spokenMultiplier(m.multiplier)}`}
              />
            ))}
          </Group>
        ))}
    </>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

function AttackingBody({ data, type }: { data: TypeData; type: BattleType }) {
  const matchups = data.types.map((t) => ({ type: t, multiplier: effectiveness(data.chart, type.id, [t.id]) }));
  return (
    <SectionBody>
      <MatchupGroups
        groups={[
          { label: 'Super effective against', items: matchups.filter((m) => m.multiplier > 1) },
          {
            label: 'Not very effective against',
            items: matchups.filter((m) => m.multiplier > 0 && m.multiplier < 1),
          },
          { label: 'No effect on', items: matchups.filter((m) => m.multiplier === 0) },
        ]}
      />
    </SectionBody>
  );
}

function DefendingBody({
  data,
  type,
  partner,
  onPartner,
}: {
  data: TypeData;
  type: BattleType;
  partner: number | null;
  onPartner: (id: number | null) => void;
}) {
  const theme = useTheme();
  const defenders = partner === null ? [type.id] : [type.id, partner];
  const matchups = data.types
    .map((t) => ({ type: t, multiplier: effectiveness(data.chart, t.id, defenders) }))
    .sort((a, b) => b.multiplier - a.multiplier);

  return (
    <SectionBody>
      {/* Above the results it changes, and one scrollable row so they stay in view */}
      <View style={styles.picker}>
        <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>Combined with</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pickerScroll}
          contentContainerStyle={styles.pickerRow}>
          <Pressable
            onPress={() => onPartner(null)}
            style={({ pressed }) => [
              styles.none,
              { borderColor: partner === null ? theme.text : theme.rule },
              partner === null && { borderWidth: 3 },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: partner === null }}>
            <Text style={[styles.noneLabel, { color: theme.text }]}>{type.name} only</Text>
          </Pressable>
          {data.types
            .filter((t) => t.id !== type.id)
            .map((t) => (
              <TypeButton
                key={t.id}
                identifier={t.identifier}
                name={t.name}
                selected={t.id === partner}
                onPress={() => onPartner(t.id === partner ? null : t.id)}
                accessibilityHint={
                  t.id === partner ? 'Back to one type' : `Shows ${type.name} and ${t.name} together`
                }
              />
            ))}
        </ScrollView>
      </View>
      <MatchupGroups
        groups={[
          { label: 'Weak to', items: matchups.filter((m) => m.multiplier > 1) },
          { label: 'Resists', items: matchups.filter((m) => m.multiplier > 0 && m.multiplier < 1) },
          { label: 'Immune to', items: matchups.filter((m) => m.multiplier === 0) },
        ]}
      />
    </SectionBody>
  );
}

function ChangesBody({ changes }: { changes: ChartChange[] }) {
  const theme = useTheme();
  return (
    <SectionBody>
      {changes.map((c) => (
        <Text key={`${c.attacker.identifier}-${c.target.identifier}`} style={[styles.prose, { color: theme.text }]}>
          <Text style={styles.strongInline}>Up to Gen {c.until}: </Text>
          {c.attacker.name} moves {c.factor === 1 ? 'did normal damage to' : `did ${formatMultiplier(c.factor)} damage to`}{' '}
          {c.target.name}
          {c.factor === 0 ? ' (no effect)' : ''}
        </Text>
      ))}
    </SectionBody>
  );
}

function spokenMultiplier(m: number) {
  if (m === 0) return 'no effect';
  if (m === 0.25) return 'quarter damage';
  if (m === 0.5) return 'half damage';
  return `${m} times damage`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  band: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.one,
  },
  name: {
    fontFamily: Font.extraBold,
    fontSize: 32,
    lineHeight: 38,
  },
  fact: {
    fontFamily: Font.medium,
    fontSize: 16,
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
    gap: Spacing.two,
  },
  picker: {
    gap: Spacing.two,
  },
  // Bleeds to the screen edges so the row visibly scrolls
  pickerScroll: {
    marginHorizontal: -Spacing.three,
  },
  pickerRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  none: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  noneLabel: {
    fontFamily: Font.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  prose: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  strongInline: {
    fontFamily: Font.bold,
  },
  notice: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  noticeTitle: {
    fontFamily: Font.bold,
    fontSize: 20,
    lineHeight: 26,
  },
});
