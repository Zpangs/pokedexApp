import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { SectionSign } from '@/components/pokemon/section-sign';
import { Font, Spacing } from '@/constants/theme';
import { rulesFor, type TeamGame } from '@/db/queries/team-builder';
import { useTheme } from '@/hooks/use-theme';

type Row =
  | { kind: 'sign'; key: string; title: string }
  | { kind: 'game'; key: string; game: TeamGame };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** What sets this game's teams apart, so the choice is clear before picking. */
export function gameFeatures(game: TeamGame) {
  const r = rulesFor(game);
  const parts: string[] = [];
  if (r.mega) parts.push('Mega Evolution');
  if (r.zMoves) parts.push('Z-Moves');
  if (r.dynamax) parts.push('Dynamax');
  if (r.tera) parts.push('Terastallization');
  if (!r.abilities && game.generation >= 3) parts.push('No abilities or held items');
  else if (!r.abilities) parts.push(r.heldItems ? 'No abilities or natures' : 'No abilities, items or natures');
  return parts.join(' · ');
}

/** Every game a team can be built for, newest first, under generation signs. */
export function GameList({
  games,
  onPick,
  header,
  bottomInset,
}: {
  games: TeamGame[];
  onPick: (game: TeamGame) => void;
  header?: ReactElement;
  bottomInset: number;
}) {
  const theme = useTheme();
  const rows: Row[] = [];
  const stickyIndices: number[] = [];
  for (const game of games) {
    const last = rows[rows.length - 1];
    if (!last || (last.kind === 'game' && last.game.generation !== game.generation)) {
      stickyIndices.push(rows.length + (header ? 1 : 0));
      rows.push({ kind: 'sign', key: `g${game.generation}`, title: `Generation ${ROMAN[game.generation - 1]}` });
    }
    rows.push({ kind: 'game', key: String(game.versionGroupId), game });
  }

  return (
    <FlatList
      data={rows}
      key={stickyIndices.join(',')}
      removeClippedSubviews={false}
      keyExtractor={(r) => r.key}
      stickyHeaderIndices={stickyIndices}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      renderItem={({ item }) =>
        item.kind === 'sign' ? (
          <SectionSign title={item.title} />
        ) : (
          <Pressable
            onPress={() => onPick(item.game)}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: theme.rule },
              pressed && { backgroundColor: theme.backgroundElement },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.game.name}. ${gameFeatures(item.game)}`}>
            <Text style={[styles.name, { color: theme.text }]}>{item.game.name}</Text>
            {gameFeatures(item.game) ? (
              <Text style={[styles.features, { color: theme.textSecondary }]}>{gameFeatures(item.game)}</Text>
            ) : null}
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={22}
              tintColor={theme.textSecondary}
              style={styles.chevron}
            />
          </Pressable>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    justifyContent: 'center',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.six,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  features: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  chevron: {
    position: 'absolute',
    right: Spacing.three,
  },
});
