import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/pokemon/app-bar';
import { PokemonRow } from '@/components/pokemon/pokemon-row';
import { SectionSign } from '@/components/pokemon/section-sign';
import { GamePicker, METHOD_LABELS, Quiet, SectionBody } from '@/components/pokemon/sections';
import { SignBand } from '@/components/sign-band';
import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import {
  formatPriority,
  loadMove,
  loadMoveGames,
  loadMoveLearners,
  type MoveDetail,
  type MoveLearner,
} from '@/db/queries/moves';
import { plural } from '@/db/queries/national-dex';
import type { GameOption } from '@/db/queries/pokemon-detail';
import { useTheme } from '@/hooks/use-theme';

/** Pokémon Champions only has training moves; prefer a main-series game when picking a default. */
const NOT_A_DEFAULT_GAME = new Set(['Champions']);

type Item =
  | { kind: 'band'; key: string }
  | { kind: 'sign'; key: string; title: string; detail?: string }
  | { kind: 'effect'; key: string }
  | { kind: 'changes'; key: string }
  | { kind: 'games'; key: string }
  | { kind: 'method'; key: string; label: string }
  | { kind: 'learner'; key: string; learner: MoveLearner }
  | { kind: 'note'; key: string; text: string };

export default function MoveScreen() {
  const { id: param } = useLocalSearchParams<{ id: string }>();
  const id = Number(param);
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // undefined while loading, null when there's no such move
  const [move, setMove] = useState<MoveDetail | null | undefined>(undefined);
  const [games, setGames] = useState<GameOption[]>([]);
  const [game, setGame] = useState<number | null>(null);
  // Tagged with their game, so switching games shows nothing stale while the next one loads
  const [loaded, setLoaded] = useState<{ game: number; list: MoveLearner[] } | null>(null);
  const learners = loaded && loaded.game === game ? loaded.list : null;
  const [bandHeight, setBandHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([loadMove(db, id), loadMoveGames(db, id)]).then(([m, g]) => {
      if (!live) return;
      setMove(m);
      setGames(g);
      setGame((g.find((x) => !NOT_A_DEFAULT_GAME.has(x.name)) ?? g[0])?.versionGroupId ?? null);
    });
    return () => {
      live = false;
    };
  }, [db, id]);

  useEffect(() => {
    if (game === null) return;
    let live = true;
    loadMoveLearners(db, id, game).then((list) => live && setLoaded({ game, list }));
    return () => {
      live = false;
    };
  }, [db, id, game]);

  const gameName = games.find((g) => g.versionGroupId === game)?.name;

  // One list for the whole page, so a move hundreds of Pokémon learn still scrolls smoothly
  const { items, stickyIndices } = useMemo(() => {
    const items: Item[] = [{ kind: 'band', key: 'band' }];
    const stickyIndices: number[] = [];
    if (!move) return { items, stickyIndices };

    const sign = (key: string, title: string, detail?: string) => {
      stickyIndices.push(items.length);
      items.push({ kind: 'sign', key, title, detail });
    };

    sign('s-effect', 'Effect');
    items.push({ kind: 'effect', key: 'effect' });

    if (move.changes.length > 0) {
      sign('s-changes', 'Changes', plural(move.changes.length, 'game'));
      items.push({ kind: 'changes', key: 'changes' });
    }

    sign('s-learn', 'Learned by', learners ? `${new Set(learners.map((l) => l.pokemonId)).size.toLocaleString()} Pokémon` : undefined);
    if (games.length === 0) {
      items.push({ kind: 'note', key: 'none', text: 'No Pokémon learn this move in any game.' });
    } else {
      items.push({ kind: 'games', key: 'games' });
      let method: string | null = null;
      for (const learner of learners ?? []) {
        if (learner.method !== method) {
          method = learner.method;
          const count = learners!.filter((l) => l.method === method).length;
          items.push({
            kind: 'method',
            key: `m-${method}`,
            label: `${METHOD_LABELS[method] ?? method} · ${count}`,
          });
        }
        items.push({ kind: 'learner', key: `p-${learner.method}-${learner.pokemonId}`, learner });
      }
    }
    return { items, stickyIndices };
  }, [move, games, learners]);

  if (move === null || !Number.isInteger(id)) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StatusBar style="light" />
        <AppBar title="" showTitle={false} />
        <View style={styles.notice}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>No move #{param}</Text>
          <Quiet>This move isn’t in the Pokédex data.</Quiet>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title={move?.name ?? ''} showTitle={collapsed} />
      <FlatList
        // Remount when the signs change: shifting sticky headers inside a mounted list crashes Android
        key={stickyIndices.join(',')}
        removeClippedSubviews={false}
        data={items}
        keyExtractor={(item) => item.key}
        stickyHeaderIndices={stickyIndices}
        initialNumToRender={20}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = bandHeight > 0 && e.nativeEvent.contentOffset.y > bandHeight - 24;
          if (past !== collapsed) setCollapsed(past);
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}
        renderItem={({ item }) => {
          switch (item.kind) {
            case 'band':
              return (
                <View onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}>
                  <MoveBand move={move} />
                </View>
              );
            case 'sign':
              return <SectionSign title={item.title} detail={item.detail} />;
            case 'effect':
              return move ? <EffectBody move={move} /> : null;
            case 'changes':
              return move ? <ChangesBody move={move} /> : null;
            case 'games':
              return <GamePicker games={games} selected={game} onSelect={setGame} />;
            case 'method':
              return (
                <Text style={[styles.methodLabel, { color: theme.textSecondary }]}>{item.label}</Text>
              );
            case 'learner':
              return <LearnerRow learner={item.learner} />;
            case 'note':
              return (
                <SectionBody>
                  <Quiet>{item.text}</Quiet>
                </SectionBody>
              );
          }
        }}
        ListFooterComponent={
          learners && learners.length === 0 && gameName ? (
            <SectionBody>
              <Quiet>No Pokémon learn it in {gameName}.</Quiet>
            </SectionBody>
          ) : undefined
        }
      />
    </View>
  );
}

/** The gradient band: name, type and category, then the numbers you check mid-battle. */
function MoveBand({ move }: { move: MoveDetail | undefined }) {
  const theme = useTheme();
  const stats: [string, string][] = move
    ? [
        ['Power', move.power ? String(move.power) : '—'],
        ['Accuracy', move.accuracy ? `${move.accuracy}%` : '—'],
        ['PP', move.pp ? String(move.pp) : '—'],
        ...(move.priority !== 0 ? [['Priority', formatPriority(move.priority)] as [string, string]] : []),
        ...(move.effectChance !== null
          ? [['Effect chance', `${move.effectChance}%`] as [string, string]]
          : []),
      ]
    : [];

  return (
    <SignBand style={styles.band}>
      <Text style={[styles.name, { color: theme.onSign }]} accessibilityRole="header">
        {move?.name ?? ''}
      </Text>
      {move ? (
        <View style={styles.badges}>
          <TypeBadge identifier={move.type.identifier} name={move.type.name} onBand />
          <Text style={[styles.category, { color: theme.onSign }]}>{move.category}</Text>
        </View>
      ) : null}
      <View style={styles.stats}>
        {stats.map(([label, value]) => (
          <View key={label} style={styles.stat} accessible accessibilityLabel={`${label} ${value === '—' ? 'none' : value}`}>
            <Text style={[styles.statValue, { color: theme.onSign }]} maxFontSizeMultiplier={1.3}>
              {value}
            </Text>
            <Text style={[styles.statLabel, { color: theme.onSign }]}>{label}</Text>
          </View>
        ))}
      </View>
    </SignBand>
  );
}

function EffectBody({ move }: { move: MoveDetail }) {
  const theme = useTheme();
  const facts = [
    move.target ? `Targets: ${move.target}` : null,
    `Introduced in Gen ${move.generation}`,
  ].filter(Boolean);

  return (
    <SectionBody>
      {move.effect ? (
        <Text style={[styles.effect, { color: theme.text }]}>{move.effect}</Text>
      ) : null}
      {move.flavorText ? (
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>In-game description</Text>
          <Text style={[styles.prose, { color: theme.text }]}>{move.flavorText}</Text>
        </View>
      ) : null}
      {!move.effect && !move.flavorText ? <Quiet>No description recorded.</Quiet> : null}
      <Quiet>{facts.join(' · ')}</Quiet>
    </SectionBody>
  );
}

function ChangesBody({ move }: { move: MoveDetail }) {
  const theme = useTheme();
  return (
    <SectionBody>
      {move.changes.map((c) => (
        <View key={c.since} style={styles.group}>
          <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>Before {c.since}</Text>
          {c.before.map((b) => (
            <Text key={b} style={[styles.prose, { color: theme.text }]}>
              {b}
            </Text>
          ))}
        </View>
      ))}
    </SectionBody>
  );
}

/** A Pokémon that learns the move, with the level it learns it at. */
function LearnerRow({ learner }: { learner: MoveLearner }) {
  const isLevel = learner.method === 'Level up';
  return (
    <PokemonRow
      pokemon={learner}
      trailing={isLevel ? (learner.level > 0 ? `Lv ${learner.level}` : 'Evo') : undefined}
      trailingLabel={isLevel ? (learner.level > 0 ? `level ${learner.level}` : 'on evolution') : undefined}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  band: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  name: {
    fontFamily: Font.extraBold,
    fontSize: 32,
    lineHeight: 38,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  category: {
    fontFamily: Font.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    rowGap: Spacing.two,
    marginTop: Spacing.three,
  },
  stat: {
    minWidth: 56,
  },
  statValue: {
    fontFamily: Font.extraBold,
    fontSize: 28,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: Font.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  effect: {
    fontFamily: Font.medium,
    fontSize: 17,
    lineHeight: 26,
  },
  group: {
    gap: Spacing.one,
  },
  groupLabel: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  prose: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  methodLabel: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
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
